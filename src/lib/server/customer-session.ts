import { jwtVerify, SignJWT } from "jose";

export const CUSTOMER_SESSION_COOKIE = "hotspot_customer_session";
export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const DEFAULT_STORE_ID = 1;

export type CustomerSessionPayload = {
  customerId: string;
  storeId: number;
};

function getSessionSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Missing CUSTOMER_SESSION_SECRET. Set a random secret with at least 32 characters.",
    );
  }

  return new TextEncoder().encode(secret);
}

export async function createCustomerSessionToken(payload: CustomerSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${CUSTOMER_SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifyCustomerSessionToken(
  token: string,
): Promise<CustomerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (typeof payload.customerId !== "string" || typeof payload.storeId !== "number") return null;
    return {
      customerId: payload.customerId,
      storeId: payload.storeId,
    };
  } catch {
    return null;
  }
}

export function getCustomerSessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const cookies = cookie.split(";").map((part) => part.trim());
  const session = cookies.find((part) => part.startsWith(`${CUSTOMER_SESSION_COOKIE}=`));
  if (!session) return null;
  return decodeURIComponent(session.slice(CUSTOMER_SESSION_COOKIE.length + 1));
}

function isSecureRequest(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return (
    url.protocol === "https:" || forwardedProto === "https" || process.env.NODE_ENV === "production"
  );
}

function serializeCookie(name: string, value: string, request: Request, maxAge: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export function customerSessionCookie(token: string, request: Request) {
  return serializeCookie(CUSTOMER_SESSION_COOKIE, token, request, CUSTOMER_SESSION_TTL_SECONDS);
}

export function clearCustomerSessionCookie(request: Request) {
  return serializeCookie(CUSTOMER_SESSION_COOKIE, "", request, 0);
}
