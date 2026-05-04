import type { Product } from "@/lib/products";

export type OrderStatus =
  | "pending"
  | "pending_payment"
  | "pending_confirmation"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "rejected"
  | "cancelled";

export type PaymentStatus = "pending" | "approved" | "rejected" | "not_required";

export type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  base_ingredients?: string[] | null;
  removed_ingredients?: string[] | null;
  added_ingredients?: string[] | null;
  item_notes?: string | null;
};

export type AdminOrder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  delivery_method: string;
  payment_method?: string | null;
  payment_status?: PaymentStatus | null;
  payment_receipt_url?: string | null;
  notes: string | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items?: OrderItem[];
};

export type StockItem = {
  id: string;
  name: string;
  type: "product" | "ingredient";
  quantity: number;
  low_stock_threshold: number;
  available: boolean;
  updated_at?: string;
};

export type StoreSettings = {
  id?: string;
  store_name: string;
  logo_url: string | null;
  hours: string;
  contact_phone: string;
  address: string;
  transfer_alias: string;
  payment_methods: string[];
  accepts_cash: boolean;
  accepts_transfer: boolean;
  automatic_message: string;
  print_width_mm: number;
};

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "pending_payment",
  "pending_confirmation",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "rejected",
  "cancelled",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  pending_payment: "Pago pendiente",
  pending_confirmation: "Por confirmar",
  confirmed: "Confirmado",
  preparing: "En cocina",
  ready: "Listo",
  delivered: "Entregado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "border-yellow-400/40 bg-yellow-400/15 text-yellow-100",
  pending_payment: "border-yellow-400/40 bg-yellow-400/15 text-yellow-100",
  pending_confirmation: "border-orange-400/50 bg-orange-500/20 text-orange-100",
  confirmed: "border-emerald-400/50 bg-emerald-500/20 text-emerald-100",
  preparing: "border-sky-400/40 bg-sky-500/20 text-sky-100",
  ready: "border-lime-400/40 bg-lime-500/20 text-lime-100",
  delivered: "border-white/20 bg-white/10 text-white",
  rejected: "border-red-400/40 bg-red-500/20 text-red-100",
  cancelled: "border-zinc-500/40 bg-zinc-500/20 text-zinc-200",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  not_required: "No requiere",
};

export const DEFAULT_SETTINGS: StoreSettings = {
  store_name: "Hotspot",
  logo_url: "/src/assets/logo_hotspot.png",
  hours: "Todos los dias de 19:00 a 00:00",
  contact_phone: "+54 9 11 0000-0000",
  address: "Direccion del local",
  transfer_alias: "HOTSPOT.PEDIDOS",
  payment_methods: ["Efectivo", "Transferencia"],
  accepts_cash: true,
  accepts_transfer: true,
  automatic_message: "Recibimos tu pedido. Te avisamos cuando este confirmado.",
  print_width_mm: 80,
};

export const DEFAULT_INGREDIENTS: Record<string, string[]> = {
  burgers: ["Pan", "Medallon", "Queso", "Lechuga", "Tomate", "Cebolla", "Salsa"],
  sides: ["Sal", "Salsa"],
  drinks: [],
};

export function productIngredients(product: Pick<Product, "category" | "ingredients">) {
  return product.ingredients?.length ? product.ingredients : DEFAULT_INGREDIENTS[product.category] ?? [];
}

export function formatMoney(value: number | string) {
  return `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function shortOrderId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("54")) return digits;
  if (digits.length <= 11) return `54${digits}`;
  return digits;
}

export function buildOrderConfirmedWhatsAppUrl(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const phone = normalizeWhatsAppPhone(order.customer_phone);
  if (!phone) return null;

  const baseMessage =
    settings.automatic_message?.trim() ||
    `Hola ${order.customer_name}, tu pedido ${shortOrderId(order.id)} fue confirmado y ya esta en preparacion.`;
  const message = [
    baseMessage,
    "",
    `Pedido: ${shortOrderId(order.id)}`,
    `Total: ${formatMoney(order.total)}`,
    `Local: ${settings.store_name}`,
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(line: string, limit = 34) {
  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > limit) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  if (current) lines.push(current);
  return lines;
}

export function buildComandaLines(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const lines: string[] = [
    settings.store_name.toUpperCase(),
    "COMANDA COCINA",
    "------------------------------",
    `Pedido ${shortOrderId(order.id)}`,
    `Hora ${new Date(order.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
    `Cliente ${order.customer_name}`,
    `Tel ${order.customer_phone}`,
  ];

  if (order.customer_address) lines.push(`Dir ${order.customer_address}`);
  lines.push(`Pago ${order.payment_method || "A confirmar"}`);
  lines.push("------------------------------");

  order.order_items?.forEach((item) => {
    lines.push(`${item.quantity} x ${item.product_name}`.toUpperCase());
    if (item.removed_ingredients?.length) lines.push(`Sin: ${item.removed_ingredients.join(", ")}`);
    if (item.added_ingredients?.length) lines.push(`Extra: ${item.added_ingredients.join(", ")}`);
    if (item.item_notes) lines.push(`Obs: ${item.item_notes}`);
    lines.push("------------------------------");
  });

  if (order.notes) lines.push(`Notas: ${order.notes}`);
  lines.push(`Total ${formatMoney(order.total)}`);
  return lines.flatMap((line) => wrapLine(line));
}

export function downloadComandaPdf(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const lines = buildComandaLines(order, settings);
  const pageWidth = 226;
  const lineHeight = 12;
  const pageHeight = Math.max(360, 42 + lines.length * lineHeight);
  const content = lines
    .map((line, index) => `BT /F1 9 Tf 12 ${pageHeight - 24 - index * lineHeight} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comanda-${shortOrderId(order.id).replace("#", "")}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printComanda(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const lines = buildComandaLines(order, settings);
  const win = window.open("", "_blank", "width=360,height=640");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>Comanda ${shortOrderId(order.id)}</title>
        <style>
          @page { size: ${settings.print_width_mm}mm auto; margin: 4mm; }
          body { margin: 0; font-family: Courier, monospace; color: #000; background: #fff; font-size: 11px; }
          pre { white-space: pre-wrap; margin: 0; line-height: 1.35; }
        </style>
      </head>
      <body><pre>${lines.map((line) => line.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)).join("\n")}</pre></body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
