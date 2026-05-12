import { createFileRoute } from "@tanstack/react-router";
import {
  createPasswordResetLink,
  forgotPasswordSchema,
  json,
  methodNotAllowed,
  readJson,
} from "@/lib/server/customer-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

export const Route = createFileRoute("/api/store/auth/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const parsed = forgotPasswordSchema.safeParse(body);
        if (parsed.success) {
          const resetUrl = await createPasswordResetLink(
            parsed.data.email,
            request,
            DEFAULT_STORE_ID,
          );
          if (resetUrl && process.env.NODE_ENV !== "production") {
            console.info(`[customer-password-reset] ${resetUrl}`);
          }

          return json({
            ok: true,
            resetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined,
          });
        }

        return json({ ok: true });
      },
      GET: methodNotAllowed,
    },
  },
});
