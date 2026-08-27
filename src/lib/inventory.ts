export type InventoryRole = "owner" | "operator";

export type InventoryItem = {
  id: string;
  name: string;
  type: "product" | "ingredient";
  quantity: number;
  low_stock_threshold: number;
  target_stock: number | null;
  unit: string;
  sku: string | null;
  allow_negative: boolean;
  available: boolean;
  updated_at: string;
  step?: number;
  supplier_ids?: string[];
  primary_supplier_id?: string | null;
};

export type StockList = {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  item_count?: number;
  low_count?: number;
  updated_at?: string;
  last_count_at?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  address: string;
  business_hours: string;
  notes: string;
  active: boolean;
};

export function suggestedPurchase(item: Pick<InventoryItem, "quantity" | "target_stock">) {
  if (item.target_stock == null) return null;
  return Math.max(0, Number(item.target_stock) - Number(item.quantity));
}

export function normalizeWhatsAppPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function buildSupplierMessage(
  supplier: Pick<Supplier, "name">,
  items: Array<{ name: string; quantity: number; unit: string }>,
  notes = "",
) {
  return [
    `Hola ${supplier.name}, somos Hotspot. Queremos realizar el siguiente pedido:`,
    "",
    ...items.map((item) => `- ${item.name}: ${item.quantity} ${item.unit}`),
    notes.trim() ? "" : null,
    notes.trim() ? `Observaciones: ${notes.trim()}` : null,
    "",
    "Gracias.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function downloadInventoryCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printInventoryReport(title: string, headers: string[], rows: string[][]) {
  const escape = (value: string) =>
    value.replace(
      /[<>&"]/g,
      (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char]!,
    );
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${escape(title)}</title><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:24px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #bbb;padding:8px;text-align:left}th{background:#eee}@media print{button{display:none}}
  </style></head><body><button onclick="window.print()">Guardar como PDF / Imprimir</button><h1>${escape(title)}</h1>
  <p>Emitido: ${escape(new Date().toLocaleString("es-AR"))}</p><table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${escape(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
}
