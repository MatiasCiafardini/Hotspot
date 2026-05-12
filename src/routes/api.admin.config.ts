import { createFileRoute } from "@tanstack/react-router";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";
import { listAdminConfig } from "@/lib/server/admin-config";

export const Route = createFileRoute("/api/admin/config")({
  server: {
    handlers: {
      GET: async () => {
        const config = await listAdminConfig();
        return json(config);
      },
      POST: methodNotAllowed,
    },
  },
});
