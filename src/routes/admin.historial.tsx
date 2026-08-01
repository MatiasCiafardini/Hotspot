import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, MapPin, Package, Phone, Printer, ReceiptText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminApiFetch, readApiError } from "@/lib/admin-api";
import {
  AdminButton,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
} from "@/components/admin/AdminBits";
import {
  type CashClosure,
  DEFAULT_SETTINGS,
  formatDateTime,
  formatDeliveryTime,
  formatIngredientList,
  formatMoney,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  printComanda,
  shortOrderId,
  type AdminOrder,
  type OrderStatus,
  type StoreSettings,
} from "@/lib/admin";
import {
  CashSummaryDialog,
  type CashSummaryDialogData,
} from "@/components/admin/CashSummaryDialog";
import { MENU_SHIFT_LABEL } from "@/lib/products";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/historial")({
  head: () => ({
    meta: [{ title: "Historial admin - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [closures, setClosures] = useState<CashClosure[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<"orders" | "closures">("orders");
  const [cashSummary, setCashSummary] = useState<CashSummaryDialogData | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ date: "", status: "all", payment: "all", search: "" });

  useEffect(() => {
    (supabase as any)
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: AdminOrder[] | null }) => setOrders(data ?? []));

    (supabase as any)
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: StoreSettings | null }) => {
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      });

    adminApiFetch("/api/admin/day")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { closures?: CashClosure[] } | null) => setClosures(data?.closures ?? []))
      .catch(() => setClosures([]));
  }, []);

  const canEditOrderStatus = (order: AdminOrder) =>
    Boolean(
      settings.is_open &&
      settings.current_day_started_at &&
      new Date(order.created_at) >= new Date(settings.current_day_started_at),
    );

  const updateStatus = async (order: AdminOrder, status: OrderStatus) => {
    const previousStatus = order.status;
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, status } : item)),
    );

    try {
      const response = await adminApiFetch("/api/admin/orders/status", {
        method: "POST",
        body: JSON.stringify({ orderId: order.id, status }),
      });

      if (!response.ok) {
        const message = await readApiError(response, "No se pudo actualizar el pedido.");
        setOrders((current) =>
          current.map((item) =>
            item.id === order.id ? { ...item, status: previousStatus } : item,
          ),
        );
        return toast.error(message);
      }

      const data = await response.json().catch(() => null);
      if (data?.order) {
        setOrders((current) =>
          current.map((item) => (item.id === order.id ? { ...item, ...data.order } : item)),
        );
      }
    } catch (error) {
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? { ...item, status: previousStatus } : item)),
      );
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el pedido.");
    }
  };

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const matchesDate = !filters.date || order.created_at.slice(0, 10) === filters.date;
      const matchesStatus = filters.status === "all" || order.status === filters.status;
      const matchesPayment =
        filters.payment === "all" || (order.payment_method || "").toLowerCase() === filters.payment;
      const text = `${order.customer_name} ${order.customer_phone}`.toLowerCase();
      const matchesSearch = !filters.search || text.includes(filters.search.toLowerCase());
      return matchesDate && matchesStatus && matchesPayment && matchesSearch;
    });
  }, [orders, filters]);

  const toggleOrder = (orderId: string) => {
    setExpandedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Archivo"
        title="Historial"
        description="Pedidos y cierres de caja guardados para consulta e impresion."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <HistoryTabButton active={tab === "orders"} onClick={() => setTab("orders")}>
          Pedidos
        </HistoryTabButton>
        <HistoryTabButton active={tab === "closures"} onClick={() => setTab("closures")}>
          Cierres de caja
        </HistoryTabButton>
      </div>

      {tab === "orders" && (
        <>
          <div className="mb-5 grid gap-3 rounded-lg border border-white/10 bg-zinc-900/70 p-4 md:grid-cols-4">
            <AdminInput
              type="date"
              value={filters.date}
              onChange={(event) => setFilters({ ...filters, date: event.target.value })}
            />
            <AdminSelect
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="all">Todos los estados</option>
              {Object.keys(ORDER_STATUS_LABEL).map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABEL[status as OrderStatus]}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              value={filters.payment}
              onChange={(event) => setFilters({ ...filters, payment: event.target.value })}
            >
              <option value="all">Todos los pagos</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </AdminSelect>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <AdminInput
                className="pl-9"
                placeholder="Nombre o telefono"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
            <div className="grid grid-cols-[120px_1fr_120px_120px_120px] gap-3 border-b border-white/10 p-3 text-xs font-bold uppercase text-zinc-500 max-lg:hidden">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Total</span>
              <span>Acciones</span>
            </div>
            {filtered.map((order) => {
              const expanded = expandedOrderIds.has(order.id);
              return (
                <div key={order.id} className="border-b border-white/10 last:border-0">
                  <div className="grid gap-3 p-3 lg:grid-cols-[120px_1fr_120px_120px_120px] lg:items-center">
                    <button
                      type="button"
                      onClick={() => toggleOrder(order.id)}
                      className="flex items-center gap-2 text-left font-mono text-sm text-orange-300 hover:text-orange-200"
                      aria-expanded={expanded}
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                      {shortOrderId(order.id)}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleOrder(order.id)}
                      className="text-left"
                    >
                      <p className="font-semibold text-white">{order.customer_name}</p>
                      <p className="text-xs text-zinc-500">
                        {order.customer_phone} - {formatDateTime(order.created_at)}
                      </p>
                    </button>
                    {canEditOrderStatus(order) ? (
                      <AdminSelect
                        value={order.status}
                        onChange={(event) => updateStatus(order, event.target.value as OrderStatus)}
                      >
                        {Object.keys(ORDER_STATUS_LABEL).map((status) => (
                          <option key={status} value={status}>
                            {ORDER_STATUS_LABEL[status as OrderStatus]}
                          </option>
                        ))}
                      </AdminSelect>
                    ) : (
                      <span
                        className={`w-fit rounded-full border px-2 py-1 text-xs ${ORDER_STATUS_CLASS[order.status]}`}
                        title="No se puede modificar porque la caja de este pedido ya fue cerrada."
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    )}
                    <span className="font-display text-xl">{formatMoney(order.total)}</span>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton variant="ghost" onClick={() => toggleOrder(order.id)}>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                        <span className="sr-only">Ver detalle</span>
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        onClick={() => printComanda(order, DEFAULT_SETTINGS)}
                      >
                        <Printer className="h-4 w-4" />
                      </AdminButton>
                      {order.payment_receipt_url && (
                        <a href={order.payment_receipt_url} target="_blank" rel="noreferrer">
                          <AdminButton variant="ghost">Comprobante</AdminButton>
                        </a>
                      )}
                    </div>
                  </div>
                  {expanded && <HistoricalOrderDetail order={order} />}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-10 text-center text-zinc-500">No hay pedidos con esos filtros.</div>
            )}
          </div>
        </>
      )}

      {tab === "closures" && (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="grid grid-cols-[180px_120px_130px_130px_1fr_120px] gap-3 border-b border-white/10 p-3 text-xs font-bold uppercase text-zinc-500 max-lg:hidden">
            <span>Cierre</span>
            <span>Turno</span>
            <span>Pedidos</span>
            <span>Total</span>
            <span>Pagos</span>
            <span>Acciones</span>
          </div>
          {closures.map((closure) => (
            <button
              key={closure.id}
              type="button"
              onClick={() => setCashSummary(summaryFromClosure(closure))}
              className="grid w-full gap-3 border-b border-white/10 p-3 text-left transition-colors last:border-0 hover:bg-white/5 lg:grid-cols-[180px_120px_130px_130px_1fr_120px] lg:items-center"
            >
              <span className="text-sm text-zinc-200">{formatDateTime(closure.closed_at)}</span>
              <span className="w-fit rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-100">
                {MENU_SHIFT_LABEL[closure.menu_shift || "dinner"]}
              </span>
              <span className="text-sm text-zinc-300">
                {closure.chargeable_orders_count}/{closure.orders_count}
              </span>
              <span className="font-display text-xl text-white">
                {formatMoney(closure.total_sales)}
              </span>
              <span className="text-xs text-zinc-400">
                Efec. {formatMoney(closure.cash_total)} - Transf.{" "}
                {formatMoney(closure.transfer_approved_total)}
              </span>
              <span className="inline-flex w-fit items-center gap-2 text-sm font-bold text-orange-300">
                <ReceiptText className="h-4 w-4" /> Ver
              </span>
            </button>
          ))}
          {closures.length === 0 && (
            <div className="p-10 text-center text-zinc-500">Todavia no hay cierres guardados.</div>
          )}
        </div>
      )}

      <CashSummaryDialog
        open={Boolean(cashSummary)}
        data={cashSummary}
        onClose={() => setCashSummary(null)}
      />
    </>
  );
}

function HistoricalOrderDetail({ order }: { order: AdminOrder }) {
  const paymentLabel =
    order.payment_method === "efectivo"
      ? "Efectivo"
      : order.payment_method === "transferencia"
        ? "Transferencia"
        : order.payment_method === "dividido"
          ? "Pago dividido"
          : "A confirmar";

  return (
    <div className="border-t border-white/10 bg-black/30 p-4 lg:pl-[135px]">
      <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 xl:grid-cols-4">
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-orange-300" /> {order.customer_phone}
        </p>
        <p className="flex items-start gap-2">
          {order.delivery_method === "delivery" ? (
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
          ) : (
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
          )}
          {order.delivery_method === "delivery"
            ? order.customer_address || "Delivery sin dirección"
            : "Retiro en el local"}
        </p>
        <p>
          <span className="text-zinc-500">Pago:</span> {paymentLabel}
          {order.payment_method === "dividido" &&
            ` · ${formatMoney(Number(order.payment_cash_amount || 0))} efectivo + ${formatMoney(Number(order.payment_transfer_amount || 0))} transferencia`}
        </p>
        <p>
          <span className="text-zinc-500">Entrega:</span>{" "}
          {formatDeliveryTime(order.delivery_time) || "Sin horario"}
        </p>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {order.order_items?.length ? (
          order.order_items.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-zinc-900/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-white">
                  {item.quantity}× {item.product_name}
                </p>
                <p className="shrink-0 text-sm text-zinc-300">
                  {formatMoney(Number(item.unit_price) * item.quantity)}
                </p>
              </div>
              {item.removed_ingredients?.length ? (
                <p className="mt-2 text-xs text-red-200">
                  Sin: {formatIngredientList(item.removed_ingredients)}
                </p>
              ) : null}
              {item.added_ingredients?.length ? (
                <p className="mt-1 text-xs text-orange-100">
                  Extras: {formatIngredientList(item.added_ingredients)}
                </p>
              ) : null}
              {item.custom_extras?.length ? (
                <p className="mt-1 text-xs text-emerald-200">
                  Extras libres:{" "}
                  {item.custom_extras
                    .map((extra) => `${extra.name} (${formatMoney(extra.price)})`)
                    .join(", ")}
                </p>
              ) : null}
              {item.item_notes ? (
                <p className="mt-1 text-xs text-yellow-100">Obs: {item.item_notes}</p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">Este pedido no tiene ítems detallados.</p>
        )}
      </div>

      {order.notes && (
        <p className="mt-3 rounded-md border border-yellow-400/20 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          Notas: {order.notes}
        </p>
      )}
    </div>
  );
}

function HistoryTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-4 py-2 text-sm font-bold ${
        active
          ? "border-orange-400 bg-orange-500 text-black"
          : "border-white/15 bg-zinc-900 text-zinc-100 hover:border-orange-400/50"
      }`}
    >
      {children}
    </button>
  );
}

function summaryFromClosure(closure: CashClosure): CashSummaryDialogData {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(closure.settings_snapshot as StoreSettings | undefined),
    current_menu_shift: closure.menu_shift,
  };

  return {
    openedAt: closure.opened_at,
    closedAt: closure.closed_at,
    orders: (closure.orders_snapshot as AdminOrder[] | undefined) ?? [],
    settings,
  };
}
