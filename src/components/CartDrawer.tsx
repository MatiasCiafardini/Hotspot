import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { resolveImage } from "@/lib/products";
import { SmashButton } from "./SmashButton";
import { Link } from "@tanstack/react-router";

export function CartDrawer() {
  const { items, open, setOpen, remove, setQty, total, count } = useCart();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.7 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l-[4px] border-ink bg-cream"
          >
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-primary px-5 py-4 text-primary-foreground">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                <h2 className="font-display text-2xl uppercase tracking-wider">Tu pedido</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar carrito"
                className="inline-flex h-9 w-9 items-center justify-center border-[3px] border-ink bg-cream text-ink hover:bg-mustard transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {count === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <motion.div
                    initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 250, damping: 12 }}
                    className="mb-4 flex h-24 w-24 items-center justify-center border-[4px] border-ink bg-mustard"
                  >
                    <ShoppingBag className="h-10 w-10 text-ink" />
                  </motion.div>
                  <p className="font-display text-2xl uppercase">Vacío como una calle a las 4am</p>
                  <p className="mt-2 text-muted-foreground text-sm">Agregá algo al carrito.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 60, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 60, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                        className="sticker flex items-center gap-3 p-3"
                      >
                        <img
                          src={resolveImage(item.image_url)}
                          alt={item.name}
                          className="h-16 w-16 border-[2px] border-ink object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-display uppercase truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                          <div className="mt-1 inline-flex items-center border-[2px] border-ink">
                            <button
                              onClick={() => setQty(item.id, item.quantity - 1)}
                              className="px-2 py-1 hover:bg-ink hover:text-cream"
                              aria-label="Restar"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-3 font-display text-sm">{item.quantity}</span>
                            <button
                              onClick={() => setQty(item.id, item.quantity + 1)}
                              className="px-2 py-1 hover:bg-ink hover:text-cream"
                              aria-label="Sumar"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => remove(item.id)}
                          aria-label="Eliminar"
                          className="text-ink hover:text-primary transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {count > 0 && (
              <div className="border-t-[3px] border-ink bg-cream p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display uppercase text-lg">Total</span>
                  <span className="font-display text-3xl text-primary">${total.toFixed(2)}</span>
                </div>
                <Link to="/checkout" onClick={() => setOpen(false)} className="block">
                  <SmashButton size="lg" glow className="w-full">
                    Pedir ahora →
                  </SmashButton>
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
