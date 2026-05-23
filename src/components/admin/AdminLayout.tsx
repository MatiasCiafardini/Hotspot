import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  Settings,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo_hotspot.png";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", Icon: BarChart3 },
  { to: "/admin/venta-local", label: "Venta local", Icon: ShoppingBag },
  { to: "/admin/pedidos", label: "Pedidos", Icon: ClipboardList },
  { to: "/admin/historial", label: "Historial", Icon: History },
  { to: "/admin/productos", label: "Productos", Icon: Package },
  { to: "/admin/stock", label: "Stock", Icon: Boxes },
  { to: "/admin/configuracion", label: "Configuracion", Icon: Settings },
] as const;

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate({ to: "/admin" });
        return;
      }

      const { data: isOwner } = await supabase.rpc("has_role", {
        _user_id: sessionData.session.user.id,
        _role: "owner",
      });
      if (!isOwner) {
        await supabase.auth.signOut();
        navigate({ to: "/admin" });
        return;
      }

      if (cancelled) return;
      setChecked(true);
    };

    checkSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/admin" });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin" });
  };

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Verificando acceso...
      </div>
    );
  }

  const sidebar = (
    <AdminSidebar
      pathname={pathname}
      collapsed={collapsed}
      onCollapse={() => setCollapsed((value) => !value)}
      onClose={() => setDrawerOpen(false)}
      onLogout={logout}
    />
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="fixed inset-x-0 top-0 z-30 h-16 border-b border-white/10 bg-black/95 shadow-[0_16px_40px_-32px_rgba(251,146,60,0.7)] lg:hidden" />

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-md border border-orange-400/50 bg-zinc-950 text-orange-300 shadow-lg lg:hidden"
        aria-label="Abrir menu admin"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main
        className={cn(
          "min-h-screen px-4 pb-10 pt-20 transition-[padding] md:px-6 lg:pt-8",
          collapsed ? "lg:pl-28" : "lg:pl-72",
        )}
      >
        {children}
      </main>
    </div>
  );
}

function AdminSidebar({
  pathname,
  collapsed,
  onCollapse,
  onClose,
  onLogout,
}: {
  pathname: string;
  collapsed: boolean;
  onCollapse: () => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-orange-400/30 bg-black/95 text-zinc-100 shadow-[12px_0_40px_-30px_rgba(251,146,60,0.8)] transition-[width]",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <Link to="/admin/dashboard" onClick={onClose} className="flex min-w-0 items-center gap-3">
          <img
            src={logo}
            alt="Hotspot"
            className="h-11 w-11 rounded-md border border-orange-400/50 object-cover"
          />
          {!collapsed && (
            <div>
              <p className="font-display text-xl leading-none text-orange-300">Hotspot</p>
              <p className="text-xs uppercase text-zinc-500">Panel admin</p>
            </div>
          )}
        </Link>
        <button type="button" onClick={onClose} className="lg:hidden" aria-label="Cerrar menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-2 p-3">
        {NAV.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-3 text-sm font-semibold transition-colors",
                active
                  ? "border-orange-400 bg-orange-500 text-black"
                  : "border-transparent text-zinc-300 hover:border-orange-400/40 hover:bg-zinc-900 hover:text-orange-200",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onCollapse}
          className="hidden w-full items-center justify-center rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:border-orange-400/40 hover:text-orange-200 lg:flex"
        >
          {collapsed ? "Abrir" : "Cerrar sidebar"}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/20"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Salir"}
        </button>
      </div>
    </aside>
  );
}
