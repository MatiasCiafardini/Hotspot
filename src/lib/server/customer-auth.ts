import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extraIngredientPrice, productExtraIngredients, productIngredients } from "@/lib/admin";
import type { Product } from "@/lib/products";
import {
  createCustomerSessionToken,
  customerSessionCookie,
  DEFAULT_STORE_ID,
  getCustomerSessionToken,
  verifyCustomerSessionToken,
} from "./customer-session";

export type CustomerRecord = {
  id: string;
  store_id: number;
  name: string;
  email: string;
  phone: string | null;
  provider: "email" | "google";
  google_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  password_hash?: string | null;
};

export const registerCustomerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio.").max(120),
  email: z.string().trim().email("Email invalido.").max(255),
  phone: z.string().trim().min(6, "El telefono es obligatorio.").max(40),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(128),
});

export const loginCustomerSchema = z.object({
  email: z.string().trim().email("Email invalido.").max(255),
  password: z.string().min(1, "La contraseña es obligatoria.").max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email invalido.").max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "El token es invalido.").max(256),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(128),
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio.").max(120),
  phone: z.string().trim().min(6, "El telefono es obligatorio.").max(40),
});

export const createCustomerOrderSchema = z.object({
  customerName: z.string().trim().min(2, "El nombre es obligatorio.").max(120),
  customerPhone: z.string().trim().min(6, "El telefono es obligatorio.").max(40),
  deliveryMethod: z.enum(["pickup", "delivery"]),
  customerAddress: z.string().trim().max(255).nullable().optional(),
  deliveryTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "El horario de entrega es invalido.")
    .nullable()
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(500).nullable().optional(),
  paymentMethod: z.enum(["efectivo", "transferencia"]),
  total: z.number().finite().nonnegative().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().nullable().optional(),
        name: z.string().trim().min(1).max(160),
        price: z.number().finite().nonnegative(),
        quantity: z.number().int().positive().max(50),
        base_ingredients: z.array(z.string().max(80)).default([]),
        removed_ingredients: z.array(z.string().max(80)).default([]),
        added_ingredients: z.array(z.string().max(80)).default([]),
        item_notes: z.string().trim().max(240).nullable().optional(),
      }),
    )
    .min(1, "El carrito esta vacio.")
    .max(50),
});

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function publicCustomer(customer: CustomerRecord) {
  return {
    id: customer.id,
    storeId: customer.store_id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    provider: customer.provider,
    googleId: customer.google_id,
    avatarUrl: customer.avatar_url,
    isActive: customer.is_active,
    emailVerified: customer.email_verified,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function badRequest(message: string, details?: unknown) {
  return json({ error: message, details }, { status: 400 });
}

export function unauthorized(message = "No autenticado.") {
  return json({ error: message }, { status: 401 });
}

export function methodNotAllowed() {
  return json({ error: "Metodo no permitido." }, { status: 405 });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function hashCustomerPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyCustomerPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

function getPasswordResetBaseUrl(request: Request) {
  const configured = process.env.PASSWORD_RESET_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return url.origin;
}

export async function findCustomerByEmail(email: string, storeId = DEFAULT_STORE_ID) {
  const { data, error } = await (supabaseAdmin as any)
    .from("customers")
    .select("*")
    .eq("store_id", storeId)
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) throw error;
  return data as CustomerRecord | null;
}

export async function createPasswordResetLink(
  email: string,
  request: Request,
  storeId = DEFAULT_STORE_ID,
) {
  const customer = await findCustomerByEmail(email, storeId);
  if (!customer?.is_active || !customer.password_hash) return null;

  const token = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

  await (supabaseAdmin as any)
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("store_id", storeId)
    .eq("customer_id", customer.id)
    .is("used_at", null);

  const { error } = await (supabaseAdmin as any).from("password_reset_tokens").insert({
    store_id: storeId,
    customer_id: customer.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) throw error;

  return `${getPasswordResetBaseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function resetCustomerPassword(
  token: string,
  password: string,
  storeId = DEFAULT_STORE_ID,
) {
  const tokenHash = hashPasswordResetToken(token);
  const { data, error } = await (supabaseAdmin as any)
    .from("password_reset_tokens")
    .select("id, customer_id, expires_at, used_at")
    .eq("store_id", storeId)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.used_at || new Date(data.expires_at).getTime() <= Date.now()) {
    return false;
  }

  const passwordHash = await hashCustomerPassword(password);
  const now = new Date().toISOString();

  const { error: updateCustomerError } = await (supabaseAdmin as any)
    .from("customers")
    .update({ password_hash: passwordHash, provider: "email" })
    .eq("store_id", storeId)
    .eq("id", data.customer_id);

  if (updateCustomerError) throw updateCustomerError;

  const { error: updateTokenError } = await (supabaseAdmin as any)
    .from("password_reset_tokens")
    .update({ used_at: now })
    .eq("store_id", storeId)
    .eq("id", data.id);

  if (updateTokenError) throw updateTokenError;
  return true;
}

export async function findCustomerById(customerId: string, storeId = DEFAULT_STORE_ID) {
  const { data, error } = await (supabaseAdmin as any)
    .from("customers")
    .select("*")
    .eq("store_id", storeId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw error;
  return data as CustomerRecord | null;
}

export async function createEmailCustomer(
  input: z.infer<typeof registerCustomerSchema>,
  storeId = DEFAULT_STORE_ID,
) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashCustomerPassword(input.password);
  const { data, error } = await (supabaseAdmin as any)
    .from("customers")
    .insert({
      store_id: storeId,
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      password_hash: passwordHash,
      provider: "email",
      email_verified: false,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as CustomerRecord;
}

export async function updateCustomerProfile(
  customerId: string,
  input: z.infer<typeof updateCustomerProfileSchema>,
  storeId = DEFAULT_STORE_ID,
) {
  const { data, error } = await (supabaseAdmin as any)
    .from("customers")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim(),
    })
    .eq("store_id", storeId)
    .eq("id", customerId)
    .select("*")
    .single();

  if (error) throw error;
  return data as CustomerRecord;
}

export async function getCustomerOrders(customerId: string, storeId = DEFAULT_STORE_ID) {
  const { data, error } = await (supabaseAdmin as any)
    .from("orders")
    .select("*, order_items(*)")
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function createCustomerOrder(
  customer: CustomerRecord,
  input: z.infer<typeof createCustomerOrderSchema>,
) {
  const { data: settings, error: settingsError } = await (supabaseAdmin as any)
    .from("store_settings")
    .select(
      "is_open, current_day_started_at, current_menu_shift, accepts_cash, accepts_transfer, delivery_fee",
    )
    .eq("store_id", customer.store_id)
    .limit(1)
    .maybeSingle();

  if (settingsError) throw settingsError;
  if (!settings?.is_open || !settings.current_day_started_at) {
    throw new Error("El local esta cerrado. Volve a intentar cuando iniciemos el dia.");
  }
  if (input.paymentMethod === "efectivo" && !settings.accepts_cash) {
    throw new Error("El pago en efectivo no esta habilitado.");
  }
  if (input.paymentMethod === "transferencia" && !settings.accepts_transfer) {
    throw new Error("El pago por transferencia no esta habilitado.");
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const productIds = [...new Set(input.items.map((item) => item.product_id))];
  if (productIds.some((id) => !id || !uuidPattern.test(id))) {
    throw new Error("El carrito contiene un producto invalido. Volve a cargar el menu.");
  }

  const { data: products, error: productsError } = await (supabaseAdmin as any)
    .from("products")
    .select("id, name, price, category, available, ingredients, extra_ingredient_prices")
    .eq("store_id", customer.store_id)
    .in("id", productIds);
  if (productsError) throw productsError;
  if ((products ?? []).length !== productIds.length) {
    throw new Error("Uno de los productos ya no existe. Volve a cargar el menu.");
  }

  const categoryKeys = [
    ...new Set((products ?? []).map((product: Product) => product.category).filter(Boolean)),
  ];
  const { data: categories, error: categoriesError } = await (supabaseAdmin as any)
    .from("product_categories")
    .select("key, active, menu_shifts")
    .eq("store_id", customer.store_id)
    .in("key", categoryKeys);
  if (categoriesError) throw categoriesError;

  const productsById = new Map(
    (products ?? []).map((product: Product) => [product.id, product] as const),
  );
  const categoriesByKey = new Map(
    (categories ?? []).map((category: any) => [category.key, category] as const),
  );
  const authoritativeItems = input.items.map((item) => {
    const product = productsById.get(item.product_id || "");
    if (!product || !product.available) {
      throw new Error(`${product?.name || item.name} ya no esta disponible.`);
    }
    const category = categoriesByKey.get(product.category);
    const shifts = category?.menu_shifts?.length ? category.menu_shifts : ["lunch", "dinner"];
    if (category?.active === false || !shifts.includes(settings.current_menu_shift || "dinner")) {
      throw new Error(`${product.name} no esta disponible en este horario.`);
    }

    const allowedExtras = new Set(productExtraIngredients(product).map((extra) => extra.name));
    if (item.added_ingredients.some((ingredient) => !allowedExtras.has(ingredient))) {
      throw new Error(`${product.name} contiene un extra invalido.`);
    }
    const unitPrice =
      Number(product.price) +
      item.added_ingredients.reduce(
        (sum, ingredient) => sum + extraIngredientPrice(product, ingredient),
        0,
      );
    return { item, product, unitPrice };
  });

  if (settings.current_menu_shift === "midnight" && input.deliveryMethod === "delivery") {
    throw new Error("Durante madrugada solo tomamos pedidos para retiro.");
  }

  const orderPayload: Record<string, unknown> = {
    store_id: customer.store_id,
    customer_id: customer.id,
    customer_name: input.customerName.trim(),
    customer_phone: input.customerPhone.trim(),
    customer_address:
      input.deliveryMethod === "delivery" ? input.customerAddress?.trim() || null : null,
    delivery_method: input.deliveryMethod,
    delivery_time: input.deliveryTime ? input.deliveryTime.trim() : null,
    payment_method: input.paymentMethod,
    payment_status: "pending",
    notes: input.notes?.trim() || null,
    status: input.paymentMethod === "efectivo" ? "pending_confirmation" : "pending_payment",
    total:
      authoritativeItems.reduce((sum, { item, unitPrice }) => sum + unitPrice * item.quantity, 0) +
      (input.deliveryMethod === "delivery" ? Number(settings.delivery_fee || 0) : 0),
  };

  let { data, error } = await (supabaseAdmin as any)
    .from("orders")
    .insert(orderPayload)
    .select("*")
    .single();

  if (error?.message?.includes("delivery_time")) {
    delete orderPayload.delivery_time;
    const retry = await (supabaseAdmin as any)
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  const itemsPayload = authoritativeItems.map(({ item, product, unitPrice }) => ({
    order_id: data.id,
    product_id: product.id,
    product_name: product.name,
    unit_price: unitPrice,
    quantity: item.quantity,
    base_ingredients: productIngredients(product),
    removed_ingredients: item.removed_ingredients,
    added_ingredients: item.added_ingredients,
    item_notes: item.item_notes?.trim() || null,
  }));

  const { error: itemsError } = await (supabaseAdmin as any)
    .from("order_items")
    .insert(itemsPayload);
  if (itemsError) {
    const retryPayload = itemsPayload.map((item) => ({ ...item, product_id: null }));
    const { error: retryError } = await (supabaseAdmin as any)
      .from("order_items")
      .insert(retryPayload);
    if (retryError) throw retryError;
  }

  return { ...data, order_items: itemsPayload };
}

export async function customerSessionResponse(
  customer: CustomerRecord,
  request: Request,
  status = 200,
) {
  const token = await createCustomerSessionToken({
    customerId: customer.id,
    storeId: customer.store_id,
  });

  return json(
    { customer: publicCustomer(customer) },
    {
      status,
      headers: {
        "Set-Cookie": customerSessionCookie(token, request),
      },
    },
  );
}

export async function getCurrentCustomer(request: Request) {
  const token = getCustomerSessionToken(request);
  if (!token) return null;

  const session = await verifyCustomerSessionToken(token);
  if (!session) return null;

  const customer = await findCustomerById(session.customerId, session.storeId);
  if (!customer?.is_active) return null;

  return customer;
}
