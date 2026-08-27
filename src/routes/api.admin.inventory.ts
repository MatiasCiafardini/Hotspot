import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStockUser } from "@/lib/server/admin-auth";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";

const STORE_ID = 1;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function body(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function listPayload(userId: string, role: string, slug?: string | null) {
  let listsQuery = (supabaseAdmin as any)
    .from("stock_lists")
    .select("*")
    .eq("store_id", STORE_ID)
    .order("name");
  if (slug) listsQuery = listsQuery.eq("slug", slug).eq("active", true);
  const { data: lists, error } = await listsQuery;
  if (error) throw error;
  let allowed = lists ?? [];
  if (role !== "owner") {
    const { data: assignments } = await (supabaseAdmin as any)
      .from("stock_list_assignments")
      .select("list_id")
      .eq("user_id", userId);
    const ids = new Set((assignments ?? []).map((x: any) => x.list_id));
    allowed = allowed.filter((list: any) => ids.has(list.id));
  }
  if (slug && allowed.length === 0) throw new Error("LIST_NOT_FOUND");
  const listIds = allowed.map((list: any) => list.id);
  const { data: links } = listIds.length
    ? await (supabaseAdmin as any)
        .from("stock_list_items")
        .select("list_id,stock_item_id,sort_order,step")
        .in("list_id", listIds)
        .order("sort_order")
    : { data: [] };
  const itemIds = [...new Set((links ?? []).map((link: any) => link.stock_item_id))];
  const { data: items } = itemIds.length
    ? await (supabaseAdmin as any).from("stock_items").select("*").in("id", itemIds)
    : { data: [] };
  const itemMap = new Map((items ?? []).map((item: any) => [item.id, item]));
  return {
    lists: allowed.map((list: any) => {
      const ownLinks = (links ?? []).filter((link: any) => link.list_id === list.id);
      const ownItems = ownLinks.map((link: any) => itemMap.get(link.stock_item_id)).filter(Boolean);
      return {
        ...list,
        item_count: ownItems.length,
        low_count: ownItems.filter(
          (item: any) => Number(item.quantity) <= Number(item.low_stock_threshold),
        ).length,
      };
    }),
    items: (links ?? [])
      .map((link: any) => ({
        ...itemMap.get(link.stock_item_id),
        list_id: link.list_id,
        step: Number(link.step),
        sort_order: link.sort_order,
      }))
      .filter((item: any) => item.id),
  };
}

async function adminPayload(userId: string, role: string) {
  if (role !== "owner") throw new Error("OWNER_ONLY");
  const base = await listPayload(userId, role);
  const [
    { data: items },
    { data: suppliers },
    { data: relations },
    { data: counts },
    { data: orders },
    users,
  ] = await Promise.all([
    (supabaseAdmin as any).from("stock_items").select("*").eq("store_id", STORE_ID).order("name"),
    (supabaseAdmin as any).from("suppliers").select("*").eq("store_id", STORE_ID).order("name"),
    (supabaseAdmin as any).from("stock_item_suppliers").select("*"),
    (supabaseAdmin as any)
      .from("stock_counts")
      .select("*,stock_lists(name),stock_count_items(*)")
      .eq("store_id", STORE_ID)
      .order("created_at", { ascending: false })
      .limit(100),
    (supabaseAdmin as any)
      .from("purchase_orders")
      .select("*,suppliers(name,phone),purchase_order_items(*)")
      .eq("store_id", STORE_ID)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  const { data: roles } = await (supabaseAdmin as any).from("user_roles").select("user_id,role");
  const { data: assignments } = await (supabaseAdmin as any)
    .from("stock_list_assignments")
    .select("*");
  return {
    ...base,
    lists: base.lists.map((list: any) => ({
      ...list,
      last_count_at:
        (counts ?? []).find((count: any) => count.list_id === list.id)?.created_at ?? null,
    })),
    allItems: items ?? [],
    suppliers: suppliers ?? [],
    supplierRelations: relations ?? [],
    counts: counts ?? [],
    orders: orders ?? [],
    assignments: assignments ?? [],
    users: users.data.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: String(u.user_metadata?.name ?? u.email ?? "Operador"),
      role: roles?.find((r: any) => r.user_id === u.id)?.role ?? null,
    })),
  };
}

async function handleGet(request: Request) {
  const auth = await requireStockUser(request);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  try {
    return json(
      url.searchParams.get("view") === "admin"
        ? await adminPayload(auth.user.id, auth.role)
        : await listPayload(auth.user.id, auth.role, url.searchParams.get("slug")),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar stock.";
    return json(
      { error: message },
      { status: message === "OWNER_ONLY" ? 403 : message === "LIST_NOT_FOUND" ? 404 : 500 },
    );
  }
}

async function handlePost(request: Request) {
  const auth = await requireStockUser(request);
  if ("response" in auth) return auth.response;
  const input = await body(request);
  try {
    if (input.action === "save_count") {
      const { data, error } = await (supabaseAdmin as any).rpc("save_stock_count", {
        _actor_id: auth.user.id,
        _list_id: input.list_id,
        _notes: input.notes ?? "",
        _items: input.items,
      });
      if (error) throw error;
      return json({ id: data });
    }
    if (auth.role !== "owner")
      return json({ error: "Solo el propietario puede administrar stock." }, { status: 403 });

    if (input.action === "save_item") {
      const patch = {
        name: input.name?.trim(),
        quantity: input.quantity,
        low_stock_threshold: input.low_stock_threshold,
        target_stock: input.target_stock === "" ? null : input.target_stock,
        unit: input.unit?.trim() || "unidades",
        sku: input.sku?.trim() || null,
        allow_negative: !!input.allow_negative,
        available: input.available !== false,
      };
      if (input.id) {
        const { error } = await (supabaseAdmin as any)
          .from("stock_items")
          .update(patch)
          .eq("id", input.id)
          .eq("store_id", STORE_ID);
        if (error) throw error;
      } else {
        const { error } = await (supabaseAdmin as any)
          .from("stock_items")
          .insert({ ...patch, store_id: STORE_ID, type: "ingredient" });
        if (error) throw error;
      }
    } else if (input.action === "archive_item") {
      const { error } = await (supabaseAdmin as any)
        .from("stock_items")
        .update({ available: false })
        .eq("id", input.id)
        .eq("store_id", STORE_ID);
      if (error) throw error;
    } else if (input.action === "save_list") {
      const patch = {
        store_id: STORE_ID,
        name: input.name.trim(),
        slug: slugify(input.slug),
        description: input.description ?? "",
        active: input.active !== false,
      };
      let listId = input.id;
      if (listId) {
        const { error } = await (supabaseAdmin as any)
          .from("stock_lists")
          .update(patch)
          .eq("id", listId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabaseAdmin as any)
          .from("stock_lists")
          .insert(patch)
          .select("id")
          .single();
        if (error) throw error;
        listId = data.id;
      }
      await (supabaseAdmin as any).from("stock_list_items").delete().eq("list_id", listId);
      if (input.item_ids?.length) {
        const { error } = await (supabaseAdmin as any).from("stock_list_items").insert(
          input.item_ids.map((id: string, index: number) => ({
            list_id: listId,
            stock_item_id: id,
            sort_order: index,
            step: Number(input.steps?.[id] ?? 1),
          })),
        );
        if (error) throw error;
      }
      await (supabaseAdmin as any).from("stock_list_assignments").delete().eq("list_id", listId);
      if (input.user_ids?.length) {
        const { error } = await (supabaseAdmin as any)
          .from("stock_list_assignments")
          .insert(input.user_ids.map((id: string) => ({ list_id: listId, user_id: id })));
        if (error) throw error;
      }
    } else if (input.action === "archive_list") {
      const { error } = await (supabaseAdmin as any)
        .from("stock_lists")
        .update({ active: false })
        .eq("id", input.id);
      if (error) throw error;
    } else if (input.action === "save_supplier") {
      const { error } = await (supabaseAdmin as any).rpc("save_stock_supplier", {
        _supplier_id: input.id || null,
        _store_id: STORE_ID,
        _name: input.name?.trim(),
        _phone: input.phone ?? "",
        _address: input.address ?? "",
        _business_hours: input.business_hours ?? "",
        _notes: input.notes ?? "",
        _active: input.active !== false,
        _item_ids: input.item_ids ?? [],
        _primary_item_ids: input.primary_item_ids ?? [],
      });
      if (error) throw error;
    } else if (input.action === "bulk_assign_supplier") {
      const itemIds = [...new Set<string>(input.item_ids ?? [])];
      if (!input.supplier_id || !itemIds.length)
        throw new Error("Seleccioná proveedor y productos.");
      const { data: supplier } = await (supabaseAdmin as any)
        .from("suppliers")
        .select("id")
        .eq("id", input.supplier_id)
        .eq("store_id", STORE_ID)
        .single();
      if (!supplier) throw new Error("Proveedor inválido.");
      const { error } = await (supabaseAdmin as any).from("stock_item_suppliers").upsert(
        itemIds.map((stockItemId) => ({
          stock_item_id: stockItemId,
          supplier_id: input.supplier_id,
          is_primary: true,
        })),
        { onConflict: "stock_item_id,supplier_id" },
      );
      if (error) throw error;
    } else if (input.action === "archive_supplier") {
      const { error } = await (supabaseAdmin as any)
        .from("suppliers")
        .update({ active: false })
        .eq("id", input.id);
      if (error) throw error;
    } else if (input.action === "create_order") {
      const rows = (input.items ?? [])
        .filter((x: any) => Number(x.order_quantity) > 0)
        .map((x: any) => ({ ...x, included: x.included !== false }));
      const { data: orderId, error } = await (supabaseAdmin as any).rpc(
        "create_stock_purchase_order",
        {
          _store_id: STORE_ID,
          _supplier_id: input.supplier_id || null,
          _created_by: auth.user.id,
          _notes: input.notes ?? "",
          _items: rows,
        },
      );
      if (error) throw error;
      return json({ id: orderId });
    } else if (input.action === "set_order_status") {
      const patch: any = { status: input.status };
      if (input.status === "ordered") patch.ordered_at = new Date().toISOString();
      const { error } = await (supabaseAdmin as any)
        .from("purchase_orders")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    } else if (input.action === "create_operator") {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        email_confirm: true,
        user_metadata: { name: input.name?.trim() || input.email.trim() },
      });
      if (error || !created.user) throw error ?? new Error("No se pudo crear el operador.");
      const { error: roleError } = await (supabaseAdmin as any)
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "operator" });
      if (roleError) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        throw roleError;
      }
    } else return json({ error: "Accion desconocida." }, { status: 400 });
    return json({ ok: true });
  } catch (error: any) {
    const message = error?.message ?? "No se pudo guardar.";
    return json(
      {
        error: message.includes("ACTIVE_ORDER_EXISTS")
          ? "Ya existe un pedido pendiente para este proveedor."
          : message,
      },
      { status: /CONFLICT:|ACTIVE_ORDER_EXISTS/.test(String(message)) ? 409 : 500 },
    );
  }
}

export const Route = createFileRoute("/api/admin/inventory")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGet(request),
      POST: async ({ request }) => handlePost(request),
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
