import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, PackageCheck, PenLine, Phone, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { TransitionLink } from "@/components/RouteTransitionProvider";
import {
  formatDateTime,
  formatMoney,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  shortOrderId,
  type AdminOrder,
} from "@/lib/admin";
import { useCustomerAuth } from "@/lib/customer-auth";

export const Route = createFileRoute("/mi-cuenta")({
  head: () => ({
    meta: [{ title: "Mi cuenta - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

async function loadOrders() {
  const response = await fetch("/api/store/auth/orders", { credentials: "include" });
  if (!response.ok) throw new Error("No pudimos cargar tus pedidos.");
  return response.json() as Promise<{ orders: AdminOrder[] }>;
}

function itemsLabel(order: AdminOrder) {
  const count = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  if (count === 0) return "Sin items";
  return count === 1 ? "1 item" : `${count} items`;
}

function AccountPage() {
  const { customer, isLoading, logout, updateProfile } = useCustomerAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    setForm({ name: customer.name, phone: customer.phone || "" });
  }, [customer]);

  useEffect(() => {
    if (!customer) return;
    setOrdersLoading(true);
    setOrdersError(null);
    loadOrders()
      .then(({ orders }) => setOrders(orders))
      .catch((error) =>
        setOrdersError(error instanceof Error ? error.message : "No pudimos cargar tus pedidos."),
      )
      .finally(() => setOrdersLoading(false));
  }, [customer]);

  const recentOrders = useMemo(() => orders.slice(0, 8), [orders]);

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/" });
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      await updateProfile(form);
      setEditing(false);
      setProfileMessage("Datos actualizados.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "No pudimos guardar tus datos.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Cargando cuenta...
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6">
        <Sticker color="ink">Mi cuenta</Sticker>
        <h1 className="mb-3 mt-4 font-display text-4xl">Necesitas iniciar sesion</h1>
        <p className="mb-6 text-muted-foreground">
          Entra a tu cuenta para ver tus datos y pedidos.
        </p>
        <TransitionLink
          to="/login?redirect=/mi-cuenta"
          className="inline-flex border border-primary bg-primary px-6 py-3 font-display uppercase text-primary-foreground"
        >
          Ingresar
        </TransitionLink>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <Sticker color="ink">Mi cuenta</Sticker>
      <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="min-w-0 sticker-lg bg-card p-6 md:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center border border-primary bg-primary text-primary-foreground">
              <User className="h-10 w-10" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-4xl">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">{customer.email}</p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {customer.phone || "Sin telefono cargado"}
              </p>
            </div>
            <SmashButton
              type="button"
              variant="ghost"
              onClick={() => setEditing((value) => !value)}
            >
              <PenLine className="h-4 w-4" />
              {editing ? "Cancelar" : "Editar"}
            </SmashButton>
          </div>

          {editing && (
            <form onSubmit={saveProfile} className="mt-6 grid gap-3 border-t border-ink/20 pt-6">
              <input
                className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
                placeholder="Nombre"
                autoComplete="name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <input
                className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
                placeholder="Telefono"
                type="tel"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
              {profileError && (
                <p className="border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">
                  {profileError}
                </p>
              )}
              <SmashButton type="submit" glow disabled={saving}>
                {saving ? "Guardando..." : "Guardar datos"}
              </SmashButton>
            </form>
          )}

          {profileMessage && !editing && (
            <p className="mt-4 border border-emerald-600 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              {profileMessage}
            </p>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <TransitionLink
              to="/menu"
              className="inline-flex items-center justify-center border border-primary bg-primary px-5 py-3 font-display uppercase text-primary-foreground"
            >
              Hacer pedido
            </TransitionLink>
            <SmashButton type="button" variant="ghost" onClick={handleLogout}>
              Cerrar sesion
            </SmashButton>
          </div>
        </div>

        <div className="min-w-0 sticker-lg bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl">Historial</h2>
              <p className="text-sm text-muted-foreground">Tus ultimos pedidos</p>
            </div>
            <PackageCheck className="h-8 w-8 text-primary" />
          </div>

          {ordersLoading && <p className="text-sm text-muted-foreground">Cargando pedidos...</p>}
          {ordersError && (
            <p className="border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">
              {ordersError}
            </p>
          )}
          {!ordersLoading && !ordersError && recentOrders.length === 0 && (
            <div className="border border-ink/20 bg-background p-4 text-sm text-muted-foreground">
              Todavia no hay pedidos en tu cuenta.
            </div>
          )}

          <div className="grid min-w-0 gap-3">
            {recentOrders.map((order) => (
              <article key={order.id} className="min-w-0 border border-ink/20 bg-background p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl">{shortOrderId(order.id)}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <span className="w-fit shrink-0 border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold uppercase text-primary">
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{itemsLabel(order)}</span>
                  <strong className="font-display text-lg">{formatMoney(order.total)}</strong>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Pago {order.payment_method || "A confirmar"} ·{" "}
                  {PAYMENT_STATUS_LABEL[order.payment_status || "pending"]}
                </p>
                {order.order_items?.length ? (
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {order.order_items
                      .map((item) => `${item.quantity}x ${item.product_name}`)
                      .join(" - ")}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
