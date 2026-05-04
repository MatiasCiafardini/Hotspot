import bcrypt from "bcryptjs";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres.").max(128),
});

export const loginCustomerSchema = z.object({
  email: z.string().trim().email("Email invalido.").max(255),
  password: z.string().min(1, "La contrasena es obligatoria.").max(128),
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

export async function createEmailCustomer(input: z.infer<typeof registerCustomerSchema>, storeId = DEFAULT_STORE_ID) {
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

export async function customerSessionResponse(customer: CustomerRecord, request: Request, status = 200) {
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
