import { Printer, X } from "lucide-react";
import { AdminButton } from "@/components/admin/AdminBits";
import {
  buildCashSummaryLines,
  deriveCashSummaryStats,
  formatDateTime,
  formatMoney,
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
                  <div className="grid grid-cols-[110px_1fr_110px] gap-3 border-b border-white/10 bg-white/5 p-3 text-xs font-bold uppercase text-zinc-500">
                    <span>Pedido</span>
                    <span>Cliente</span>
                    <span>Total</span>
                  </div>
                  {data.orders.length === 0 ? (
                    <div className="p-5 text-sm text-zinc-500">No hubo pedidos en este cierre.</div>
                  ) : (
                    data.orders.map((order) => (
                      <div
                        key={order.id}
                        className="grid grid-cols-[110px_1fr_110px] gap-3 border-b border-white/10 p-3 text-sm last:border-0"
                      >
                        <span className="font-mono text-orange-300">{shortOrderId(order.id)}</span>
                        <span className="truncate text-zinc-200">{order.customer_name}</span>
                        <span className="font-display text-lg text-white">
                          {formatMoney(order.total)}
                        </span>
                      </div>
                    ))
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
