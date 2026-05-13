import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, PackageCheck, Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, AdminPageHeader, AdminSelect } from "@/components/admin/AdminBits";
import { adminApiFetch, readApiError } from "@/lib/admin-api";
import {
  buildOrderConfirmedWhatsAppUrl,
  DEFAULT_SETTINGS,
  formatDateTime,
  formatMoney,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  printComanda,
  shortOrderId,
  type AdminOrder,
  type OrderStatus,
  type StoreSettings,
} from "@/lib/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({
    meta: [{ title: "Pedidos admin - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: OrdersPage,
});

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "pending_payment",
  "pending_confirmation",
  "confirmed",
  "preparing",
  "ready",
];
const ACTIONABLE_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "pending_payment",
  "pending_confirmation",
];
const AUTO_REFRESH_MS = 4000;

function getActiveOrders(orders: AdminOrder[]) {
  return orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status));
}

function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (options?: { notifyNew?: boolean; silentErrors?: boolean }) => {
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) {
      if (!options?.silentErrors) toast.error("No se pudieron cargar los pedidos.");
      setLoading(false);
      return;
    }
    const nextOrders = getActiveOrders((data as AdminOrder[]) ?? []);
    const previousIds = knownOrderIdsRef.current;

    if (options?.notifyNew && hasLoadedRef.current) {
      const newOrders = nextOrders.filter(
        (order) => !previousIds.has(order.id) && ACTIONABLE_ORDER_STATUSES.includes(order.status),
      );
      if (newOrders.length > 0) {
        toast.info(
          newOrders.length === 1
            ? "Nuevo pedido recibido."
            : `${newOrders.length} pedidos nuevos recibidos.`,
        );
      }
    }

    knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
    hasLoadedRef.current = true;
    setOrders(nextOrders);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    (supabase as any)
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: StoreSettings | null }) => {
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      });

    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        load({ notifyNew: true }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => load())
      .subscribe();

    const intervalId = window.setInterval(() => {
      load({ notifyNew: true, silentErrors: true });
    }, AUTO_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load({ notifyNew: true, silentErrors: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const pending = useMemo(
    () => orders.filter((order) => ACTIONABLE_ORDER_STATUSES.includes(order.status)),
    [orders],
  );

  const updateStatus = async (order: AdminOrder, status: OrderStatus) => {
    const whatsappWindow = status === "confirmed" ? window.open("", "_blank") : null;
    try {
      const response = await adminApiFetch("/api/admin/orders/status", {
        method: "POST",
        body: JSON.stringify({ orderId: order.id, status }),
      });
      const data = await response.json().catch(() => null);
      const patch =
        data?.patch ??
        (status === "confirmed" ? { status, payment_status: "approved" } : { status });
      const error = response.ok
        ? null
        : (data?.error ?? (await readApiError(response, "No se pudo actualizar el pedido.")));
      if (error) {
        whatsappWindow?.close();
        return toast.error(error);
      }
      toast.success(
        status === "confirmed"
          ? "Pedido confirmado. Comanda lista."
          : `Pedido: ${ORDER_STATUS_LABEL[status]}`,
      );
      const updatedOrder = data?.order
        ? ({ ...order, ...data.order } as AdminOrder)
        : ({ ...order, ...patch } as AdminOrder);
      setOrders((current) =>
        getActiveOrders(
          current.map((item) => (item.id === order.id ? { ...item, ...updatedOrder } : item)),
        ),
      );
      setSelected((current) => (current?.id === order.id ? updatedOrder : current));

      if (status === "confirmed") {
        const whatsappUrl = buildOrderConfirmedWhatsAppUrl(updatedOrder, settings);
        if (whatsappUrl && whatsappWindow) {
          whatsappWindow.location.href = whatsappUrl;
        } else {
          whatsappWindow?.close();
          toast.error("No se pudo abrir WhatsApp. Revisá el teléfono del cliente.");
        }
      }
    } catch (error) {
      whatsappWindow?.close();
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el pedido.");
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Operacion"
        title="Pedidos"
        description="Nuevos pedidos, detalle completo, confirmacion y comandas limpias para cocina."
      />

      <div className="mb-4 rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-100">
        {pending.length} pedidos necesitan revision. Al confirmar, el estado cambia y podes imprimir
        la comanda.
      </div>

      <div className="grid gap-4">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-lg border border-white/10 bg-zinc-900/80 p-4 shadow-lg"
          >
            {(() => {
              const canConfirmOrReject = ACTIONABLE_ORDER_STATUSES.includes(order.status);

              return (
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-orange-300">
                        {shortOrderId(order.id)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${ORDER_STATUS_CLASS[order.status]}`}
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatDateTime(order.created_at)}
                      </span>
                    </div>
                    <h2 className="mt-2 font-display text-3xl text-white">{order.customer_name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      Tel {order.customer_phone}
                      {order.customer_address
                        ? ` · ${order.customer_address}`
                        : " · Retiro en local"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Pago {order.payment_method || "A confirmar"} ·{" "}
                      {PAYMENT_STATUS_LABEL[order.payment_status || "pending"]}
                      {order.payment_receipt_url && (
                        <a
                          className="ml-2 text-orange-300 underline"
                          href={order.payment_receipt_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver comprobante
                        </a>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <AdminButton variant="ghost" onClick={() => setSelected(order)}>
                      <Eye className="h-4 w-4" /> Ver detalle
                    </AdminButton>
                    {canConfirmOrReject && (
                      <>
                        <AdminButton onClick={() => updateStatus(order, "confirmed")}>
                          <Check className="h-4 w-4" /> Confirmar pago
                        </AdminButton>
                        <AdminButton
                          variant="danger"
                          onClick={() => updateStatus(order, "rejected")}
                        >
                          <X className="h-4 w-4" /> Rechazar
                        </AdminButton>
                      </>
                    )}
                    <AdminButton variant="ghost" onClick={() => printComanda(order, settings)}>
                      <Printer className="h-4 w-4" /> Imprimir
                    </AdminButton>
                  </div>
                </div>
              );
            })()}

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_200px]">
              <div className="space-y-2">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">
                        {item.quantity} x {item.product_name}
                      </p>
                      <p className="font-mono text-sm text-zinc-400">
                        {formatMoney(item.unit_price * item.quantity)}
                      </p>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-zinc-400 md:grid-cols-2">
                      <p>
                        Base:{" "}
                        {item.base_ingredients?.length
                          ? item.base_ingredients.join(", ")
                          : "Sin detalle"}
                      </p>
                      <p>
                        Quitados:{" "}
                        {item.removed_ingredients?.length
                          ? item.removed_ingredients.join(", ")
                          : "Ninguno"}
                      </p>
                      <p>
                        Agregados:{" "}
                        {item.added_ingredients?.length
                          ? item.added_ingredients.join(", ")
                          : "Ninguno"}
                      </p>
                      <p>Obs: {item.item_notes || "Sin observaciones"}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-white/10 bg-black/30 p-3">
                <p className="text-xs uppercase text-zinc-500">Total pedido</p>
                <p className="font-display text-3xl text-orange-300">{formatMoney(order.total)}</p>
                <p className="mt-3 text-xs uppercase text-zinc-500">Notas cliente</p>
                <p className="text-sm text-zinc-300">{order.notes || "Sin notas"}</p>
                <div className="mt-3">
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
                </div>
                {order.status !== "delivered" && (
                  <AdminButton
                    className="mt-3 w-full"
                    onClick={() => updateStatus(order, "delivered")}
                  >
                    <PackageCheck className="h-4 w-4" /> Entregado
                  </AdminButton>
                )}
              </div>
            </div>
          </article>
        ))}

        {!loading && orders.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-10 text-center text-zinc-400">
            No hay pedidos pendientes.
          </div>
        )}
      </div>

      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function OrderDetail({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4" onClick={onClose}>
      <div
        className="ml-auto h-full max-w-2xl overflow-y-auto rounded-lg border border-orange-400/30 bg-zinc-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="font-mono text-orange-300">{shortOrderId(order.id)}</p>
            <h2 className="font-display text-4xl">{order.customer_name}</h2>
            <p className="text-sm text-zinc-400">{formatDateTime(order.created_at)}</p>
          </div>
          <AdminButton variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </AdminButton>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-zinc-300">
          <p>Telefono: {order.customer_phone}</p>
          <p>Direccion: {order.customer_address || "Retiro en local"}</p>
          <p>Metodo de pago: {order.payment_method || "A confirmar"}</p>
          <p>Estado de pago: {PAYMENT_STATUS_LABEL[order.payment_status || "pending"]}</p>
          <p>Notas: {order.notes || "Sin notas"}</p>
        </div>
        <div className="mt-5 space-y-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-4">
              <p className="font-display text-2xl">
                {item.quantity} x {item.product_name}
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Ingredientes base: {item.base_ingredients?.join(", ") || "Sin detalle"}
              </p>
              <p className="text-sm text-zinc-400">
                Quitados: {item.removed_ingredients?.join(", ") || "Ninguno"}
              </p>
              <p className="text-sm text-zinc-400">
                Agregados: {item.added_ingredients?.join(", ") || "Ninguno"}
              </p>
              <p className="text-sm text-zinc-400">
                Observaciones: {item.item_notes || "Sin observaciones"}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="font-display text-2xl">Total</span>
          <span className="font-display text-4xl text-orange-300">{formatMoney(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
