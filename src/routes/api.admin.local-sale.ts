import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DEFAULT_SETTINGS, extraIngredientPrice, formatMoney } from "@/lib/admin";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { badRequest, json, methodNotAllowed } from "@/lib/server/customer-auth";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";
import {
  categoryAvailableForShift,
  type MenuShift,
  type Product,
  type ProductCategory,
} from "@/lib/products";

const localSaleSchema = z.object({
  customerName: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  customerPhone: z.string().trim().max(40).optional(),
  deliveryMethod: z.enum(["pickup", "delivery"]).default("pickup"),
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
  discountType: z.enum(["percent", "fixed"]).default("percent"),
  discountValue: z.number().finite().nonnegative().default(0),
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
    .min(1, "La comanda esta vacia.")
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

export const Route = createFileRoute("/api/admin/local-sale")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = await requireAdminOwner(request);
        if ("response" in admin) return admin.response;

        const body = await request.json().catch(() => null);
        const parsed = localSaleSchema.safeParse(body);
        if (!parsed.success)
          return badRequest("Datos invalidos para la venta local.", parsed.error.flatten());

        const input = parsed.data;
        if (input.deliveryMethod === "delivery" && !input.customerAddress?.trim()) {
          return badRequest("La direccion es obligatoria para delivery.");
        }
        const productIds = [...new Set(input.items.map((item) => item.productId))];

        const [
          { data: settingsData, error: settingsError },
          { data: productsData, error: productsError },
        ] = await Promise.all([
          (supabaseAdmin as any)
            .from("store_settings")
            .select("*")
            .eq("store_id", DEFAULT_STORE_ID)
            .limit(1)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("products")
            .select("*")
            .eq("store_id", DEFAULT_STORE_ID)
            .eq("available", true)
            .in("id", productIds),
        ]);

        if (settingsError) return json({ error: settingsError.message }, { status: 500 });
        if (productsError) return json({ error: productsError.message }, { status: 500 });

        if (!settingsData?.is_open || !settingsData.current_day_started_at) {
          return json(
            { error: "Tenes que abrir la caja antes de cargar una venta." },
            { status: 409 },
          );
        }

        const products = (productsData as Product[] | null) ?? [];
        if (products.length !== productIds.length) {
          return badRequest("Hay productos que ya no estan disponibles.");
        }

        const categoryKeys = [
          ...new Set(products.map((product) => product.category).filter(Boolean)),
        ];
        const { data: categoriesData, error: categoriesError } = await (supabaseAdmin as any)
          .from("product_categories")
          .select("*")
          .eq("store_id", DEFAULT_STORE_ID)
          .in("key", categoryKeys);

        if (categoriesError) return json({ error: categoriesError.message }, { status: 500 });

        const settings = { ...DEFAULT_SETTINGS, ...settingsData };
        const currentShift = (settings.current_menu_shift || "dinner") as MenuShift;
        if (currentShift === "midnight" && input.deliveryMethod === "delivery") {
          return badRequest("Durante madrugada solo se permite retiro local.");
        }
        const categories = new Map(
          ((categoriesData as ProductCategory[] | null) ?? []).map((category) => [
            category.key,
            category,
          ]),
        );
        const productsById = new Map(products.map((product) => [product.id, product]));

        for (const item of input.items) {
          const product = productsById.get(item.productId);
          const category = product ? categories.get(product.category) : undefined;
          if (!product || !categoryAvailableForShift(category, currentShift)) {
            return badRequest(`${product?.name ?? "El producto"} esta fuera del turno actual.`);
          }
        }

        const subtotal = input.items.reduce((sum, item) => {
          const product = productsById.get(item.productId);
          const extras = item.addedIngredients.reduce(
            (extraSum, ingredient) =>
              extraSum + (product ? extraIngredientPrice(product, ingredient) : 0),
            0,
          );
          return sum + (Number(product?.price ?? 0) + extras) * item.quantity;
        }, 0);
        const discountValue = Number(input.discountValue) || 0;
        const discountAmount =
          input.discountType === "percent"
            ? subtotal * (Math.min(100, discountValue) / 100)
            : discountValue;
        const safeDiscount = Math.min(subtotal, Math.max(0, discountAmount));
        const deliveryFee =
          input.deliveryMethod === "delivery" ? Number(input.deliveryFee) || 0 : 0;
        const total = Math.max(0, subtotal - safeDiscount + deliveryFee);
        if (input.paymentMethod === "dividido") {
          const cash = Number(input.paymentCashAmount || 0);
          const transfer = Number(input.paymentTransferAmount || 0);
          if (cash <= 0 || transfer <= 0 || Math.abs(cash + transfer - total) > 0.01) {
            return badRequest("El pago dividido no coincide con el total.");
          }
        }
        const discountLabel =
          safeDiscount > 0
            ? `Descuento ${input.discountType === "percent" ? `${discountValue}%` : formatMoney(discountValue)}: -${formatMoney(safeDiscount)}.`
            : "";
        const deliveryLabel = deliveryFee > 0 ? `Envio: ${formatMoney(deliveryFee)}.` : "";
        const orderNotes = ["Venta en local.", deliveryLabel, discountLabel, input.notes]
          .filter(Boolean)
          .join(" ");

        const orderPayload: Record<string, unknown> = {
          store_id: DEFAULT_STORE_ID,
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
          payment_status: "approved",
          notes: orderNotes || null,
          status: "confirmed",
          total,
        };

        let { data: order, error: orderError } = await (supabaseAdmin as any)
          .from("orders")
          .insert(orderPayload)
          .select("*")
          .single();

        if (
          orderError?.message?.includes("delivery_time") ||
          orderError?.message?.includes("payment_cash_amount") ||
          orderError?.message?.includes("payment_transfer_amount")
        ) {
          delete orderPayload.delivery_time;
          delete orderPayload.payment_cash_amount;
          delete orderPayload.payment_transfer_amount;
          const retry = await (supabaseAdmin as any)
            .from("orders")
            .insert(orderPayload)
            .select("*")
            .single();
          order = retry.data;
          orderError = retry.error;
        }

        if (orderError || !order) {
          return json(
            { error: orderError?.message ?? "No se pudo crear la venta local." },
            { status: 500 },
          );
        }

        const itemsPayload = input.items.map((item) => {
          const product = productsById.get(item.productId) as Product;
          return {
            order_id: order.id,
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

        const { error: itemsError } = await (supabaseAdmin as any)
          .from("order_items")
          .insert(itemsPayload);
        if (itemsError) {
          await (supabaseAdmin as any)
            .from("orders")
            .update({ status: "cancelled" })
            .eq("id", order.id);
          return json({ error: "No se pudieron cargar los items de la comanda." }, { status: 500 });
        }

        return json({ order: { ...order, order_items: itemsPayload }, total });
      },
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
