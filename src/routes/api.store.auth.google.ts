import { createFileRoute } from "@tanstack/react-router";
import {
  badRequest,
  customerSessionResponse,
  methodNotAllowed,
  readJson,
} from "@/lib/server/customer-auth";
import {
  googleLoginSchema,
  loginOrCreateGoogleCustomer,
  verifyGoogleCredential,
} from "@/lib/server/google-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

export const Route = createFileRoute("/api/store/auth/google")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const parsed = googleLoginSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        try {
          const profile = await verifyGoogleCredential(parsed.data.credential);
          const customer = await loginOrCreateGoogleCustomer(profile, DEFAULT_STORE_ID);
          return customerSessionResponse(customer, request);
        } catch (error) {
          return badRequest(
            error instanceof Error ? error.message : "No pudimos iniciar sesion con Google.",
          );
        }
      },
      GET: methodNotAllowed,
    },
  },
});
