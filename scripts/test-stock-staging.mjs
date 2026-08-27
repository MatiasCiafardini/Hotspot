import { createClient } from "@supabase/supabase-js";

const url = process.env.STAGING_SUPABASE_URL;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey)
  throw new Error("Faltan STAGING_SUPABASE_URL y STAGING_SUPABASE_SERVICE_ROLE_KEY.");
if (!/127\.0\.0\.1|localhost/.test(url) && process.env.ALLOW_REMOTE_STAGING !== "true") {
  throw new Error(
    "Prueba bloqueada: el destino no es local. Usa ALLOW_REMOTE_STAGING=true solo para staging remoto.",
  );
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const requiredTables = [
  "stock_items",
  "stock_lists",
  "stock_list_items",
  "suppliers",
  "stock_counts",
  "purchase_orders",
];
for (const table of requiredTables) {
  const { error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
}

const [{ data: items }, { data: backup }, { data: lists }, { data: suppliers }] = await Promise.all(
  [
    db.from("stock_items").select("id,name,quantity,low_stock_threshold,available"),
    db
      .from("stock_items_pre_manual_control_backup")
      .select("id,name,quantity,low_stock_threshold,available"),
    db.from("stock_lists").select("id,slug"),
    db.from("suppliers").select("id,name"),
  ],
);
if (!items?.length) throw new Error("No hay items de stock para probar.");
if (!backup?.length) throw new Error("El respaldo previo a la migracion esta vacio.");
const currentById = new Map(items.map((item) => [item.id, item]));
for (const saved of backup) {
  const current = currentById.get(saved.id);
  if (
    !current ||
    current.name !== saved.name ||
    Number(current.quantity) !== Number(saved.quantity) ||
    Number(current.low_stock_threshold) !== Number(saved.low_stock_threshold) ||
    current.available !== saved.available
  ) {
    throw new Error(`La migracion no preservo el item ${saved.id}.`);
  }
}
if (!lists?.some((list) => list.slug === "stock-general"))
  throw new Error("Falta la lista Stock general.");
if ((suppliers?.length ?? 0) < 2) throw new Error("No se cargaron proveedores de prueba.");
console.log(
  JSON.stringify(
    {
      ok: true,
      stockItems: items.length,
      backedUpItems: backup.length,
      lists: lists.length,
      suppliers: suppliers.length,
    },
    null,
    2,
  ),
);
