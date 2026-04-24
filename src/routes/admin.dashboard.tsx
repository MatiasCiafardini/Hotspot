import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, ShoppingBag, DollarSign, Clock, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SMASH" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  delivery_method: string;
  notes: string | null;
  total: number;
  status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
  created_at: string;
};

const STATUS_OPTIONS: Order["status"][] = ["pending", "preparing", "ready", "delivered", "cancelled"];
const STATUS_COLOR: Record<Order["status"], string> = {
  pending: "bg-mustard text-ink",
  preparing: "bg-cyan text-ink",
  ready: "bg-primary text-primary-foreground",
  delivered: "bg-ink text-cream",
  cancelled: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<Order["status"], string> = {
  pending: "Pendiente",
  preparing: "Cocinando",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/admin" });
        return;
      }
      setAuthChecked(true);
      const { data: ord, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error("Solo el dueño puede ver pedidos.");
      setOrders((ord as Order[]) ?? []);
      setLoading(false);
    };
    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/admin" });
    });

    // realtime
    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .then(({ data }) => setOrders((data as Order[]) ?? []));
      })
      .subscribe();

    return () => {
      sub.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const updateStatus = async (id: string, status: Order["status"]) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error("No se pudo actualizar.");
    toast.success(`Marcado como ${STATUS_LABEL[status]}`);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin" });
  };

  if (!authChecked) return null;

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    revenue: orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total), 0),
  };

  const cards = [
    { title: "Pedidos", value: stats.total, Icon: ShoppingBag, color: "bg-mustard" },
    { title: "Pendientes", value: stats.pending, Icon: Clock, color: "bg-primary text-primary-foreground" },
    { title: "Recaudado", value: `$${stats.revenue.toFixed(0)}`, Icon: DollarSign, color: "bg-cyan" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex gap-2 mb-2">
            <Sticker color="red">Dashboard</Sticker>
          </div>
          <h1 className="font-display text-5xl md:text-6xl">Pedidos</h1>
        </div>
        <SmashButton onClick={logout} variant="ink">
          <LogOut className="h-4 w-4" /> Salir
        </SmashButton>
      </div>

      {/* Stat cards as bricks */}
      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 30, rotate: -2 + i }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 16, delay: i * 0.08 }}
            className={`sticker-lg p-5 ${c.color}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm uppercase">{c.title}</span>
              <c.Icon className="h-5 w-5" />
            </div>
            <div className="mt-2 font-display text-4xl">{c.value}</div>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : orders.length === 0 ? (
        <div className="sticker-lg bg-card p-10 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-display text-2xl">Sin pedidos todavía</p>
          <p className="text-muted-foreground text-sm">Cuando entren pedidos los vas a ver acá en tiempo real.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o, i) => (
            <motion.article
              key={o.id}
              initial={{ opacity: 0, y: 40, rotate: i % 2 ? -1 : 1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18, delay: i * 0.04 }}
              className="sticker-lg bg-card p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">{o.customer_name}</h3>
                <span className={`border-[2px] border-ink px-2 py-0.5 text-xs font-display uppercase ${STATUS_COLOR[o.status]}`}>
                  {STATUS_LABEL[o.status]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                📞 {o.customer_phone}
                {o.customer_address && <><br />📍 {o.customer_address}</>}
              </p>
              {o.notes && (
                <p className="border-l-[3px] border-primary pl-2 text-sm italic">{o.notes}</p>
              )}
              <div className="flex items-center justify-between pt-2 border-t-[2px] border-ink">
                <span className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="font-display text-2xl text-primary">${Number(o.total).toFixed(2)}</span>
              </div>
              <select
                value={o.status}
                onChange={(e) => updateStatus(o.id, e.target.value as Order["status"])}
                className="w-full border-[3px] border-ink bg-cream px-3 py-2 font-display text-sm uppercase focus:outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
