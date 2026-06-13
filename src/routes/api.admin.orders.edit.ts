import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { extraIngredientPrice } from "@/lib/admin";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { badRequest, json, methodNotAllowed } from "@/lib/server/customer-auth";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";
import type { Product } from "@/lib/products";

const editOrderSchema = z.object({
  orderId: z.string().uuid(),
  customerName: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  customerPhone: z.string().trim().max(40),
  deliveryMethod: z.enum(["pickup", "delivery"]),
  deliveryFee: z.number().finite().nonnegative().default(0),
  customerAddress: z.string().trim().max(255).optional(),
  deliveryTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "El horario de entrega es invalido.")
    .optional()
    .or(z.literal("")),
  paymentMethod: z.enum(["efectivo", "transferencia", "dividido"]),
  paymentCashAmount: z.number().finite().nonnegative().nullable().optional(),
  paymentTransferAmount: z.number().finite().nonnegative().nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(50),
        removedIngredients: z.array(z.string().trim().max(80)).default([]),
        addedIngredients: z.array(z.string().trim().max(80)).default([]),
        notes: z.string().trim().max(240).optional(),
      }),
    )
    .min(1, "El pedido necesita al menos un item.")
    .max(50),
});

function productIngredients(product: Product) {
  return product.ingredients?.length
    ? product.ingredients
    : product.description
      ? product.description
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
}

export const Route = createFileRoute("/api/admin/orders/edit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;

        const body = await request.json().catch(() => null);
        const parsed = editOrderSchema.safeParse(body);
        if (!parsed.success) {
          return badRequest("Datos invalidos para editar el pedido.", parsed.error.flatten());
        }

        const input = parsed.data;
        if (input.deliveryMethod === "delivery" && !input.customerAddress?.trim()) {
          return badRequest("La direccion es obligatoria para delivery.");
        }

        const productIds = [...new Set(input.items.map((item) => item.productId))];
        const [
          { data: settings, error: settingsError },
          { data: currentOrder, error: orderError },
          { data: productsData, error: productsError },
        ] = await Promise.all([
          (supabaseAdmin as any)
            .from("store_settings")
            .select("is_open, current_day_started_at")
            .eq("store_id", DEFAULT_STORE_ID)
            .limit(1)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("orders")
            .select("id, created_at")
            .eq("store_id", DEFAULT_STORE_ID)
            .eq("id", input.orderId)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("products")
            .select("*")
            .eq("store_id", DEFAULT_STORE_ID)
            .in("id", productIds),
        ]);

        if (settingsError) return json({ error: settingsError.message }, { status: 500 });
        if (orderError) return json({ error: orderError.message }, { status: 500 });
        if (productsError) return json({ error: productsError.message }, { status: 500 });
        if (!currentOrder) return json({ error: "Pedido no encontrado." }, { status: 404 });
        if (
          !settings?.is_open ||
          !settings.current_day_started_at ||
          new Date(currentOrder.created_at) < new Date(settings.current_day_started_at)
        ) {
          return json(
            { error: "No se puede editar porque la caja de este pedido ya cerro." },
            { status: 409 },
          );
        }

        const products = (productsData as Product[] | null) ?? [];
        if (products.length !== productIds.length) {
          return badRequest("Hay productos que ya no estan disponibles.");
        }
        const productsById = new Map(products.map((product) => [product.id, product]));
        const subtotal = input.items.reduce((sum, item) => {
          const product = productsById.get(item.productId);
          const extras = item.addedIngredients.reduce(
            (extraSum, ingredient) =>
              extraSum + (product ? extraIngredientPrice(product, ingredient) : 0),
            0,
          );
          return sum + (Number(product?.price ?? 0) + extras) * item.quantity;
        }, 0);
        const deliveryFee =
          input.deliveryMethod === "delivery" ? Number(input.deliveryFee) || 0 : 0;
        const total = subtotal + deliveryFee;

        if (input.paymentMethod === "dividido") {
          const cash = Number(input.paymentCashAmount || 0);
          const transfer = Number(input.paymentTransferAmount || 0);
          if (cash <= 0 || transfer <= 0 || Math.abs(cash + transfer - total) > 0.01) {
            return badRequest("El pago dividido no coincide con el total.");
          }
        }

        const orderPatch = {
          customer_name: input.customerName,
          customer_phone: input.customerPhone || "Sin telefono",
          customer_address:
            input.deliveryMethod === "delivery" ? input.customerAddress?.trim() || null : null,
          delivery_method: input.deliveryMethod,
          delivery_time: input.deliveryTime ? input.deliveryTime.trim() : null,
          payment_method: input.paymentMethod,
          payment_cash_amount:
            input.paymentMethod === "dividido" ? Number(input.paymentCashAmount || 0) : null,
          payment_transfer_amount:
            input.paymentMethod === "dividido" ? Number(input.paymentTransferAmount || 0) : null,
          notes: input.notes?.trim() || null,
          total,
        };

        const { error: updateError } = await (supabaseAdmin as any)
          .from("orders")
          .update(orderPatch)
          .eq("store_id", DEFAULT_STORE_ID)
          .eq("id", input.orderId);
        if (updateError) return json({ error: updateError.message }, { status: 500 });

        const { error: deleteError } = await (supabaseAdmin as any)
          .from("order_items")
          .delete()
          .eq("order_id", input.orderId);
        if (deleteError) return json({ error: deleteError.message }, { status: 500 });

        const itemsPayload = input.items.map((item) => {
          const product = productsById.get(item.productId) as Product;
          return {
            order_id: input.orderId,
            product_id: product.id,
            product_name: product.name,
            unit_price:
              Number(product.price) +
              item.addedIngredients.reduce(
                (sum, ingredient) => sum + extraIngredientPrice(product, ingredient),
                0,
              ),
            quantity: item.quantity,
            base_ingredients: productIngredients(product),
            removed_ingredients: item.removedIngredients,
            added_ingredients: item.addedIngredients,
            item_notes: item.notes || null,
          };
        });

        const { error: insertError } = await (supabaseAdmin as any)
          .from("order_items")
          .insert(itemsPayload);
        if (insertError) return json({ error: insertError.message }, { status: 500 });

        const { data: order, error: reloadError } = await (supabaseAdmin as any)
          .from("orders")
          .select("*, order_items(*)")
          .eq("store_id", DEFAULT_STORE_ID)
          .eq("id", input.orderId)
          .single();

        if (reloadError) return json({ error: reloadError.message }, { status: 500 });
        return json({ order });
      },
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
