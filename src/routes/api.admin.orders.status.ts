import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "pending",
    "pending_payment",
    "pending_confirmation",
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "rejected",
    "cancelled",
  ]),
});

export const Route = createFileRoute("/api/admin/orders/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;

        const body = await request.json().catch(() => null);
        const parsed = orderStatusSchema.safeParse(body);
        if (!parsed.success) {
          return json(
            {
              error: "Datos invalidos para actualizar el pedido.",
              details: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const [
          { data: settings, error: settingsError },
          { data: currentOrder, error: orderError },
        ] = await Promise.all([
          (supabaseAdmin as any)
            .from("store_settings")
            .select("is_open, current_day_started_at")
            .eq("store_id", DEFAULT_STORE_ID)
            .limit(1)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("orders")
            .select("id, created_at, payment_method")
            .eq("store_id", DEFAULT_STORE_ID)
            .eq("id", parsed.data.orderId)
            .maybeSingle(),
        ]);

        if (settingsError) return json({ error: settingsError.message }, { status: 500 });
        if (orderError) return json({ error: orderError.message }, { status: 500 });
        if (!currentOrder) return json({ error: "Pedido no encontrado." }, { status: 404 });
        if (
          !settings?.is_open ||
          !settings.current_day_started_at ||
          new Date(currentOrder.created_at) < new Date(settings.current_day_started_at)
        ) {
          return json(
            { error: "No se puede modificar el estado porque la caja de este pedido ya cerro." },
            { status: 409 },
          );
        }

        const isCash = currentOrder.payment_method === "efectivo";
        const paymentStatus =
          parsed.data.status === "confirmed"
            ? isCash
              ? "pending"
              : "approved"
            : parsed.data.status === "delivered" && isCash
              ? "approved"
              : ["rejected", "cancelled"].includes(parsed.data.status)
                ? "not_required"
                : null;
        const patch = paymentStatus
          ? { status: parsed.data.status, payment_status: paymentStatus }
          : { status: parsed.data.status };
        const { data: order, error } = await (supabaseAdmin as any)
          .from("orders")
          .update(patch)
          .eq("store_id", DEFAULT_STORE_ID)
          .eq("id", parsed.data.orderId)
          .select("*, order_items(*)")
          .single();

        if (error) return json({ error: error.message }, { status: 500 });
        return json({ order, patch });
      },
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
