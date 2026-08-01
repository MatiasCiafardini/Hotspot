import { ChevronDown, MapPin, Package, Phone, Printer, X } from "lucide-react";
import { AdminButton } from "@/components/admin/AdminBits";
import {
  buildCashSummaryLines,
  deriveCashSummaryStats,
  formatDateTime,
  formatMoney,
  ORDER_STATUS_LABEL,
  printCashSummary,
  shortOrderId,
  type AdminOrder,
  type StoreSettings,
} from "@/lib/admin";
import { MENU_SHIFT_LABEL } from "@/lib/products";

export type CashSummaryDialogData = {
  openedAt: string;
  closedAt: string;
  orders: AdminOrder[];
  settings: StoreSettings;
};

type Props = {
  open: boolean;
  title?: string;
  mode?: "summary" | "confirm-start" | "confirm-close";
  data?: CashSummaryDialogData | null;
  busy?: boolean;
  confirmDisabled?: boolean;
  warning?: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
};

export function CashSummaryDialog({
  open,
  title,
  mode = "summary",
  data,
  busy = false,
  confirmDisabled = false,
  warning,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  const stats = data ? deriveCashSummaryStats(data.orders) : null;
  const lines = data ? buildCashSummaryLines(data) : [];
  const isConfirmStart = mode === "confirm-start";
  const isConfirmClose = mode === "confirm-close";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-white/15 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
              {isConfirmStart ? "Apertura" : "Cierre de caja"}
            </p>
            <h2 className="mt-1 font-display text-3xl text-white">
              {title ?? (data ? "Resumen de ventas" : "Confirmar accion")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 p-2 text-zinc-300 hover:border-orange-400/50 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-5">
          {isConfirmStart && (
            <div className="space-y-4">
              <p className="text-zinc-300">
                Vas a abrir la venta para que los clientes puedan confirmar pedidos.
              </p>
              <div className="rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-100">
                Revisá que el turno y las categorías estén correctas antes de iniciar.
              </div>
            </div>
          )}

          {isConfirmClose && !data && (
            <div className="space-y-4">
              {warning && (
                <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                  {warning}
                </div>
              )}
              <p className="text-zinc-300">
                Vas a cerrar el día. Se guardará el cierre de caja y se bloquearán nuevos pedidos.
              </p>
              <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                Después de confirmar vas a ver el resumen con el botón para imprimir.
              </div>
            </div>
          )}

          {data && stats && (
            <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryTile label="Apertura" value={formatDateTime(data.openedAt)} />
                  <SummaryTile label="Cierre" value={formatDateTime(data.closedAt)} />
                  <SummaryTile
                    label="Turno"
                    value={MENU_SHIFT_LABEL[data.settings.current_menu_shift || "dinner"]}
                  />
                  <SummaryTile label="Total vendido" value={formatMoney(stats.total)} strong />
                  <SummaryTile label="Efectivo" value={formatMoney(stats.cash)} />
                  <SummaryTile
                    label="Transfer aprobado"
                    value={formatMoney(stats.approvedTransfer)}
                  />
                  <SummaryTile
                    label="Transfer pendiente"
                    value={formatMoney(stats.pendingTransfer)}
                  />
                  <SummaryTile
                    label="Pedidos"
                    value={`${stats.chargeableOrdersCount}/${stats.ordersCount}`}
                  />
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10">
                  <div className="grid grid-cols-[90px_1fr_90px] gap-3 border-b border-white/10 bg-white/5 p-3 text-xs font-bold uppercase text-zinc-500 sm:grid-cols-[110px_1fr_110px]">
                    <span>Pedido</span>
                    <span>Cliente</span>
                    <span className="text-right">Total</span>
                  </div>
                  {data.orders.length === 0 ? (
                    <div className="p-5 text-sm text-zinc-500">No hubo pedidos en este cierre.</div>
                  ) : (
                    data.orders.map((order) => <OrderSummary key={order.id} order={order} />)
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Ticket
                </p>
                <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-200">
                  {lines.join("\n")}
                </pre>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AdminButton variant="ghost" onClick={onClose}>
              {data ? "Cerrar" : "Cancelar"}
            </AdminButton>
            {data ? (
              <AdminButton onClick={() => printCashSummary(data)}>
                <Printer className="h-4 w-4" /> Imprimir
              </AdminButton>
            ) : (
              <AdminButton
                variant={isConfirmClose ? "danger" : "primary"}
                onClick={onConfirm}
                disabled={busy || confirmDisabled}
              >
                {busy ? "Procesando..." : isConfirmStart ? "Iniciar dia" : "Cerrar dia"}
              </AdminButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderSummary({ order }: { order: AdminOrder }) {
  const paymentLabel =
    order.payment_method === "efectivo"
      ? "Efectivo"
      : order.payment_method === "transferencia"
        ? "Transferencia"
        : order.payment_method === "dividido"
          ? "Pago dividido"
          : "A confirmar";

  return (
    <details className="group border-b border-white/10 last:border-0">
      <summary className="grid cursor-pointer list-none grid-cols-[90px_1fr_90px] items-center gap-3 p-3 text-sm transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:grid-cols-[110px_1fr_110px]">
        <span className="flex items-center gap-1 font-mono text-orange-300">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
          {shortOrderId(order.id)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-zinc-200">{order.customer_name}</span>
          <span className="block truncate text-xs text-zinc-500">
            {order.order_items?.length ?? 0} producto(s) · {paymentLabel}
          </span>
        </span>
        <span className="text-right font-display text-lg text-white">
          {formatMoney(order.total)}
        </span>
      </summary>

      <div className="border-t border-white/10 bg-black/30 p-4">
        <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
          <p>
            <span className="font-bold text-zinc-500">Estado:</span>{" "}
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </p>
          <p>
            <span className="font-bold text-zinc-500">Pago:</span> {paymentLabel}
            {order.payment_method === "dividido" &&
              ` (${formatMoney(Number(order.payment_cash_amount || 0))} efectivo + ${formatMoney(Number(order.payment_transfer_amount || 0))} transferencia)`}
          </p>
          <p className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-orange-300" /> {order.customer_phone}
          </p>
          <p className="flex items-start gap-1.5">
            {order.delivery_method === "delivery" ? (
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" />
            ) : (
              <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" />
            )}
            {order.delivery_method === "delivery"
              ? `Delivery · ${order.customer_address || "Sin dirección"}`
              : "Retiro en el local"}
          </p>
        </div>

        <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-md border border-white/10">
          {order.order_items?.length ? (
            order.order_items.map((item) => (
              <div key={item.id} className="p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">
                    {item.quantity}× {item.product_name}
                  </p>
                  <p className="shrink-0 text-zinc-300">
                    {formatMoney(Number(item.unit_price) * item.quantity)}
                  </p>
                </div>
                {item.removed_ingredients?.length ? (
                  <p className="mt-1 text-red-200">Sin: {item.removed_ingredients.join(", ")}</p>
                ) : null}
                {item.added_ingredients?.length ? (
                  <p className="mt-1 text-emerald-200">
                    Extra: {item.added_ingredients.join(", ")}
                  </p>
                ) : null}
                {item.custom_extras?.length ? (
                  <p className="mt-1 text-emerald-200">
                    Extras libres:{" "}
                    {item.custom_extras
                      .map((extra) => `${extra.name} (${formatMoney(extra.price)})`)
                      .join(", ")}
                  </p>
                ) : null}
                {item.item_notes ? (
                  <p className="mt-1 text-yellow-100">Obs: {item.item_notes}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="p-3 text-xs text-zinc-500">Este pedido no tiene ítems detallados.</p>
          )}
        </div>

        {order.notes && (
          <p className="mt-3 rounded-md border border-yellow-400/20 bg-yellow-500/10 p-3 text-xs text-yellow-100">
            Nota del pedido: {order.notes}
          </p>
        )}
      </div>
    </details>
  );
}

function SummaryTile({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-1 ${strong ? "font-display text-2xl text-orange-300" : "text-sm text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
