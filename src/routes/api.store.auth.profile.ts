import { createFileRoute } from "@tanstack/react-router";
import {
  badRequest,
  getCurrentCustomer,
  json,
  methodNotAllowed,
  publicCustomer,
  readJson,
  unauthorized,
  updateCustomerProfile,
  updateCustomerProfileSchema,
} from "@/lib/server/customer-auth";

export const Route = createFileRoute("/api/store/auth/profile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const customer = await getCurrentCustomer(request);
        if (!customer) return unauthorized();

        const body = await readJson(request);
        const parsed = updateCustomerProfileSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        const updated = await updateCustomerProfile(customer.id, parsed.data, customer.store_id);
        return json({ customer: publicCustomer(updated) });
      },
      GET: methodNotAllowed,
    },
  },
});
