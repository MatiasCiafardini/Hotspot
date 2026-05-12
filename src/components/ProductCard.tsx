import { motion } from "framer-motion";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { resolveImage, type Product } from "@/lib/products";
import { formatMoney, productIngredients } from "@/lib/admin";
import { Sticker } from "./Sticker";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SmashButton } from "@/components/SmashButton";

const BADGE_COLORS: Record<string, "red" | "mustard" | "cyan" | "pink" | "ink"> = {
  PICANTE: "ink",
  TOP: "mustard",
  VEGGIE: "cyan",
  "2X1": "pink",
} as const;

const LOCKED_INGREDIENTS = ["pan", "carne", "medallon", "medallón"];

function canRemoveIngredient(ingredient: string) {
  const normalized = ingredient.trim().toLowerCase();
  return !LOCKED_INGREDIENTS.some((locked) => normalized.includes(locked));
}

export function ProductCard({
  product,
  index,
  disabledReason,
  unavailableIngredients = [],
}: {
  product: Product;
  index: number;
  disabledReason?: string;
  unavailableIngredients?: string[];
}) {
  const { add } = useCart();
  const [open, setOpen] = useState(false);
  const ingredients = useMemo(() => productIngredients(product), [product]);
  const disabled = Boolean(disabledReason);
  const unavailableSet = useMemo(
    () => new Set(unavailableIngredients.map((ingredient) => ingredient.trim().toLowerCase())),
    [unavailableIngredients],
  );

  const addProduct = (options: { quantity: number; removed: string[]; notes: string }) => {
    const unavailableRemoved = ingredients.filter((ingredient) =>
      unavailableSet.has(ingredient.trim().toLowerCase()),
    );
    const removed = [...new Set([...options.removed, ...unavailableRemoved])];
    add({
      id: `${product.id}-${Date.now()}`,
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url,
      quantity: options.quantity,
      base_ingredients: ingredients,
      removed_ingredients: removed,
      added_ingredients: [],
      item_notes: options.notes,
    });
    toast.success(`Se anadio ${product.name}`, { duration: 2000 });
    setOpen(false);
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 40, rotate: -0.5 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ type: "spring", stiffness: 220, damping: 22, delay: index * 0.06 }}
        whileHover={{ y: -6 }}
        style={{ perspective: 1000 }}
        className="group relative h-full"
      >
        <button
          type="button"
          onClick={() => {
            if (disabledReason) return toast.info(disabledReason);
            setOpen(true);
          }}
          title={disabledReason}
          className="sticker-lg relative flex h-full min-h-[520px] w-full flex-col overflow-hidden bg-card text-left transition-transform group-hover:[transform:rotateX(1deg)_rotateY(-1deg)]"
        >
          <div className="relative aspect-square shrink-0 overflow-hidden border-b border-ink bg-cream">
            <motion.img
              src={resolveImage(product.image_url)}
              alt={product.name}
              loading="lazy"
              width={1024}
              height={1024}
              className="h-full w-full object-cover"
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
            />
            <div className="absolute inset-0 halftone opacity-0 transition-opacity group-hover:opacity-100" />

            {product.badge && (
              <div className="absolute left-2 top-2 animate-badge-wiggle">
                <Sticker color={BADGE_COLORS[product.badge] ?? "mustard"} rotate={-8}>
                  {product.badge}
                </Sticker>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <h3 className="min-h-[3.5rem] font-display text-2xl leading-none">{product.name}</h3>
            <p className="mt-2 min-h-[5rem] text-sm leading-snug text-muted-foreground line-clamp-4">
              {product.description}
            </p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
              <span className="font-display text-3xl text-ink">{formatMoney(product.price)}</span>
              <span
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center border shadow-[0_12px_24px_-18px_var(--ink)] transition-all ${
                  disabled
                    ? "border-zinc-400 bg-zinc-300 text-zinc-500"
                    : "border-primary bg-primary text-primary-foreground group-hover:bg-primary-glow"
                }`}
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
              </span>
            </div>
          </div>
          {disabledReason && (
            <div className="absolute inset-x-3 top-3 border border-zinc-400 bg-zinc-900/90 px-3 py-2 text-center text-xs font-bold uppercase text-zinc-200">
              {disabledReason}
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 border border-primary opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </motion.article>

      <ProductViewDialog
        product={product}
        ingredients={ingredients}
        unavailableIngredients={unavailableIngredients}
        open={!disabled && open}
        onOpenChange={setOpen}
        onAdd={addProduct}
      />
    </>
  );
}

function ProductViewDialog({
  product,
  ingredients,
  unavailableIngredients,
  open,
  onOpenChange,
  onAdd,
}: {
  product: Product;
  ingredients: string[];
  unavailableIngredients: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (options: { quantity: number; removed: string[]; notes: string }) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [removed, setRemoved] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const unavailableSet = useMemo(
    () => new Set(unavailableIngredients.map((ingredient) => ingredient.trim().toLowerCase())),
    [unavailableIngredients],
  );

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setRemoved(ingredients.filter((ingredient) => unavailableSet.has(ingredient.trim().toLowerCase())));
    setNotes("");
  }, [ingredients, open, product.id, unavailableSet]);

  const toggleIngredient = (ingredient: string, checked: boolean) => {
    if (unavailableSet.has(ingredient.trim().toLowerCase())) return;
    if (!canRemoveIngredient(ingredient)) return;
    setRemoved((current) =>
      checked
        ? [...current, ingredient]
        : current.filter((currentIngredient) => currentIngredient !== ingredient),
    );
  };

  const addToCart = () => {
    onAdd({ quantity, removed, notes });
    setQuantity(1);
    setRemoved([]);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-ink bg-background p-0">
        <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative min-h-[280px] border-b border-ink bg-cream md:border-b-0 md:border-r">
            <img
              src={resolveImage(product.image_url)}
              alt={product.name}
              className="h-full min-h-[280px] w-full object-cover"
            />
            {product.badge && (
              <div className="absolute left-4 top-4">
                <Sticker color={BADGE_COLORS[product.badge] ?? "mustard"} rotate={-8}>
                  {product.badge}
                </Sticker>
              </div>
            )}
          </div>

          <div className="p-5">
            <DialogHeader>
              <p className="text-xs uppercase text-primary">{product.category}</p>
              <DialogTitle className="font-display text-4xl uppercase leading-none md:text-5xl">
                {product.name}
              </DialogTitle>
            </DialogHeader>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
            {unavailableIngredients.length > 0 && (
              <div className="mt-4 border border-yellow-500 bg-yellow-100 px-3 py-2 text-sm font-bold text-yellow-950">
                Sin stock: {unavailableIngredients.join(", ")}. PodÃ©s pedirlo igual, pero sale sin
                esos ingredientes.
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-4 border-y border-ink py-3">
              <span className="font-display text-4xl text-ink">{formatMoney(product.price)}</span>
              <div className="inline-flex h-11 items-center border border-ink">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  className="flex h-full w-11 items-center justify-center hover:bg-ink hover:text-cream"
                  aria-label="Restar"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center font-display text-lg">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => current + 1)}
                  className="flex h-full w-11 items-center justify-center hover:bg-ink hover:text-cream"
                  aria-label="Sumar"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {ingredients.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                  Personalizar
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ingredients.map((ingredient) => {
                    const locked = !canRemoveIngredient(ingredient);
                    const unavailable = unavailableSet.has(ingredient.trim().toLowerCase());
                    return (
                      <label
                        key={ingredient}
                        className={`flex min-h-11 items-center gap-2 border border-ink/30 bg-card px-3 py-2 text-sm ${
                          locked || unavailable ? "cursor-not-allowed opacity-60" : ""
                        } ${unavailable ? "border-yellow-500 bg-yellow-100 text-yellow-950" : ""}`}
                      >
                        <input
                          type="checkbox"
                          disabled={locked || unavailable}
                          checked={removed.includes(ingredient)}
                          onChange={(event) => toggleIngredient(ingredient, event.target.checked)}
                        />
                        <span className="min-w-0 flex-1">{ingredient}</span>
                        {unavailable && (
                          <span className="text-[10px] uppercase text-yellow-900">Sin stock</span>
                        )}
                        {locked && (
                          <span className="text-[10px] uppercase text-muted-foreground">Fijo</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observaciones para cocina"
              className="mt-4 min-h-24 w-full border border-ink bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <SmashButton onClick={addToCart} className="mt-4 w-full">
              Agregar al carrito
            </SmashButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
