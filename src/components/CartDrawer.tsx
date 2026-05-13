import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { type CartItem, useCart } from "@/lib/cart";
import { resolveImage } from "@/lib/products";
import { SmashButton } from "./SmashButton";
import { TransitionLink } from "@/components/RouteTransitionProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const LOCKED_INGREDIENTS = ["pan", "carne", "medallon", "medallón"];

function canRemoveIngredient(ingredient: string) {
  const normalized = ingredient.trim().toLowerCase();
  return !LOCKED_INGREDIENTS.some((locked) => normalized.includes(locked));
}

export function CartDrawer() {
  const { items, open, setOpen, remove, setQty, updateItem, total, count } = useCart();
  const [customizing, setCustomizing] = useState<CartItem | null>(null);

  return (
    <>
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
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-ink bg-background"
            >
              <div className="flex items-center justify-between border-b border-ink bg-ink px-5 py-4 text-cream">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  <h2 className="font-display text-2xl uppercase tracking-wider">Tu pedido</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar carrito"
                  className="inline-flex h-9 w-9 items-center justify-center border border-cream bg-cream text-ink hover:bg-primary transition-colors"
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
                      className="mb-4 flex h-24 w-24 items-center justify-center border border-ink bg-primary"
                    >
                      <ShoppingBag className="h-10 w-10 text-ink" />
                    </motion.div>
                    <p className="font-display text-2xl uppercase">
                      Vacío como una calle a las 4am
                    </p>
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
                            className="h-16 w-16 border border-ink object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-display uppercase truncate">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ${item.price.toFixed(2)}
                            </p>
                            {item.removed_ingredients.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                Sin: {item.removed_ingredients.join(", ")}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center border border-ink">
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
                              {item.base_ingredients.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setCustomizing(item)}
                                  className="inline-flex items-center gap-1 border border-primary bg-primary px-2 py-1 text-xs font-bold text-primary-foreground hover:bg-primary-glow"
                                >
                                  <SlidersHorizontal className="h-3 w-3" />
                                  Personalizar
                                </button>
                              )}
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
                <div className="border-t border-ink bg-background p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display uppercase text-lg">Total</span>
                    <span className="font-display text-3xl text-ink">${total.toFixed(2)}</span>
                  </div>
                  <TransitionLink to="/checkout" onClick={() => setOpen(false)} className="block">
                    <SmashButton size="lg" glow className="w-full">
                      Pedir ahora →
                    </SmashButton>
                  </TransitionLink>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <CustomizeDialog
        item={customizing}
        onClose={() => setCustomizing(null)}
        onSave={(patch) => {
          if (!customizing) return;
          updateItem(customizing.id, patch);
          setCustomizing(null);
        }}
      />
    </>
  );
}

function CustomizeDialog({
  item,
  onClose,
  onSave,
}: {
  item: CartItem | null;
  onClose: () => void;
  onSave: (patch: Pick<CartItem, "removed_ingredients" | "item_notes">) => void;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!item) return;
    setRemoved(item.removed_ingredients.filter(canRemoveIngredient));
    setNotes(item.item_notes);
  }, [item]);

  if (!item) return null;

  const toggleIngredient = (ingredient: string, checked: boolean) => {
    if (!canRemoveIngredient(ingredient)) return;
    setRemoved((current) =>
      checked
        ? [...current, ingredient]
        : current.filter((currentIngredient) => currentIngredient !== ingredient),
    );
  };

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-ink bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl uppercase">
            Personalizar {item.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-bold uppercase text-muted-foreground">
              Quitar ingredientes
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {item.base_ingredients.map((ingredient) => {
                const locked = !canRemoveIngredient(ingredient);
                return (
                  <button
                    type="button"
                    key={ingredient}
                    disabled={locked}
                    onClick={() => toggleIngredient(ingredient, !removed.includes(ingredient))}
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                      locked ? "cursor-not-allowed opacity-60" : ""
                    } ${
                      removed.includes(ingredient)
                        ? "border-red-600 bg-red-950 text-red-100"
                        : "border-ink/30 bg-card hover:border-primary"
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 ${
                        removed.includes(ingredient) ? "line-through opacity-70" : ""
                      }`}
                    >
                      {ingredient}
                    </span>
                    {locked && (
                      <span className="text-[10px] uppercase text-muted-foreground">Fijo</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observaciones por producto"
            className="min-h-24 w-full rounded-md border border-ink bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <SmashButton
            onClick={() =>
              onSave({
                removed_ingredients: removed.filter(canRemoveIngredient),
                item_notes: notes,
              })
            }
            className="w-full"
          >
            Guardar personalizacion
          </SmashButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
