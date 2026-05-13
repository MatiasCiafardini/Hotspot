import { createFileRoute } from "@tanstack/react-router";
import {
  getCurrentCustomer,
  json,
  methodNotAllowed,
  publicCustomer,
} from "@/lib/server/customer-auth";

export const Route = createFileRoute("/api/store/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const customer = await getCurrentCustomer(request);
        return json({ customer: customer ? publicCustomer(customer) : null });
      },
      POST: methodNotAllowed,
    },
  },
});
