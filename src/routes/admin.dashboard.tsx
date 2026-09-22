import { fetchAllRows } from "@/lib/fetch-all-rows";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  PackageSearch,
  Power,
  Printer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, StatCard, AdminButton } from "@/components/admin/AdminBits";
import { adminApiFetch, readApiError } from "@/lib/admin-api";
import {
  DEFAULT_SETTINGS,
  formatDateTime,
  formatMoney,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  shortOrderId,
  type AdminOrder,
  type StoreSettings,
} from "@/lib/admin";
import { MENU_SHIFT_LABEL, MENU_SHIFTS, type MenuShift, type Product } from "@/lib/products";
import { toast } from "sonner";
import {
  CashSummaryDialog,
  type CashSummaryDialogData,
} from "@/components/admin/CashSummaryDialog";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard admin - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: Dashboard,
});

const CLOSABLE_STATUSES = ["delivered", "rejected", "cancelled"];

function Dashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [selectedShift, setSelectedShift] = useState<MenuShift>("dinner");
  const [loading, setLoading] = useState(true);
  const [dayBusy, setDayBusy] = useState(false);
  const [dayDialog, setDayDialog] = useState<"start" | "close" | null>(null);
  const [cashSummary, setCashSummary] = useState<CashSummaryDialogData | null>(null);
  const loadVersion = useRef(0);
  const [loadError, setLoadError] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const [
      { data: ordersData, error: ordersError },
      { data: productsData, error: productsError },
      { data: settingsData, error: settingsError },
    ] = await Promise.all([
      fetchAllRows(() =>
        (supabase as any)
          .from("orders")
          .select("id, created_at, status, total, customer_name, customer_phone", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .order("id"),
      ),
      fetchAllRows(() =>
        (supabase as any)
          .from("products")
          .select("*", { count: "exact" })
          .order("sort_order", { ascending: true })
          .order("id"),
      ),
      (supabase as any).from("store_settings").select("*").limit(1).maybeSingle(),
    ]);
    if (version !== loadVersion.current) return;
    if (ordersError || productsError || settingsError) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    setOrders((ordersData as AdminOrder[]) ?? []);
    setProducts((productsData as Product[]) ?? []);
    if (settingsData) setSettings({ ...DEFAULT_SETTINGS, ...(settingsData as StoreSettings) });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("admin-dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, load)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load();
      });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const refreshTimer = window.setInterval(handleVisibilityChange, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(refreshTimer);
      loadVersion.current += 1;
      supabase.removeChannel(channel);
    };
  }, [load]);

  const today = new Date().toDateString();
  const stats = useMemo(() => {
    const todayOrders = orders.filter((order) =>
      settings.current_day_started_at
        ? new Date(order.created_at) >= new Date(settings.current_day_started_at)
        : new Date(order.created_at).toDateString() === today,
    );
    return {
      pending: orders.filter((order) =>
        ["pending", "pending_payment", "pending_confirmation"].includes(order.status),
      ).length,
      confirmedToday: todayOrders.filter((order) =>
        ["confirmed", "preparing", "ready", "delivered"].includes(order.status),
      ).length,
      revenueToday: todayOrders
        .filter((order) => !["rejected", "cancelled"].includes(order.status))
        .reduce((sum, order) => sum + Number(order.total), 0),
      lowStock: products.filter(
        (item) =>
          Number(item.stock_quantity ?? 0) <= Number(item.low_stock_threshold ?? 0) ||
          !item.available,
      ).length,
    };
  }, [orders, products, settings.current_day_started_at, today]);
  const activeDayOrders = useMemo(
    () =>
      orders.filter((order) =>
        settings.current_day_started_at
          ? new Date(order.created_at) >= new Date(settings.current_day_started_at)
          : new Date(order.created_at).toDateString() === today,
      ),
    [orders, settings.current_day_started_at, today],
  );
  const unresolvedDayOrders = activeDayOrders.filter(
    (order) => !CLOSABLE_STATUSES.includes(order.status),
  );

  const startDay = async () => {
    setDayBusy(true);
    try {
      const response = await adminApiFetch("/api/admin/day", {
        method: "POST",
        body: JSON.stringify({ action: "start", shift: selectedShift }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        return toast.error(
          data?.error ?? (await readApiError(response, "No se pudo iniciar el dia.")),
        );
      if (data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...(data.settings as StoreSettings) });
      setDayDialog(null);
      toast.success(
        `Dia iniciado: ${MENU_SHIFT_LABEL[selectedShift]}. La tienda ya acepta pedidos.`,
      );
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar el dia.");
    } finally {
      setDayBusy(false);
    }
  };

  const closeDay = async () => {
    setDayBusy(true);
    try {
      const response = await adminApiFetch("/api/admin/day", {
        method: "POST",
        body: JSON.stringify({ action: "close" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        return toast.error(
          data?.error ?? (await readApiError(response, "No se pudo cerrar el dia.")),
        );
      if (data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...(data.settings as StoreSettings) });
      if (data?.summary) setCashSummary(data.summary as CashSummaryDialogData);
      setDayDialog(null);
      toast.success("Dia cerrado. El resumen quedo guardado.");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cerrar el dia.");
    } finally {
      setDayBusy(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Vista rapida"
        title="Dashboard"
        description="Resumen del dia, pedidos entrantes y alertas operativas del local."
        action={
          <div className="flex flex-wrap gap-2">
            {settings.is_open ? (
              <AdminButton
                variant="danger"
                onClick={() => setDayDialog("close")}
                disabled={dayBusy || !settings.id}
              >
                <Printer className="h-4 w-4" /> Cerrar dia
              </AdminButton>
            ) : (
              <>
                <select
                  value={selectedShift}
                  onChange={(event) => setSelectedShift(event.target.value as MenuShift)}
                  className="min-h-10 rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-100 outline-none focus:border-orange-400"
                >
                  {MENU_SHIFTS.map((shift) => (
                    <option key={shift} value={shift}>
                      {MENU_SHIFT_LABEL[shift]}
                    </option>
                  ))}
                </select>
                <AdminButton
                  onClick={() => setDayDialog("start")}
                  disabled={dayBusy || !settings.id}
                >
                  <Power className="h-4 w-4" /> Iniciar dia
                </AdminButton>
              </>
            )}
            <Link to="/admin/pedidos">
              <AdminButton variant="ghost">Gestionar pedidos</AdminButton>
            </Link>
          </div>
        }
      />

      <div
        className={`mb-6 rounded-lg border p-4 ${
          settings.is_open
            ? "border-emerald-400/40 bg-emerald-500/10"
            : "border-red-400/40 bg-red-500/10"
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Estado del local</p>
        <p className="mt-1 font-display text-3xl">
          {settings.is_open ? "Abierto para pedidos" : "Cerrado"}
        </p>
        <p className="text-sm text-zinc-400">
          {settings.is_open && settings.current_day_started_at
            ? `Turno ${MENU_SHIFT_LABEL[settings.current_menu_shift || "dinner"]} - iniciado: ${formatDateTime(settings.current_day_started_at)}`
            : "Los clientes no pueden confirmar pedidos hasta iniciar el dia."}
        </p>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-100"
        >
          No se pudo actualizar el resumen. Los valores pueden estar desactualizados.
          <button className="ml-2 underline" onClick={load}>
            Reintentar
          </button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="Pedidos pendientes" value={stats.pending} Icon={Clock} tone="orange" />
        <StatCard title="Confirmados hoy" value={stats.confirmedToday} Icon={CheckCircle2} />
        <StatCard title="Vendido hoy" value={formatMoney(stats.revenueToday)} Icon={DollarSign} />
        <StatCard
          title="Bajo stock"
          value={stats.lowStock}
          Icon={AlertTriangle}
          tone={stats.lowStock ? "danger" : "default"}
        />
      </div>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h2 className="font-display text-2xl">Ultimos pedidos</h2>
            <span className="text-xs uppercase text-zinc-500">
              {loading ? "Cargando" : `${orders.length} pedidos`}
            </span>
          </div>
          <div className="divide-y divide-white/10">
            {(showAllOrders ? orders : orders.slice(0, 6)).map((order) => (
              <Link
                key={order.id}
                to="/admin/pedidos"
                className="grid gap-3 p-4 transition-colors hover:bg-white/5 md:grid-cols-[130px_1fr_120px_110px]"
              >
                <span className="font-mono text-sm text-orange-300">{shortOrderId(order.id)}</span>
                <div>
                  <p className="font-semibold text-white">{order.customer_name}</p>
                  <p className="text-sm text-zinc-400">{order.customer_phone}</p>
                </div>
                <span
                  className={`h-fit rounded-full border px-2 py-1 text-center text-xs ${ORDER_STATUS_CLASS[order.status]}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
                <span className="text-right font-display text-xl">{formatMoney(order.total)}</span>
              </Link>
            ))}
            {!loading && orders.length === 0 && (
              <div className="grid place-items-center p-10 text-center text-zinc-500">
                <PackageSearch className="mb-3 h-10 w-10" />
                Todavia no hay pedidos.
              </div>
            )}
          </div>
          {orders.length > 6 && (
            <button
              className="p-4 text-sm text-orange-300"
              onClick={() => setShowAllOrders(!showAllOrders)}
            >
              {showAllOrders ? "Mostrar recientes" : `Ver todos (${orders.length})`}
            </button>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
          <h2 className="font-display text-2xl">Alertas stock</h2>
          <div className="mt-4 space-y-3">
            {products
              .filter(
                (item) =>
                  Number(item.stock_quantity ?? 0) <= Number(item.low_stock_threshold ?? 0) ||
                  !item.available,
              )
              .map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-red-400/30 bg-red-500/10 p-3"
                >
                  <p className="font-semibold text-red-100">{item.name}</p>
                  <p className="text-sm text-red-200/80">
                    {item.available
                      ? `${item.stock_quantity ?? 0} disponibles`
                      : "Sin disponibilidad"}{" "}
                    · minimo {item.low_stock_threshold ?? 0}
                  </p>
                </div>
              ))}
            {products.filter(
              (item) =>
                Number(item.stock_quantity ?? 0) <= Number(item.low_stock_threshold ?? 0) ||
                !item.available,
            ).length === 0 && (
              <p className="rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                Stock sin alertas criticas.
              </p>
            )}
          </div>
        </div>
      </section>

      <CashSummaryDialog
        open={dayDialog === "start"}
        mode="confirm-start"
        title={`Iniciar dia - ${MENU_SHIFT_LABEL[selectedShift]}`}
        busy={dayBusy}
        onClose={() => setDayDialog(null)}
        onConfirm={startDay}
      />
      <CashSummaryDialog
        open={dayDialog === "close"}
        mode="confirm-close"
        title="Cerrar dia"
        busy={dayBusy}
        confirmDisabled={loading || loadError || unresolvedDayOrders.length > 0}
        warning={
          unresolvedDayOrders.length > 0 ? (
            <>
              No podes cerrar el dia porque quedan {unresolvedDayOrders.length} pedido(s) pendientes
              o en curso. Resolvelos en Pedidos antes de hacer el cierre.
            </>
          ) : undefined
        }
        onClose={() => setDayDialog(null)}
        onConfirm={closeDay}
      />
      <CashSummaryDialog
        open={Boolean(cashSummary)}
        data={cashSummary}
        onClose={() => setCashSummary(null)}
      />
    </>
  );
}
