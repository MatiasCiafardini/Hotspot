import { createFileRoute } from "@tanstack/react-router";
import {
  badRequest,
  createCustomerOrder,
  createCustomerOrderSchema,
  getCurrentCustomer,
  json,
  methodNotAllowed,
  readJson,
  unauthorized,
} from "@/lib/server/customer-auth";
import { sendNewOrderPush } from "@/lib/server/push-notifications";

export const Route = createFileRoute("/api/store/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const customer = await getCurrentCustomer(request);
        if (!customer) return unauthorized("Para confirmar tu pedido necesitas iniciar sesion.");

        const body = await readJson(request);
        const parsed = createCustomerOrderSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos invalidos.", parsed.error.flatten());

        try {
          const order = await createCustomerOrder(customer, parsed.data);
          queueMicrotask(() => {
            void sendNewOrderPush(order, customer.store_id).catch((pushError) => {
              console.error("No se pudo enviar la notificacion del nuevo pedido.", pushError);
            });
          });
          return json({ order }, { status: 201 });
        } catch (error) {
          return badRequest(error instanceof Error ? error.message : "No pudimos crear el pedido.");
        }
      },
      GET: methodNotAllowed,
    },
  },
});
