import { createFileRoute } from "@tanstack/react-router";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { getVapidPublicKey } from "@/lib/server/push-notifications";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";

export const Route = createFileRoute("/api/admin/push/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;
        const publicKey = getVapidPublicKey();
        if (!publicKey) {
          return json({ error: "Las notificaciones Push no estan configuradas." }, { status: 503 });
        }
        return json({ publicKey });
      },
      POST: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
