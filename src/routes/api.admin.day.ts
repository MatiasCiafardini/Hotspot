import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_SETTINGS, deriveCashSummaryStats, type AdminOrder } from "@/lib/admin";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

const CLOSABLE_STATUSES = ["delivered", "rejected", "cancelled"];

function isMissingCashClosuresTable(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    error?.message?.toLowerCase().includes("cash_closures") ||
    error?.message?.toLowerCase().includes("does not exist")
  );
}

export const Route = createFileRoute("/api/admin/day")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;

        const { data, error } = await (supabaseAdmin as any)
          .from("cash_closures")
          .select("*")
          .eq("store_id", DEFAULT_STORE_ID)
          .order("closed_at", { ascending: false })
          .limit(100);

        if (isMissingCashClosuresTable(error)) {
          return json({
            closures: [],
            migrationRequired: true,
            error: "Falta aplicar la migracion de cierres de caja.",
          });
        }
        if (error) return json({ error: error.message }, { status: 500 });
        return json({ closures: data ?? [] });
      },
      POST: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;

        const body = await request.json().catch(() => ({}));
        const action = body?.action;

        if (action === "start") {
          const shift = body?.shift === "lunch" ? "lunch" : "dinner";
          const now = new Date().toISOString();
          const { data, error } = await (supabaseAdmin as any)
            .from("store_settings")
            .update({ is_open: true, current_day_started_at: now, current_menu_shift: shift })
            .eq("store_id", DEFAULT_STORE_ID)
            .select()
            .single();

          if (error) return json({ error: error.message }, { status: 500 });
          return json({ settings: { ...DEFAULT_SETTINGS, ...data } });
        }

        if (action === "close") {
          const { data: settingsData, error: settingsError } = await (supabaseAdmin as any)
            .from("store_settings")
            .select("*")
            .eq("store_id", DEFAULT_STORE_ID)
            .limit(1)
            .maybeSingle();

          if (settingsError) return json({ error: settingsError.message }, { status: 500 });
          if (!settingsData?.current_day_started_at) {
            return json({ error: "No hay una apertura activa para cerrar." }, { status: 400 });
          }

          const settings = { ...DEFAULT_SETTINGS, ...settingsData };
          const closedAt = new Date().toISOString();
          const { data: ordersData, error: ordersError } = await (supabaseAdmin as any)
            .from("orders")
            .select("*, order_items(*)")
            .eq("store_id", DEFAULT_STORE_ID)
            .gte("created_at", settings.current_day_started_at)
            .lte("created_at", closedAt)
            .order("created_at", { ascending: true });

          if (ordersError) return json({ error: ordersError.message }, { status: 500 });

          const orders = ((ordersData as AdminOrder[] | null) ?? []).map((order) => ({
            ...order,
            total: Number(order.total),
          }));
          const unresolvedOrders = orders.filter(
            (order) => !CLOSABLE_STATUSES.includes(order.status),
          );
          if (unresolvedOrders.length > 0) {
            return json(
              {
                error: `No podes cerrar el dia: quedan ${unresolvedOrders.length} pedido(s) pendientes o en curso.`,
                unresolvedOrders: unresolvedOrders.map((order) => ({
                  id: order.id,
                  customer_name: order.customer_name,
                  status: order.status,
                  total: order.total,
                })),
              },
              { status: 400 },
            );
          }

          const stats = deriveCashSummaryStats(orders);

          const { data: closure, error: closureError } = await (supabaseAdmin as any)
            .from("cash_closures")
            .insert({
              store_id: DEFAULT_STORE_ID,
              opened_at: settings.current_day_started_at,
              closed_at: closedAt,
              menu_shift: settings.current_menu_shift || "dinner",
              orders_count: stats.ordersCount,
              chargeable_orders_count: stats.chargeableOrdersCount,
              rejected_orders_count: stats.rejectedOrdersCount,
              total_sales: stats.total,
              cash_total: stats.cash,
              transfer_approved_total: stats.approvedTransfer,
              transfer_pending_total: stats.pendingTransfer,
              order_ids: orders.map((order) => order.id),
              orders_snapshot: orders,
              settings_snapshot: settings,
            })
            .select()
            .single();

          if (isMissingCashClosuresTable(closureError)) {
            return json(
              {
                error: "Falta aplicar la migracion de cierres de caja antes de cerrar el dia.",
                migrationRequired: true,
              },
              { status: 400 },
            );
          }
          if (closureError) return json({ error: closureError.message }, { status: 500 });

          const { data: updatedSettings, error: updateError } = await (supabaseAdmin as any)
            .from("store_settings")
            .update({ is_open: false, current_day_started_at: null })
            .eq("store_id", DEFAULT_STORE_ID)
            .select()
            .single();

          if (updateError) return json({ error: updateError.message }, { status: 500 });

          return json({
            closure,
            summary: {
              openedAt: settings.current_day_started_at,
              closedAt,
              orders,
              settings,
            },
            settings: { ...DEFAULT_SETTINGS, ...updatedSettings },
          });
        }

        return json({ error: "Accion no permitida." }, { status: 400 });
      },
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
