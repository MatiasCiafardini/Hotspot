import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminBits";
import { adminApiFetch, readApiError } from "@/lib/admin-api";
import {
  buildOrderConfirmedWhatsAppUrl,
  DEFAULT_SETTINGS,
  extraIngredientPrice,
  formatDateTime,
  formatDeliveryTime,
  formatIngredientList,
  formatMoney,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  printComanda,
  productExtraIngredients,
  productIngredients,
  shortOrderId,
  type AdminOrder,
  type OrderItem,
  type OrderStatus,
  type StoreSettings,
} from "@/lib/admin";
import type { Product } from "@/lib/products";
import { cn, createClientId } from "@/lib/utils";
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
type DeliveryMethod = "pickup" | "delivery";
type PaymentMethod = "efectivo" | "transferencia" | "dividido";

type EditableOrderItem = {
  id: string;
  productId: string;
  quantity: number;
  removedIngredients: string[];
  addedIngredients: string[];
  notes: string;
};

function getActiveOrders(orders: AdminOrder[]) {
  return orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status));
}

function formatPaymentMethod(order: AdminOrder) {
  if (order.payment_method !== "dividido") return order.payment_method || "A confirmar";
  return `dividido (${formatMoney(order.payment_cash_amount || 0)} efectivo / ${formatMoney(
    order.payment_transfer_amount || 0,
  )} transferencia)`;
}

function orderItemCount(order: AdminOrder) {
  return order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}

function orderSummary(order: AdminOrder) {
  return (
    order.order_items
      ?.slice(0, 3)
      .map((item) => `${item.quantity} x ${item.product_name}`)
      .join(" - ") || "Sin items"
  );
}

function editableItemFromOrderItem(item: OrderItem, products: Product[]): EditableOrderItem {
  const product = products.find((option) => option.id === item.product_id);
  return {
    id: item.id || createClientId(),
    productId: product?.id ?? item.product_id ?? "",
    quantity: item.quantity,
    removedIngredients: item.removed_ingredients ?? [],
    addedIngredients: item.added_ingredients ?? [],
    notes: item.item_notes ?? "",
  };
}

function itemUnitPrice(item: EditableOrderItem, productsById: Map<string, Product>) {
  const product = productsById.get(item.productId);
  if (!product) return 0;
  return (
    Number(product.price) +
    item.addedIngredients.reduce(
      (sum, ingredient) => sum + extraIngredientPrice(product, ingredient),
      0,
    )
  );
}

function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [editing, setEditing] = useState<AdminOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const handledDeepLinkRef = useRef<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (options?: { notifyNew?: boolean; silentErrors?: boolean }) => {
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: true });
    if (error) {
      if (!options?.silentErrors) toast.error("No se pudieron cargar los pedidos.");
      setLoading(false);
      return;
    }
    const nextOrders = getActiveOrders((data as AdminOrder[]) ?? []);
    const previousIds = knownOrderIdsRef.current;

    if (
      options?.notifyNew &&
      hasLoadedRef.current &&
      window.localStorage.getItem("hotspot-push-active") !== "true"
    ) {
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

    (supabase as any)
      .from("products")
      .select("*")
      .eq("available", true)
      .order("sort_order")
      .then(({ data, error }: { data: Product[] | null; error: unknown }) => {
        if (error) {
          toast.error("No se pudieron cargar los productos para editar pedidos.");
          return;
        }
        setProducts(data ?? []);
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

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("pedido");
    if (!orderId || handledDeepLinkRef.current === orderId) return;
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    handledDeepLinkRef.current = orderId;
    setExpandedOrderIds((current) => new Set(current).add(orderId));
    setSelected(order);
  }, [orders]);

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
        (status === "confirmed"
          ? {
              status,
              payment_status: order.payment_method === "efectivo" ? "pending" : "approved",
            }
          : status === "delivered" && order.payment_method === "efectivo"
            ? { status, payment_status: "approved" }
            : { status });
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

  const applyEditedOrder = (order: AdminOrder) => {
    setOrders((current) =>
      getActiveOrders(current.map((item) => (item.id === order.id ? order : item))),
    );
    setSelected((current) => (current?.id === order.id ? order : current));
    setEditing((current) => (current?.id === order.id ? null : current));
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Operacion"
        title="Pedidos"
        description="Pedidos activos, pagos, edicion e impresion de comandas."
        action={
          <AdminButton onClick={() => navigate({ to: "/admin/venta-local" })}>
            <Plus className="h-4 w-4" /> Nuevo pedido
          </AdminButton>
        }
      />

      <div className="mb-4 rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-100">
        {pending.length} pedidos necesitan revision. Al confirmar, el estado cambia y podes imprimir
        la comanda.
      </div>

      <div className="grid gap-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-lg border border-white/10 bg-zinc-900/80 p-3 shadow-lg"
          >
            {(() => {
              const canConfirmOrReject = ACTIONABLE_ORDER_STATUSES.includes(order.status);
              const isExpanded = expandedOrderIds.has(order.id);

              return (
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-sm text-orange-300">
                        {shortOrderId(order.id)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 ${ORDER_STATUS_CLASS[order.status]}`}
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                      <span className="text-zinc-500">{formatDateTime(order.created_at)}</span>
                      <span className="text-zinc-500">{orderItemCount(order)} item(s)</span>
                      <strong className="font-display text-xl text-orange-300">
                        {formatMoney(order.total)}
                      </strong>
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="font-display text-2xl leading-none text-white">
                        {order.customer_name}
                      </h2>
                      <p className="text-sm text-zinc-400">
                        {orderSummary(order)}
                        {(order.order_items?.length ?? 0) > 3 ? "..." : ""}
                      </p>
                    </div>
                    {order.delivery_time && (
                      <p className="mt-1 text-xs font-semibold text-orange-200">
                        Horario de entrega {formatDeliveryTime(order.delivery_time)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-zinc-400">
                      Tel {order.customer_phone}
                      {order.customer_address
                        ? ` · ${order.customer_address}`
                        : " · Retiro en local"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
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

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <AdminSelect
                      className="w-44"
                      value={order.status}
                      onChange={(event) => updateStatus(order, event.target.value as OrderStatus)}
                      aria-label="Estado del pedido"
                    >
                      {Object.keys(ORDER_STATUS_LABEL).map((status) => (
                        <option key={status} value={status}>
                          {ORDER_STATUS_LABEL[status as OrderStatus]}
                        </option>
                      ))}
                    </AdminSelect>
                    <AdminButton
                      variant="ghost"
                      onClick={() =>
                        setExpandedOrderIds((current) => {
                          const next = new Set(current);
                          if (next.has(order.id)) next.delete(order.id);
                          else next.add(order.id);
                          return next;
                        })
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {isExpanded ? "Ocultar" : "Desplegar"}
                    </AdminButton>
                    <AdminButton variant="ghost" onClick={() => setSelected(order)}>
                      <Eye className="h-4 w-4" /> Ver detalle
                    </AdminButton>
                    <AdminButton variant="ghost" onClick={() => setEditing(order)}>
                      <Edit3 className="h-4 w-4" /> Editar
                    </AdminButton>
                    {canConfirmOrReject && (
                      <>
                        <AdminButton onClick={() => updateStatus(order, "confirmed")}>
                          <Check className="h-4 w-4" />
                          {order.payment_method === "efectivo"
                            ? "Confirmar pedido"
                            : "Confirmar pago"}
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

            {expandedOrderIds.has(order.id) && (
              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_200px]">
                <div className="space-y-2">
                  {order.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-white/10 bg-black/30 p-3"
                    >
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
                            ? formatIngredientList(item.removed_ingredients)
                            : "Ninguno"}
                        </p>
                        <p>
                          Agregados:{" "}
                          {item.added_ingredients?.length
                            ? formatIngredientList(item.added_ingredients)
                            : "Ninguno"}
                        </p>
                        <p>
                          Extras libres:{" "}
                          {item.custom_extras?.length
                            ? item.custom_extras
                                .map((extra) => `${extra.name} (${formatMoney(extra.price)})`)
                                .join(", ")
                            : "Ninguno"}
                        </p>
                        <p>Obs: {item.item_notes || "Sin observaciones"}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase text-zinc-500">Total pedido</p>
                  <p className="font-display text-3xl text-orange-300">
                    {formatMoney(order.total)}
                  </p>
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
            )}
          </article>
        ))}

        {!loading && orders.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-10 text-center text-zinc-400">
            No hay pedidos pendientes.
          </div>
        )}
      </div>

      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
      {editing && (
        <OrderEditDialog
          order={editing}
          products={products}
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={applyEditedOrder}
        />
      )}
    </>
  );
}

function OrderEditDialog({
  order,
  products,
  settings,
  onClose,
  onSaved,
}: {
  order: AdminOrder;
  products: Product[];
  settings: StoreSettings;
  onClose: () => void;
  onSaved: (order: AdminOrder) => void;
}) {
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const initialItemsSubtotal = useMemo(
    () =>
      (order.order_items ?? []).reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * item.quantity,
        0,
      ),
    [order.order_items],
  );
  const initialDeliveryFee = Math.max(0, Number(order.total || 0) - initialItemsSubtotal);
  const [customerName, setCustomerName] = useState(order.customer_name);
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    order.delivery_method === "delivery" ? "delivery" : "pickup",
  );
  const [customerAddress, setCustomerAddress] = useState(order.customer_address ?? "");
  const [deliveryFee, setDeliveryFee] = useState(
    order.delivery_method === "delivery" ? initialDeliveryFee : 0,
  );
  const [deliveryTime, setDeliveryTime] = useState(formatDeliveryTime(order.delivery_time) ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    order.payment_method === "transferencia" || order.payment_method === "dividido"
      ? order.payment_method
      : "efectivo",
  );
  const [paymentCashAmount, setPaymentCashAmount] = useState(
    Number(order.payment_cash_amount || 0),
  );
  const [paymentTransferAmount, setPaymentTransferAmount] = useState(
    Number(order.payment_transfer_amount || 0),
  );
  const [notes, setNotes] = useState(order.notes ?? "");
  const [items, setItems] = useState<EditableOrderItem[]>(() =>
    (order.order_items ?? []).map((item) => editableItemFromOrderItem(item, products)),
  );
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + itemUnitPrice(item, productsById) * item.quantity, 0),
    [items, productsById],
  );
  const deliveryAmount = deliveryMethod === "delivery" ? Math.max(0, Number(deliveryFee) || 0) : 0;
  const total = subtotal + deliveryAmount;

  const updateItem = (itemId: string, patch: Partial<EditableOrderItem>) => {
    if (patch.productId && itemId === newItemId) setNewItemId(null);
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    if (products.length === 0) return toast.error("No hay productos cargados para agregar.");
    const itemId = createClientId();
    setItems((current) => [
      ...current,
      {
        id: itemId,
        productId: "",
        quantity: 1,
        removedIngredients: [],
        addedIngredients: [],
        notes: "",
      },
    ]);
    setNewItemId(itemId);
    window.setTimeout(() => {
      document.querySelector(`[data-edit-item-id="${itemId}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  };

  const save = async () => {
    const cleanName = customerName.trim();
    const cleanAddress = customerAddress.trim();
    if (!cleanName) return toast.error("Carga el nombre del cliente.");
    if (deliveryMethod === "delivery" && !cleanAddress) return toast.error("Carga la direccion.");
    if (items.length === 0) return toast.error("El pedido necesita al menos un item.");
    if (items.some((item) => !item.productId || !productsById.has(item.productId))) {
      return toast.error("Elegi un producto valido en cada item.");
    }
    if (deliveryTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(deliveryTime)) {
      return toast.error("El horario tiene que tener formato HH:MM.");
    }
    if (paymentMethod === "dividido") {
      const splitTotal = Number(paymentCashAmount || 0) + Number(paymentTransferAmount || 0);
      if (paymentCashAmount <= 0 || paymentTransferAmount <= 0) {
        return toast.error("Carga cuanto paga en efectivo y cuanto por transferencia.");
      }
      if (Math.abs(splitTotal - total) > 0.01) {
        return toast.error("La suma del pago dividido tiene que coincidir con el total.");
      }
    }

    setSaving(true);
    try {
      const response = await adminApiFetch("/api/admin/orders/edit", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.id,
          customerName: cleanName,
          customerPhone: customerPhone.trim(),
          deliveryMethod,
          customerAddress: deliveryMethod === "delivery" ? cleanAddress : "",
          deliveryFee: deliveryAmount,
          deliveryTime: deliveryTime === ":" ? "" : deliveryTime,
          paymentMethod,
          paymentCashAmount: paymentMethod === "dividido" ? paymentCashAmount : null,
          paymentTransferAmount: paymentMethod === "dividido" ? paymentTransferAmount : null,
          notes: notes.trim(),
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            removedIngredients: item.removedIngredients,
            addedIngredients: item.addedIngredients,
            notes: item.notes.trim(),
          })),
        }),
      });
      if (!response.ok) {
        toast.error(await readApiError(response, "No se pudo editar el pedido."));
        return;
      }
      const data = (await response.json().catch(() => null)) as { order?: AdminOrder } | null;
      if (!data?.order) {
        toast.error("El pedido se guardo, pero no se pudo recargar el detalle.");
        return;
      }
      toast.success("Pedido editado.");
      onSaved(data.order);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo editar el pedido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-orange-400/30 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-white/10 p-5 pb-4">
          <div>
            <p className="font-mono text-orange-300">{shortOrderId(order.id)}</p>
            <h2 className="font-display text-4xl leading-none text-white">Editar pedido</h2>
          </div>
          <AdminButton variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </AdminButton>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Nombre">
                <AdminInput
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </AdminField>
              <AdminField label="Telefono">
                <AdminInput
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </AdminField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Entrega">
                <AdminSelect
                  value={deliveryMethod}
                  onChange={(event) => {
                    const nextMethod = event.target.value as DeliveryMethod;
                    setDeliveryMethod(nextMethod);
                    if (nextMethod === "delivery" && deliveryFee <= 0) {
                      setDeliveryFee(initialDeliveryFee || Number(settings.delivery_fee) || 0);
                    }
                  }}
                >
                  <option value="pickup">Retiro local</option>
                  <option value="delivery">Delivery</option>
                </AdminSelect>
              </AdminField>
              <AdminField label="Horario de entrega">
                <AdminTimeInput value={deliveryTime} onChange={setDeliveryTime} />
              </AdminField>
            </div>

            {deliveryMethod === "delivery" && (
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <AdminField label="Direccion">
                  <AdminInput
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    placeholder="Calle, numero, piso/depto"
                  />
                </AdminField>
                <AdminField label="Costo de envio">
                  <AdminInput
                    type="number"
                    min={0}
                    step={1}
                    value={deliveryFee || ""}
                    onChange={(event) => setDeliveryFee(Number(event.target.value))}
                    placeholder="5500"
                  />
                </AdminField>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Metodo de pago">
                <AdminSelect
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="dividido">Pago dividido</option>
                </AdminSelect>
              </AdminField>
              <AdminField label="Notas">
                <AdminTextarea
                  className="min-h-10"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </AdminField>
            </div>

            {paymentMethod === "dividido" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Efectivo">
                  <AdminInput
                    type="number"
                    min={0}
                    value={paymentCashAmount || ""}
                    onChange={(event) => setPaymentCashAmount(Number(event.target.value))}
                  />
                </AdminField>
                <AdminField label="Transferencia">
                  <AdminInput
                    type="number"
                    min={0}
                    value={paymentTransferAmount || ""}
                    onChange={(event) => setPaymentTransferAmount(Number(event.target.value))}
                  />
                </AdminField>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-3xl text-white">Items</h3>
                <AdminButton variant="ghost" onClick={addItem}>
                  <Plus className="h-4 w-4" /> Agregar
                </AdminButton>
              </div>
              {items.map((item) => (
                <EditableItemCard
                  key={item.id}
                  item={item}
                  products={products}
                  product={productsById.get(item.productId) ?? null}
                  unitPrice={itemUnitPrice(item, productsById)}
                  isNew={item.id === newItemId}
                  onChange={(patch) => updateItem(item.id, patch)}
                  onRemove={() =>
                    setItems((current) => current.filter((entry) => entry.id !== item.id))
                  }
                />
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-md border border-white/10 bg-black/30 p-4 lg:sticky lg:top-5">
            <p className="text-xs uppercase text-zinc-500">Total pedido</p>
            <p className="font-display text-5xl text-orange-300">{formatMoney(total)}</p>
            <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Items</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              {deliveryMethod === "delivery" && (
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Envio</span>
                  <span>{formatMoney(deliveryAmount)}</span>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Productos, extras y envio.</p>
          </aside>
        </div>

        <div className="shrink-0 flex flex-col gap-2 border-t border-white/10 p-5 sm:flex-row sm:justify-end">
          <AdminButton variant="ghost" onClick={onClose}>
            Cancelar
          </AdminButton>
          <AdminButton onClick={save} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

function AdminTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <AdminInput
      type="time"
      step={60}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="font-mono text-lg"
    />
  );
}

function EditableItemCard({
  item,
  products,
  product,
  unitPrice,
  isNew,
  onChange,
  onRemove,
}: {
  item: EditableOrderItem;
  products: Product[];
  product: Product | null;
  unitPrice: number;
  isNew: boolean;
  onChange: (patch: Partial<EditableOrderItem>) => void;
  onRemove: () => void;
}) {
  const ingredients = product ? productIngredients(product) : [];
  const extraIngredients = product ? productExtraIngredients(product) : [];
  const [extrasOpen, setExtrasOpen] = useState(item.addedIngredients.length > 0);
  const addedSummary = formatIngredientList(item.addedIngredients);
  const removedSummary = formatIngredientList(item.removedIngredients);
  const changeProduct = (productId: string) => {
    onChange({
      productId,
      removedIngredients: [],
      addedIngredients: [],
    });
  };
  const toggleRemoved = (ingredient: string) => {
    onChange({
      removedIngredients: item.removedIngredients.includes(ingredient)
        ? item.removedIngredients.filter((entry) => entry !== ingredient)
        : [...item.removedIngredients, ingredient],
    });
  };
  const changeAdded = (ingredient: string, delta: number) => {
    if (delta > 0) return onChange({ addedIngredients: [...item.addedIngredients, ingredient] });
    const index = item.addedIngredients.lastIndexOf(ingredient);
    if (index === -1) return;
    onChange({
      addedIngredients: item.addedIngredients.filter((_, currentIndex) => currentIndex !== index),
    });
  };

  return (
    <div
      data-edit-item-id={item.id}
      className={cn(
        "rounded-md border p-3 transition-colors",
        isNew
          ? "border-orange-400 bg-orange-500/10 shadow-[0_0_0_1px_rgba(251,146,60,0.35)]"
          : "border-white/10 bg-black/30",
      )}
    >
      <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[11px] font-bold uppercase",
              isNew ? "text-orange-300" : "text-zinc-500",
            )}
          >
            {isNew ? "Nuevo item agregado" : "Producto"}
          </p>
          <h4 className="mt-1 truncate font-display text-2xl leading-none text-white">
            {product?.name ?? "Elegir producto"}
          </h4>
          {product ? (
            <p className="mt-1 text-xs text-zinc-400">
              Unitario {formatMoney(unitPrice)} · Cantidad {item.quantity}
              {removedSummary ? ` · Sin ${removedSummary}` : ""}
              {addedSummary ? ` · Extra ${addedSummary}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-orange-100">
              Busca y elegi el producto para sumarlo al pedido.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="inline-flex items-center rounded-md border border-white/10 bg-zinc-950">
            <SmallIconButton
              label="Quitar unidad"
              className="border-0 bg-transparent"
              onClick={() => onChange({ quantity: Math.max(1, item.quantity - 1) })}
            >
              <Minus className="h-4 w-4" />
            </SmallIconButton>
            <span className="flex h-9 min-w-10 items-center justify-center border-x border-white/10 px-2 font-mono text-sm text-white">
              {item.quantity}
            </span>
            <SmallIconButton
              label="Agregar unidad"
              className="border-0 bg-transparent"
              onClick={() => onChange({ quantity: Math.min(50, item.quantity + 1) })}
            >
              <Plus className="h-4 w-4" />
            </SmallIconButton>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-400/20 bg-red-500/5 text-red-100 hover:bg-red-500/15"
            aria-label="Eliminar item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <ProductSearchSelect
            products={products}
            value={item.productId}
            autoFocus={isNew}
            onChange={changeProduct}
          />
          <div className="rounded-md border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase text-orange-200">Subtotal</p>
            <p className="font-display text-2xl leading-none text-orange-300">
              {formatMoney(unitPrice * item.quantity)}
            </p>
          </div>
        </div>

        {product ? (
          <>
            {ingredients.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-zinc-500">Ingredientes base</p>
                <div className="flex flex-wrap gap-2">
                  {ingredients.map((ingredient) => {
                    const removed = item.removedIngredients.includes(ingredient);
                    return (
                      <button
                        type="button"
                        key={ingredient}
                        onClick={() => toggleRemoved(ingredient)}
                        className={cn(
                          "min-h-8 rounded-md border px-2.5 py-1 text-left text-xs transition-colors",
                          removed
                            ? "border-orange-400 bg-orange-500/90 text-black line-through"
                            : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-orange-400/50",
                        )}
                      >
                        {removed ? `Sin ${ingredient}` : ingredient}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {extraIngredients.length > 0 && (
              <div className="rounded-md border border-white/10 bg-zinc-950/70">
                <button
                  type="button"
                  onClick={() => setExtrasOpen((current) => !current)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase text-zinc-500">Extras</span>
                    <span className="block truncate text-sm text-zinc-200">
                      {addedSummary || "Sin extras agregados"}
                    </span>
                  </span>
                  {extrasOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-orange-300" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-orange-300" />
                  )}
                </button>
                {extrasOpen && (
                  <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2">
                    {extraIngredients.map((ingredient) => {
                      const count = item.addedIngredients.filter(
                        (entry) => entry === ingredient.name,
                      ).length;
                      return (
                        <div
                          key={ingredient.name}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{ingredient.name}</span>
                            <span className="text-xs text-zinc-500">
                              {formatMoney(ingredient.price)}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <SmallIconButton
                              label={`Restar ${ingredient.name}`}
                              onClick={() => changeAdded(ingredient.name, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </SmallIconButton>
                            <span className="flex h-9 min-w-9 items-center justify-center rounded-md border border-white/10 font-mono text-sm text-white">
                              {count}
                            </span>
                            <SmallIconButton
                              label={`Sumar ${ingredient.name}`}
                              onClick={() => changeAdded(ingredient.name, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </SmallIconButton>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-md border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
            Elegi un producto para editar ingredientes y extras.
          </p>
        )}

        <AdminInput
          value={item.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Observaciones para cocina"
        />
      </div>
    </div>
  );
}

function ProductSearchSelect({
  products,
  value,
  autoFocus = false,
  onChange,
}: {
  products: Product[];
  value: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  const selected = products.find((product) => product.id === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = products
    .filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 12);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    setOpen(true);
  }, [autoFocus]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <AdminInput
        ref={inputRef}
        className="pl-10"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        placeholder="Buscar producto"
      />
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 max-h-64 overflow-y-auto rounded-md border border-orange-400/40 bg-zinc-950 p-1 shadow-2xl">
          {filtered.map((product) => (
            <button
              type="button"
              key={product.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(product.id);
                setQuery(product.name);
                setOpen(false);
              }}
              className="flex min-h-10 w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm text-zinc-100 hover:bg-orange-500 hover:text-black"
            >
              <span>{product.name}</span>
              <span className="font-mono text-xs opacity-70">{formatMoney(product.price)}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-zinc-500">Sin resultados.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SmallIconButton({
  label,
  children,
  className,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/30 text-zinc-200 hover:border-orange-400/40",
        className,
      )}
      aria-label={label}
    >
      {children}
    </button>
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
          <p>Horario de entrega: {formatDeliveryTime(order.delivery_time) || "Sin horario"}</p>
          <p>Metodo de pago: {formatPaymentMethod(order)}</p>
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
                Quitados: {formatIngredientList(item.removed_ingredients) || "Ninguno"}
              </p>
              <p className="text-sm text-zinc-400">
                Agregados: {formatIngredientList(item.added_ingredients) || "Ninguno"}
              </p>
              <p className="text-sm text-zinc-400">
                Extras libres:{" "}
                {item.custom_extras?.length
                  ? item.custom_extras
                      .map((extra) => `${extra.name} (${formatMoney(extra.price)})`)
                      .join(", ")
                  : "Ninguno"}
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
