import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DEFAULT_SETTINGS, formatMoney } from "@/lib/admin";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { badRequest, json, methodNotAllowed } from "@/lib/server/customer-auth";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";
import {
  categoryAvailableForShift,
  type MenuShift,
  type Product,
  type ProductCategory,
} from "@/lib/products";

const localSaleSchema = z.object({
  customerName: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  customerPhone: z.string().trim().max(40).optional(),
  paymentMethod: z.enum(["efectivo", "transferencia"]),
  discountType: z.enum(["percent", "fixed"]).default("percent"),
  discountValue: z.number().finite().nonnegative().default(0),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(50),
        removedIngredients: z.array(z.string().trim().max(80)).default([]),
        notes: z.string().trim().max(240).optional(),
      }),
    )
    .min(1, "La comanda esta vacia.")
    .max(50),
});

function productIngredients(product: Product) {
  return product.ingredients?.length
    ? product.ingredients
    : product.description
      ? product.description
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
}

export const Route = createFileRoute("/api/admin/local-sale")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;

        const body = await request.json().catch(() => null);
        const parsed = localSaleSchema.safeParse(body);
        if (!parsed.success)
          return badRequest("Datos invalidos para la venta local.", parsed.error.flatten());

        const input = parsed.data;
        const productIds = [...new Set(input.items.map((item) => item.productId))];

        const [
          { data: settingsData, error: settingsError },
          { data: productsData, error: productsError },
        ] = await Promise.all([
          (supabaseAdmin as any)
            .from("store_settings")
            .select("*")
            .eq("store_id", DEFAULT_STORE_ID)
            .limit(1)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("products")
            .select("*")
            .eq("store_id", DEFAULT_STORE_ID)
            .eq("available", true)
            .in("id", productIds),
        ]);

        if (settingsError) return json({ error: settingsError.message }, { status: 500 });
        if (productsError) return json({ error: productsError.message }, { status: 500 });

        const products = (productsData as Product[] | null) ?? [];
        if (products.length !== productIds.length) {
          return badRequest("Hay productos que ya no estan disponibles.");
        }

        const categoryKeys = [
          ...new Set(products.map((product) => product.category).filter(Boolean)),
        ];
        const { data: categoriesData, error: categoriesError } = await (supabaseAdmin as any)
          .from("product_categories")
          .select("*")
          .eq("store_id", DEFAULT_STORE_ID)
          .in("key", categoryKeys);

        if (categoriesError) return json({ error: categoriesError.message }, { status: 500 });

        const settings = { ...DEFAULT_SETTINGS, ...settingsData };
        const currentShift = (settings.current_menu_shift || "dinner") as MenuShift;
        const categories = new Map(
          ((categoriesData as ProductCategory[] | null) ?? []).map((category) => [
            category.key,
            category,
          ]),
        );
        const productsById = new Map(products.map((product) => [product.id, product]));

        for (const item of input.items) {
          const product = productsById.get(item.productId);
          const category = product ? categories.get(product.category) : undefined;
          if (!product || !categoryAvailableForShift(category, currentShift)) {
            return badRequest(`${product?.name ?? "El producto"} esta fuera del turno actual.`);
          }
        }

        const subtotal = input.items.reduce((sum, item) => {
          const product = productsById.get(item.productId);
          return sum + Number(product?.price ?? 0) * item.quantity;
        }, 0);
        const discountValue = Number(input.discountValue) || 0;
        const discountAmount =
          input.discountType === "percent"
            ? subtotal * (Math.min(100, discountValue) / 100)
            : discountValue;
        const safeDiscount = Math.min(subtotal, Math.max(0, discountAmount));
        const total = Math.max(0, subtotal - safeDiscount);
        const discountLabel =
          safeDiscount > 0
            ? `Descuento ${input.discountType === "percent" ? `${discountValue}%` : formatMoney(discountValue)}: -${formatMoney(safeDiscount)}.`
            : "";
        const orderNotes = ["Venta en local.", discountLabel, input.notes]
          .filter(Boolean)
          .join(" ");

        const { data: order, error: orderError } = await (supabaseAdmin as any)
          .from("orders")
          .insert({
            store_id: DEFAULT_STORE_ID,
            customer_name: input.customerName,
            customer_phone: input.customerPhone || "Sin telefono",
            customer_address: null,
            delivery_method: "pickup",
            payment_method: input.paymentMethod,
            payment_status: "approved",
            notes: orderNotes || null,
            status: "confirmed",
            total,
          })
          .select("*")
          .single();

        if (orderError || !order) {
          return json(
            { error: orderError?.message ?? "No se pudo crear la venta local." },
            { status: 500 },
          );
        }

        const itemsPayload = input.items.map((item) => {
          const product = productsById.get(item.productId) as Product;
          return {
            order_id: order.id,
            product_id: product.id,
            product_name: product.name,
            unit_price: Number(product.price),
            quantity: item.quantity,
            base_ingredients: productIngredients(product),
            removed_ingredients: item.removedIngredients,
            added_ingredients: [],
            item_notes: item.notes || null,
          };
        });

        const { error: itemsError } = await (supabaseAdmin as any)
          .from("order_items")
          .insert(itemsPayload);
        if (itemsError) {
          await (supabaseAdmin as any)
            .from("orders")
            .update({ status: "cancelled" })
            .eq("id", order.id);
          return json({ error: "No se pudieron cargar los items de la comanda." }, { status: 500 });
        }

        return json({ order: { ...order, order_items: itemsPayload }, total });
      },
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
