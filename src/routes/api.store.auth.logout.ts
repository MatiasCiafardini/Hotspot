import { createFileRoute } from "@tanstack/react-router";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";
import { clearCustomerSessionCookie } from "@/lib/server/customer-session";

export const Route = createFileRoute("/api/store/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        json(
          { ok: true },
          {
            headers: {
              "Set-Cookie": clearCustomerSessionCookie(request),
            },
          },
        ),
      GET: methodNotAllowed,
    },
  },
});
