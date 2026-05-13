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

        const patch =
          parsed.data.status === "confirmed"
            ? { status: parsed.data.status, payment_status: "approved" }
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
