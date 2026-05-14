import type { Product } from "@/lib/products";
import { MENU_SHIFT_LABEL, type MenuShift } from "@/lib/products";
import logoHotspotUrl from "@/assets/logo_hotspot.png?url";

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
  delivery_time?: string | null;
  payment_method?: string | null;
  payment_cash_amount?: number | null;
  payment_transfer_amount?: number | null;
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
  is_open?: boolean;
  current_day_started_at?: string | null;
  current_menu_shift?: MenuShift;
};

export type CashClosure = {
  id: string;
  store_id?: number;
  opened_at: string;
  closed_at: string;
  menu_shift: MenuShift;
  orders_count: number;
  chargeable_orders_count: number;
  rejected_orders_count: number;
  total_sales: number;
  cash_total: number;
  transfer_approved_total: number;
  transfer_pending_total: number;
  order_ids?: string[];
  orders_snapshot?: AdminOrder[];
  settings_snapshot?: StoreSettings;
  created_at?: string;
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
  logo_url: logoHotspotUrl,
  hours:
    "Almuerzo Mie-Sab 11:30 a 14:30. Cena Mie-Sab 19:30 a 23:30 y Dom 19:00 a 23:30. Viernes y sabado: cena hasta 23:30. Luego menu madrugada hasta 05:00, solo retiro.",
  contact_phone: "+54 9 11 0000-0000",
  address: "Direccion del local",
  transfer_alias: "HOTSPOT.PEDIDOS",
  payment_methods: ["Efectivo", "Transferencia"],
  accepts_cash: true,
  accepts_transfer: true,
  automatic_message: "Recibimos tu pedido. Te avisamos cuando este confirmado.",
  print_width_mm: 58,
  is_open: false,
  current_day_started_at: null,
  current_menu_shift: "dinner",
};

export const DEFAULT_INGREDIENTS: Record<string, string[]> = {
  burgers: ["Pan", "Medallon", "Queso", "Lechuga", "Tomate", "Cebolla", "Salsa"],
  sides: ["Sal", "Salsa"],
  drinks: [],
};

export type ExtraIngredientOption = {
  name: string;
  price: number;
};

export const DEFAULT_EXTRA_INGREDIENT_PRICES: Record<string, number> = {
  "Carne y cheddar": 3500,
  Carne: 3500,
  Lechuga: 1000,
  Cebolla: 1000,
  Tomate: 1000,
  Pepinillos: 1000,
  "Cebolla crispy": 1500,
  "Cebolla caramelizada": 1500,
  "Aros de cebolla": 1500,
  "Chedar feta": 1000,
  "Huevo frito": 1500,
  "Chedar liquido": 2000,
  Mayonesa: 1000,
  Mostaza: 1000,
  Ketchup: 1000,
  BBQ: 1000,
  Barbacoa: 1000,
};

function normalizeIngredientKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isMeatIngredient(ingredient: string) {
  const normalized = normalizeIngredientKey(ingredient);
  return normalized.includes("carne") || normalized.includes("medallon");
}

function isCheddarIngredient(ingredient: string) {
  const normalized = normalizeIngredientKey(ingredient);
  return normalized.includes("cheddar") || normalized.includes("chedar");
}

function defaultExtraNameForIngredient(ingredient: string) {
  const normalized = normalizeIngredientKey(ingredient);
  if (normalized.includes("lechuga")) return "Lechuga";
  if (normalized.includes("tomate")) return "Tomate";
  if (normalized.includes("pepinillo")) return "Pepinillos";
  if (normalized.includes("aro") && normalized.includes("cebolla")) return "Aros de cebolla";
  if (
    normalized.includes("cebolla crispy") ||
    normalized.includes("cebollita crispy") ||
    normalized.includes("cebolla crispi")
  ) {
    return "Cebolla crispy";
  }
  if (normalized.includes("cebolla caramel") || normalized.includes("cebollita caramel")) {
    return "Cebolla caramelizada";
  }
  if (normalized === "cebolla" || normalized.includes("cebolla cruda")) return "Cebolla";
  if (normalized.includes("huevo")) return "Huevo frito";
  if (
    normalized.includes("cheddar liquido") ||
    normalized.includes("chedar liquido") ||
    normalized.includes("cheddar fundido")
  ) {
    return "Chedar liquido";
  }
  if (isCheddarIngredient(ingredient)) return "Chedar feta";
  if (normalized.includes("mayonesa")) return "Mayonesa";
  if (normalized.includes("mostaza")) return "Mostaza";
  if (normalized.includes("ketchup") || normalized.includes("quetchup")) return "Ketchup";
  if (normalized.includes("bbq")) return "BBQ";
  if (normalized.includes("barbacoa")) return "Barbacoa";
  return null;
}

export function productIngredients(product: Pick<Product, "category" | "ingredients">) {
  return product.ingredients?.length
    ? product.ingredients
    : (DEFAULT_INGREDIENTS[product.category] ?? []);
}

export function buildExtraIngredientOptions(
  ingredients: string[],
  priceOverrides: Record<string, number> = {},
) {
  const hasMeat = ingredients.some(isMeatIngredient);
  const hasCheddar = ingredients.some(isCheddarIngredient);
  const options: ExtraIngredientOption[] = [];
  const seen = new Set<string>();

  const addOption = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    options.push({
      name,
      price: Number(priceOverrides[name] ?? DEFAULT_EXTRA_INGREDIENT_PRICES[name] ?? 0),
    });
  };

  if (hasMeat && hasCheddar) addOption("Carne y cheddar");
  if (hasMeat && !hasCheddar) addOption("Carne");

  ingredients.forEach((ingredient) => {
    if (isMeatIngredient(ingredient)) return;
    if (hasMeat && hasCheddar && isCheddarIngredient(ingredient)) return;
    const optionName = defaultExtraNameForIngredient(ingredient);
    if (optionName) addOption(optionName);
  });

  return options;
}

export function productExtraIngredients(
  product: Pick<Product, "category" | "ingredients" | "extra_ingredient_prices">,
) {
  return buildExtraIngredientOptions(
    productIngredients(product),
    product.extra_ingredient_prices ?? {},
  );
}

export function extraIngredientPrice(
  product: Pick<Product, "extra_ingredient_prices">,
  ingredient: string,
) {
  return Number(
    product.extra_ingredient_prices?.[ingredient] ??
      DEFAULT_EXTRA_INGREDIENT_PRICES[ingredient] ??
      0,
  );
}

export function formatMoney(value: number | string) {
  return `$${Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function shortOrderId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

const TICKET_SEPARATOR = "----------------------";

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDeliveryTime(value: string | null | undefined) {
  if (!value) return null;
  const [hour, minute] = value.split(":");
  if (!hour || !minute) return value;
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function formatIngredientList(ingredients: string[] | null | undefined) {
  if (!ingredients?.length) return "";
  const counts = ingredients.reduce<Map<string, number>>((map, ingredient) => {
    map.set(ingredient, (map.get(ingredient) ?? 0) + 1);
    return map;
  }, new Map());
  return [...counts.entries()]
    .map(([ingredient, quantity]) => (quantity > 1 ? `${quantity} x ${ingredient}` : ingredient))
    .join(", ");
}

function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("54")) return digits;
  if (digits.length <= 11) return `54${digits}`;
  return digits;
}

export function buildOrderConfirmedWhatsAppUrl(
  order: AdminOrder,
  settings: StoreSettings = DEFAULT_SETTINGS,
) {
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

function getPrintLogoUrl(settings: StoreSettings) {
  const logoUrl = settings.logo_url?.trim();
  if (!logoUrl || logoUrl === "/src/assets/logo_hotspot.png") return logoHotspotUrl;
  return logoUrl;
}

function escapeHtml(value: string) {
  return value.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!,
  );
}

export function buildComandaLines(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const lines: string[] = [
    settings.store_name.toUpperCase(),
    "COMANDA COCINA",
    TICKET_SEPARATOR,
    `Pedido ${shortOrderId(order.id)}`,
    `Hora ${new Date(order.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
    `Cliente ${order.customer_name}`,
    `Tel ${order.customer_phone}`,
    `Entrega ${order.delivery_method === "delivery" ? "Delivery" : "Retiro local"}`,
  ];

  const deliveryTime = formatDeliveryTime(order.delivery_time);
  if (deliveryTime) lines.push(`Horario entrega ${deliveryTime}`);
  if (order.customer_address) lines.push(`Domicilio ${order.customer_address}`);
  if (order.payment_method === "dividido") {
    lines.push("Pago dividido");
    lines.push(`Efectivo ${formatMoney(order.payment_cash_amount || 0)}`);
    lines.push(`Transfer ${formatMoney(order.payment_transfer_amount || 0)}`);
  } else {
    lines.push(`Pago ${order.payment_method || "A confirmar"}`);
  }
  lines.push(TICKET_SEPARATOR);

  order.order_items?.forEach((item) => {
    lines.push(`${item.quantity} x ${item.product_name}`.toUpperCase());
    if (item.removed_ingredients?.length)
      lines.push(`Sin: ${formatIngredientList(item.removed_ingredients)}`);
    if (item.added_ingredients?.length)
      lines.push(`Extra: ${formatIngredientList(item.added_ingredients)}`);
    if (item.item_notes) lines.push(`Obs: ${item.item_notes}`);
    lines.push(TICKET_SEPARATOR);
  });

  if (order.notes) lines.push(`Notas: ${order.notes}`);
  lines.push(`Total ${formatMoney(order.total)}`);
  return lines.flatMap((line) => wrapLine(line));
}

export function downloadComandaPdf(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const lines = buildComandaLines(order, settings);
  const pageWidth = 226;
  const lineHeight = 14;
  const pageHeight = Math.max(360, 42 + lines.length * lineHeight);
  const content = lines
    .map(
      (line, index) =>
        `BT /F1 10 Tf 12 ${pageHeight - 24 - index * lineHeight} Td (${escapePdfText(line)}) Tj ET`,
    )
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

function buildComandaHtml(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const lines = buildComandaLines(order, settings);
  const printWidthMm = Math.min(
    58,
    Math.max(48, Number(settings.print_width_mm) || DEFAULT_SETTINGS.print_width_mm),
  );
  const logoUrl = new URL(getPrintLogoUrl(settings), window.location.origin).href;
  const ticketText = lines.map(escapeHtml).join("\n");

  return `
    <html>
      <head>
        <title>Comanda ${shortOrderId(order.id)}</title>
        <style>
          @page { margin: 0; }
          html, body { margin: 0; min-height: 0; }
          body {
            box-sizing: border-box;
            font-family: Courier, monospace;
            color: #000;
            background: #fff;
            font-size: 13px;
          }
          .ticket {
            box-sizing: border-box;
            width: ${printWidthMm}mm;
            padding: 4mm;
          }
          .logo {
            display: block;
            width: 28mm;
            max-width: 100%;
            height: auto;
            margin: 0 auto 3mm;
            filter: grayscale(1) contrast(1.2);
          }
          pre { white-space: pre-wrap; margin: 0; line-height: 1.4; overflow: visible; }
          @media print {
            body { width: ${printWidthMm}mm; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <img class="logo" src="${escapeHtml(logoUrl)}" alt="Hotspot" />
          <pre>${ticketText}</pre>
        </div>
      </body>
    </html>
  `;
}

function printWithBrowserDialog(html: string) {
  const win = window.open("", "_blank", "width=360,height=640");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  const logo = win.document.querySelector("img");
  const print = () => window.setTimeout(() => win.print(), 150);
  if (logo && !logo.complete) {
    logo.addEventListener("load", print, { once: true });
    logo.addEventListener("error", print, { once: true });
  } else {
    print();
  }
}

export function printComanda(order: AdminOrder, settings: StoreSettings = DEFAULT_SETTINGS) {
  const html = buildComandaHtml(order, settings);
  printWithBrowserDialog(html);
}

export type CashSummary = {
  openedAt: string;
  closedAt: string;
  orders: AdminOrder[];
  settings: StoreSettings;
};

function normalizePaymentMethod(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePaymentStatus(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isTransferPayment(order: AdminOrder) {
  const method = normalizePaymentMethod(order.payment_method);
  return method.includes("transfer");
}

function isCashPayment(order: AdminOrder) {
  const method = normalizePaymentMethod(order.payment_method);
  return method === "efectivo" || method === "cash";
}

function isApprovedPayment(order: AdminOrder) {
  const status = normalizePaymentStatus(order.payment_status);
  return status === "approved" || status === "aprobado";
}

export function deriveCashSummaryStats(orders: AdminOrder[]) {
  const validOrders = orders.filter((order) => !["rejected", "cancelled"].includes(order.status));
  const rejectedOrders = orders.filter((order) => ["rejected", "cancelled"].includes(order.status));
  const approvedTransfer = validOrders
    .filter((order) => isApprovedPayment(order))
    .reduce((sum, order) => {
      if (order.payment_method === "dividido")
        return sum + Number(order.payment_transfer_amount || 0);
      return isTransferPayment(order) ? sum + Number(order.total) : sum;
    }, 0);
  const pendingTransfer = validOrders
    .filter((order) => !isApprovedPayment(order))
    .reduce((sum, order) => {
      if (order.payment_method === "dividido")
        return sum + Number(order.payment_transfer_amount || 0);
      return isTransferPayment(order) ? sum + Number(order.total) : sum;
    }, 0);
  const cash = validOrders.reduce((sum, order) => {
    if (order.payment_method === "dividido") return sum + Number(order.payment_cash_amount || 0);
    return isCashPayment(order) ? sum + Number(order.total) : sum;
  }, 0);
  const total = validOrders.reduce((sum, order) => sum + Number(order.total), 0);

  return {
    ordersCount: orders.length,
    chargeableOrdersCount: validOrders.length,
    rejectedOrdersCount: rejectedOrders.length,
    approvedTransfer,
    pendingTransfer,
    cash,
    total,
  };
}

export function buildCashSummaryLines({ openedAt, closedAt, orders, settings }: CashSummary) {
  const stats = deriveCashSummaryStats(orders);
  const validOrders = orders.filter((order) => !["rejected", "cancelled"].includes(order.status));

  return [
    settings.store_name.toUpperCase(),
    "CIERRE DE CAJA",
    TICKET_SEPARATOR,
    `Apertura ${formatDateTime(openedAt)}`,
    `Cierre ${formatDateTime(closedAt)}`,
    `Turno ${settings.current_menu_shift ? MENU_SHIFT_LABEL[settings.current_menu_shift] : "Sin turno"}`,
    TICKET_SEPARATOR,
    `Pedidos totales ${stats.ordersCount}`,
    `Pedidos cobrables ${stats.chargeableOrdersCount}`,
    `Rechazados/cancelados ${stats.rejectedOrdersCount}`,
    TICKET_SEPARATOR,
    `Total vendido ${formatMoney(stats.total)}`,
    `Transfer aprobado ${formatMoney(stats.approvedTransfer)}`,
    `Transfer pendiente ${formatMoney(stats.pendingTransfer)}`,
    `Efectivo ${formatMoney(stats.cash)}`,
    TICKET_SEPARATOR,
    ...validOrders.map(
      (order) =>
        `${shortOrderId(order.id)} ${formatMoney(order.total)} ${ORDER_STATUS_LABEL[order.status]}`,
    ),
  ].flatMap((line) => wrapLine(line));
}

export function printCashSummary(summary: CashSummary) {
  const lines = buildCashSummaryLines(summary);
  const printWidthMm = Math.min(
    58,
    Math.max(48, Number(summary.settings.print_width_mm) || DEFAULT_SETTINGS.print_width_mm),
  );
  const ticketText = lines.map(escapeHtml).join("\n");
  const html = `
    <html>
      <head>
        <title>Cierre de caja</title>
        <style>
          @page { margin: 0; }
          html, body { margin: 0; min-height: 0; }
          body {
            box-sizing: border-box;
            font-family: Courier, monospace;
            color: #000;
            background: #fff;
            font-size: 11px;
          }
          .ticket {
            box-sizing: border-box;
            width: ${printWidthMm}mm;
            padding: 4mm;
          }
          pre { white-space: pre-wrap; margin: 0; line-height: 1.35; overflow: visible; }
          @media print {
            body { width: ${printWidthMm}mm; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <pre>${ticketText}</pre>
        </div>
      </body>
    </html>
  `;
  printWithBrowserDialog(html);
}
