import { createFileRoute } from "@tanstack/react-router";
import {
  badRequest,
  json,
  methodNotAllowed,
  readJson,
  resetCustomerPassword,
  resetPasswordSchema,
} from "@/lib/server/customer-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

export const Route = createFileRoute("/api/store/auth/reset-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const parsed = resetPasswordSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        const ok = await resetCustomerPassword(
          parsed.data.token,
          parsed.data.password,
          DEFAULT_STORE_ID,
        );
        if (!ok) return badRequest("El enlace vencio o ya fue usado.");

        return json({ ok: true });
      },
      GET: methodNotAllowed,
    },
  },
});
