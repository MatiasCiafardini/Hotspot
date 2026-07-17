import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";
import { badRequest, json, methodNotAllowed } from "@/lib/server/customer-auth";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const deleteSchema = z.object({ endpoint: z.string().url().max(2048) });

export const Route = createFileRoute("/api/admin/push/subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;
        const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return badRequest("Suscripcion Push invalida.");

        const { error } = await (supabaseAdmin as any).from("admin_push_subscriptions").upsert(
          {
            store_id: DEFAULT_STORE_ID,
            user_id: admin.user.id,
            endpoint: parsed.data.endpoint,
            p256dh: parsed.data.keys.p256dh,
            auth: parsed.data.keys.auth,
            user_agent: request.headers.get("user-agent"),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" },
        );
        if (error) return json({ error: error.message }, { status: 500 });
        return json({ active: true });
      },
      DELETE: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;
        const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return badRequest("Suscripcion Push invalida.");

        const { error } = await (supabaseAdmin as any)
          .from("admin_push_subscriptions")
          .delete()
          .eq("store_id", DEFAULT_STORE_ID)
          .eq("user_id", admin.user.id)
          .eq("endpoint", parsed.data.endpoint);
        if (error) return json({ error: error.message }, { status: 500 });
        return json({ active: false });
      },
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
    },
  },
});
