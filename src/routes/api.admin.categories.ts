import { createFileRoute } from "@tanstack/react-router";
import { badRequest, json, methodNotAllowed, readJson } from "@/lib/server/customer-auth";
import {
  deleteCategorySchema,
  deleteProductCategory,
  saveCategorySchema,
  saveProductCategory,
} from "@/lib/server/admin-config";

export const Route = createFileRoute("/api/admin/categories")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const parsed = saveCategorySchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        const category = await saveProductCategory(parsed.data);
        return json({ category });
      },
      DELETE: async ({ request }) => {
        const body = await readJson(request);
        const parsed = deleteCategorySchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        await deleteProductCategory(parsed.data.id);
        return json({ ok: true });
      },
      GET: methodNotAllowed,
    },
  },
});
