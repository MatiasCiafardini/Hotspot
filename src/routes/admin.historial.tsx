import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, AdminInput, AdminPageHeader, AdminSelect } from "@/components/admin/AdminBits";
import {
  DEFAULT_SETTINGS,
  downloadComandaPdf,
  formatDateTime,
  formatMoney,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  printComanda,
  shortOrderId,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/admin";

export const Route = createFileRoute("/admin/historial")({
  head: () => ({ meta: [{ title: "Historial admin - Hotspot" }, { name: "robots", content: "noindex" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filters, setFilters] = useState({ date: "", status: "all", payment: "all", search: "" });

  useEffect(() => {
    (supabase as any)
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: AdminOrder[] | null }) => setOrders(data ?? []));
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const matchesDate = !filters.date || order.created_at.slice(0, 10) === filters.date;
      const matchesStatus = filters.status === "all" || order.status === filters.status;
      const matchesPayment = filters.payment === "all" || (order.payment_method || "").toLowerCase() === filters.payment;
      const text = `${order.customer_name} ${order.customer_phone}`.toLowerCase();
      const matchesSearch = !filters.search || text.includes(filters.search.toLowerCase());
      return matchesDate && matchesStatus && matchesPayment && matchesSearch;
    });
  }, [orders, filters]);

  return (
    <>
      <AdminPageHeader eyebrow="Archivo" title="Historial" description="Pedidos confirmados, rechazados, entregados o cancelados con filtros rapidos." />

      <div className="mb-5 grid gap-3 rounded-lg border border-white/10 bg-zinc-900/70 p-4 md:grid-cols-4">
        <AdminInput type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <AdminSelect value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="all">Todos los estados</option>
          {Object.keys(ORDER_STATUS_LABEL).map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABEL[status as OrderStatus]}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect value={filters.payment} onChange={(e) => setFilters({ ...filters, payment: e.target.value })}>
          <option value="all">Todos los pagos</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </AdminSelect>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <AdminInput className="pl-9" placeholder="Nombre o telefono" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
        <div className="grid grid-cols-[120px_1fr_120px_120px_190px] gap-3 border-b border-white/10 p-3 text-xs font-bold uppercase text-zinc-500 max-lg:hidden">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Estado</span>
          <span>Total</span>
          <span>Acciones</span>
        </div>
        {filtered.map((order) => (
          <div key={order.id} className="grid gap-3 border-b border-white/10 p-3 last:border-0 lg:grid-cols-[120px_1fr_120px_120px_190px] lg:items-center">
            <span className="font-mono text-sm text-orange-300">{shortOrderId(order.id)}</span>
            <div>
              <p className="font-semibold text-white">{order.customer_name}</p>
              <p className="text-xs text-zinc-500">
                {order.customer_phone} · {formatDateTime(order.created_at)}
              </p>
            </div>
            <span className={`w-fit rounded-full border px-2 py-1 text-xs ${ORDER_STATUS_CLASS[order.status]}`}>{ORDER_STATUS_LABEL[order.status]}</span>
            <span className="font-display text-xl">{formatMoney(order.total)}</span>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="ghost" onClick={() => printComanda(order, DEFAULT_SETTINGS)}>
                <Printer className="h-4 w-4" />
              </AdminButton>
              <AdminButton variant="ghost" onClick={() => downloadComandaPdf(order, DEFAULT_SETTINGS)}>
                <Download className="h-4 w-4" />
              </AdminButton>
              {order.payment_receipt_url && (
                <a href={order.payment_receipt_url} target="_blank" rel="noreferrer">
                  <AdminButton variant="ghost">Comprobante</AdminButton>
                </a>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-10 text-center text-zinc-500">No hay pedidos con esos filtros.</div>}
      </div>
    </>
  );
}
