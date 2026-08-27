import { createClient } from "@supabase/supabase-js";

const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !/127\.0\.0\.1|localhost/.test(url))
  throw new Error("Seeder bloqueado fuera de Supabase local.");
const db = createClient(url, key, { auth: { persistSession: false } });
const accounts = [
  {
    email: "owner@hotspot.test",
    password: "TestHotspot!2026",
    role: "owner",
    name: "Owner prueba",
  },
  {
    email: "operador@hotspot.test",
    password: "TestHotspot!2026",
    role: "operator",
    name: "Operador prueba",
  },
];
const listed = await db.auth.admin.listUsers({ page: 1, perPage: 100 });
if (listed.error) throw listed.error;
for (const account of accounts) {
  let user = listed.data.users.find((candidate) => candidate.email === account.email);
  if (!user) {
    const created = await db.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { name: account.name },
    });
    if (created.error || !created.data.user) throw created.error;
    user = created.data.user;
  }
  const { error: roleError } = await db
    .from("user_roles")
    .upsert({ user_id: user.id, role: account.role }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;
  if (account.role === "operator") {
    const { data: list, error: listError } = await db
      .from("stock_lists")
      .select("id")
      .eq("slug", "stock-general")
      .single();
    if (listError) throw listError;
    const { error: assignmentError } = await db
      .from("stock_list_assignments")
      .upsert({ list_id: list.id, user_id: user.id });
    if (assignmentError) throw assignmentError;
  }
}
console.log("Usuarios locales creados: owner@hotspot.test y operador@hotspot.test");
