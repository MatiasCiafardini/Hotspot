import { createSupabaseAdminClient, supabaseAdmin } from "@/integrations/supabase/client.server";
import { json } from "@/lib/server/customer-auth";

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAdminOwner(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { response: json({ error: "No autenticado." }, { status: 401 }) };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data.user;
  if (error || !user) {
    return { response: json({ error: "Sesion invalida." }, { status: 401 }) };
  }

  const { data: isOwner, error: roleError } = await (supabaseAdmin as any).rpc("has_role", {
    _user_id: user.id,
    _role: "owner",
  });

  if (roleError || !isOwner) {
    return { response: json({ error: "No tenes permisos para esta accion." }, { status: 403 }) };
  }

  return { user };
}

export async function requireStockUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) return { response: json({ error: "No autenticado." }, { status: 401 }) };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user)
    return { response: json({ error: "Sesion invalida." }, { status: 401 }) };
  const roleClient = createSupabaseAdminClient();
  const [{ data: isOwner, error: ownerError }, { data: isOperator, error: operatorError }] =
    await Promise.all([
      (roleClient as any).rpc("has_role", { _user_id: data.user.id, _role: "owner" }),
      (roleClient as any).rpc("has_role", { _user_id: data.user.id, _role: "operator" }),
    ]);
  const role = isOwner ? "owner" : isOperator ? "operator" : null;
  if (ownerError || operatorError || !role) {
    console.error("No se pudo resolver el rol de stock.", {
      userId: data.user.id,
      isOwner,
      isOperator,
      ownerError: ownerError?.message,
      operatorError: operatorError?.message,
    });
    return { response: json({ error: "No tenes permisos de stock." }, { status: 403 }) };
  }
  return { user: data.user, role } as const;
}
