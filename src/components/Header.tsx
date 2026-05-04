import { useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ShoppingBag, Menu, X, Lock } from "lucide-react";
import logo from "@/assets/logo_hotspot.png";
import { useCart } from "@/lib/cart";
import { TransitionLink } from "@/components/RouteTransitionProvider";
import { useCustomerAuth } from "@/lib/customer-auth";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/menu", label: "Menú" },
  { to: "/sobre", label: "El Spot" },
  { to: "/contacto", label: "Contacto" },
] as const;

export function Header() {
  const { count, setOpen, lastAddedAt } = useCart();
  const { customer, logout } = useCustomerAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink bg-background shadow-[0_12px_24px_-24px_var(--ink)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <TransitionLink to="/" className="flex items-center gap-2">
          <motion.img
            src={logo}
            alt="Hotspot burgers"
            className="h-12 md:h-14 w-auto"
            initial={{ rotate: -4, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            whileHover={{ scale: 1.05 }}
          />
        </TransitionLink>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <TransitionLink
                key={item.to}
                to={item.to}
                className={`relative px-3 py-2 font-display uppercase text-sm tracking-wider transition-colors ${
                  active ? "text-primary" : "text-ink hover:text-primary"
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-primary"
                  />
                )}
              </TransitionLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {customer ? (
            <div className="hidden items-center gap-2 md:flex">
              <TransitionLink
                to="/mi-cuenta"
                className="inline-flex h-10 items-center justify-center border border-ink bg-background px-3 font-display text-xs uppercase text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                Mi cuenta
              </TransitionLink>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 items-center justify-center border border-ink/40 bg-background px-3 font-display text-xs uppercase text-muted-foreground transition-colors hover:border-ink hover:text-foreground"
              >
                Salir
              </button>
            </div>
          ) : (
            <TransitionLink
              to="/login"
              className="hidden h-10 items-center justify-center border border-ink bg-background px-3 font-display text-xs uppercase text-foreground transition-colors hover:bg-foreground hover:text-background md:inline-flex"
            >
              Ingresar
            </TransitionLink>
          )}

          <TransitionLink
            to="/admin"
            aria-label="Acceso dueño"
            className="hidden md:inline-flex h-10 w-10 items-center justify-center border border-ink bg-background text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            <Lock className="h-4 w-4" />
          </TransitionLink>

          <motion.button
            onClick={() => setOpen(true)}
            whileTap={{ scale: 0.9 }}
            className="relative inline-flex h-10 items-center gap-2 border border-primary bg-primary px-3 text-primary-foreground font-display uppercase text-sm shadow-[0_12px_24px_-18px_var(--ink)] transition-shadow hover:shadow-[0_18px_32px_-22px_var(--ink)]"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Carrito</span>
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={lastAddedAt ?? count}
                  initial={{ scale: 0.4, y: -10, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 14 }}
                  className="absolute -top-2 -right-2 flex h-6 min-w-[1.5rem] items-center justify-center border border-ink bg-background text-foreground text-xs font-display"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <button
            className="md:hidden inline-flex h-10 w-10 items-center justify-center border border-ink bg-background"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menú"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.65, 0, 0.35, 1] }}
            className="overflow-hidden border-t border-ink bg-ink text-cream md:hidden"
          >
            <motion.nav
              className="flex flex-col px-4 py-4"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {NAV.concat(
                customer ? ([{ to: "/mi-cuenta", label: "Mi cuenta" }] as any) : ([{ to: "/login", label: "Ingresar" }] as any),
                [{ to: "/admin", label: "🔒 Acceso dueño" } as any],
              ).map((item) => (
                <motion.div
                  key={item.to}
                  variants={{
                    hidden: { x: -30, opacity: 0 },
                    show: { x: 0, opacity: 1 },
                  }}
                >
                  <TransitionLink
                    to={item.to as any}
                    onClick={() => setMobileOpen(false)}
                    className="block py-3 font-display uppercase text-2xl tracking-wider hover:text-primary-glow transition-colors"
                  >
                    {item.label}
                  </TransitionLink>
                </motion.div>
              ))}
              {customer && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-3 text-left font-display text-2xl uppercase tracking-wider text-primary-glow transition-colors hover:text-primary"
                >
                  Salir
                </button>
              )}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
