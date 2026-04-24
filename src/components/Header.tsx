import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ShoppingBag, Menu, X, Lock } from "lucide-react";
import logo from "@/assets/logo-smash.png";
import { useCart } from "@/lib/cart";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/menu", label: "Menú" },
  { to: "/sobre", label: "El Spot" },
  { to: "/contacto", label: "Contacto" },
] as const;

export function Header() {
  const { count, setOpen, lastAddedAt } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <motion.img
            src={logo}
            alt="SMASH burgers"
            className="h-12 md:h-14 w-auto"
            initial={{ rotate: -8, scale: 0.6, opacity: 0 }}
            animate={{ rotate: -2, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            whileHover={{ rotate: 2, scale: 1.05 }}
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
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
                    className="absolute -bottom-0.5 left-2 right-2 h-1 bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/admin"
            aria-label="Acceso dueño"
            className="hidden md:inline-flex h-10 w-10 items-center justify-center border-[3px] border-ink bg-cream text-ink hover:bg-ink hover:text-cream transition-colors"
          >
            <Lock className="h-4 w-4" />
          </Link>

          <motion.button
            onClick={() => setOpen(true)}
            whileTap={{ scale: 0.9 }}
            className="relative inline-flex h-10 items-center gap-2 border-[3px] border-ink bg-primary px-3 text-primary-foreground font-display uppercase text-sm shadow-[3px_3px_0_0_var(--ink)] hover:shadow-[5px_5px_0_0_var(--ink)] transition-shadow"
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
                  className="absolute -top-2 -right-2 flex h-6 min-w-[1.5rem] items-center justify-center border-2 border-ink bg-mustard text-ink text-xs font-display"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <button
            className="md:hidden inline-flex h-10 w-10 items-center justify-center border-[3px] border-ink bg-cream"
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
            className="overflow-hidden border-t-[3px] border-ink bg-ink text-cream md:hidden"
          >
            <motion.nav
              className="flex flex-col px-4 py-4"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {NAV.concat([{ to: "/admin", label: "🔒 Acceso dueño" } as any]).map((item) => (
                <motion.div
                  key={item.to}
                  variants={{
                    hidden: { x: -30, opacity: 0 },
                    show: { x: 0, opacity: 1 },
                  }}
                >
                  <Link
                    to={item.to as any}
                    onClick={() => setMobileOpen(false)}
                    className="block py-3 font-display uppercase text-2xl tracking-wider hover:text-primary-glow transition-colors"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
