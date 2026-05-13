import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findCustomerByEmail, normalizeEmail, type CustomerRecord } from "./customer-auth";
import { DEFAULT_STORE_ID } from "./customer-session";

const googleTokenSchema = z.object({
  sub: z.string().min(1),
  aud: z.string().min(1),
  email: z.string().email(),
  email_verified: z.union([z.boolean(), z.string()]).optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

export const googleLoginSchema = z.object({
  credential: z.string().trim().min(20, "La credencial de Google es invalida."),
});

export type GoogleCustomerProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
};

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID environment variable.");
  return clientId;
}

function parseEmailVerified(value: boolean | string | undefined) {
  return value === true || value === "true";
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleCustomerProfile> {
  const clientId = getGoogleClientId();
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );

  if (!response.ok) throw new Error("No pudimos validar la cuenta de Google.");

  const parsed = googleTokenSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("La respuesta de Google no es valida.");

  const token = parsed.data;
  if (token.aud !== clientId)
    throw new Error("La credencial de Google no corresponde a esta aplicacion.");

  const emailVerified = parseEmailVerified(token.email_verified);
  if (!emailVerified) throw new Error("Google no confirmo este email.");

  const email = normalizeEmail(token.email);

  return {
    googleId: token.sub,
    email,
    emailVerified,
    name: token.name?.trim() || email.split("@")[0],
    avatarUrl: token.picture || null,
  };
}

export async function loginOrCreateGoogleCustomer(
  profile: GoogleCustomerProfile,
  storeId = DEFAULT_STORE_ID,
) {
  const existing = await findCustomerByEmail(profile.email, storeId);

  if (existing) {
    if (!existing.is_active) throw new Error("Esta cuenta esta desactivada.");

    const patch: Partial<CustomerRecord> = {};
    if (!existing.google_id) patch.google_id = profile.googleId;
    if (!existing.avatar_url && profile.avatarUrl) patch.avatar_url = profile.avatarUrl;
    if (!existing.email_verified && profile.emailVerified) patch.email_verified = true;

    if (Object.keys(patch).length === 0) return existing;

    const { data, error } = await (supabaseAdmin as any)
      .from("customers")
      .update(patch)
      .eq("store_id", storeId)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return data as CustomerRecord;
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("customers")
    .insert({
      store_id: storeId,
      name: profile.name,
      email: profile.email,
      phone: null,
      password_hash: null,
      provider: "google",
      google_id: profile.googleId,
      avatar_url: profile.avatarUrl,
      email_verified: true,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as CustomerRecord;
}
