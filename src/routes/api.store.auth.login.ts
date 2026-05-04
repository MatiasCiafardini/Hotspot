import { createFileRoute } from "@tanstack/react-router";
import {
  badRequest,
  customerSessionResponse,
  findCustomerByEmail,
  loginCustomerSchema,
  methodNotAllowed,
  readJson,
  unauthorized,
  verifyCustomerPassword,
} from "@/lib/server/customer-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

export const Route = createFileRoute("/api/store/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const parsed = loginCustomerSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        const customer = await findCustomerByEmail(parsed.data.email, DEFAULT_STORE_ID);
        if (!customer || !customer.is_active || !customer.password_hash) {
          return unauthorized("Email o contrasena incorrectos.");
        }

        const valid = await verifyCustomerPassword(parsed.data.password, customer.password_hash);
        if (!valid) return unauthorized("Email o contrasena incorrectos.");

        return customerSessionResponse(customer, request);
      },
      GET: methodNotAllowed,
    },
  },
});
