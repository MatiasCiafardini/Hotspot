import { createFileRoute } from "@tanstack/react-router";
import {
  getCurrentCustomer,
  getCustomerOrders,
  json,
  methodNotAllowed,
  unauthorized,
} from "@/lib/server/customer-auth";

export const Route = createFileRoute("/api/store/auth/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const customer = await getCurrentCustomer(request);
        if (!customer) return unauthorized();

        const orders = await getCustomerOrders(customer.id, customer.store_id);
        return json({ orders });
      },
      POST: methodNotAllowed,
    },
  },
});
