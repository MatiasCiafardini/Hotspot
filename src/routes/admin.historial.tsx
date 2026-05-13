import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, ReceiptText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminApiFetch } from "@/lib/admin-api";
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

export const Route = createFileRoute("/admin/historial")({
  head: () => ({
    meta: [{ title: "Historial admin - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [closures, setClosures] = useState<CashClosure[]>([]);
  const [tab, setTab] = useState<"orders" | "closures">("orders");
  const [cashSummary, setCashSummary] = useState<CashSummaryDialogData | null>(null);
  const [filters, setFilters] = useState({ date: "", status: "all", payment: "all", search: "" });

  useEffect(() => {
    (supabase as any)
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: AdminOrder[] | null }) => setOrders(data ?? []));

    adminApiFetch("/api/admin/day")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { closures?: CashClosure[] } | null) => setClosures(data?.closures ?? []))
      .catch(() => setClosures([]));
  }, []);

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
            {filtered.map((order) => (
              <div
                key={order.id}
                className="grid gap-3 border-b border-white/10 p-3 last:border-0 lg:grid-cols-[120px_1fr_120px_120px_120px] lg:items-center"
              >
                <span className="font-mono text-sm text-orange-300">{shortOrderId(order.id)}</span>
                <div>
                  <p className="font-semibold text-white">{order.customer_name}</p>
                  <p className="text-xs text-zinc-500">
                    {order.customer_phone} - {formatDateTime(order.created_at)}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full border px-2 py-1 text-xs ${ORDER_STATUS_CLASS[order.status]}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
                <span className="font-display text-xl">{formatMoney(order.total)}</span>
                <div className="flex flex-wrap gap-2">
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
            ))}
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
