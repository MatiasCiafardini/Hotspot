import { createFileRoute } from "@tanstack/react-router";
import {
  badRequest,
  createEmailCustomer,
  customerSessionResponse,
  findCustomerByEmail,
  methodNotAllowed,
  readJson,
  registerCustomerSchema,
} from "@/lib/server/customer-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

export const Route = createFileRoute("/api/store/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const parsed = registerCustomerSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        const existing = await findCustomerByEmail(parsed.data.email, DEFAULT_STORE_ID);
        if (existing) return badRequest("Ya existe una cuenta con ese email.");

        const customer = await createEmailCustomer(parsed.data, DEFAULT_STORE_ID);
        return customerSessionResponse(customer, request, 201);
      },
      GET: methodNotAllowed,
    },
  },
});
