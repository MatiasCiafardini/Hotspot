import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useCart } from "@/lib/cart";
import { resolveImage, type Product } from "@/lib/products";
import { productIngredients } from "@/lib/admin";
import { Sticker } from "./Sticker";
import { toast } from "sonner";

const BADGE_COLORS: Record<string, "red" | "mustard" | "cyan" | "pink" | "ink"> = {
  PICANTE: "ink",
  TOP: "mustard",
  VEGGIE: "cyan",
  "2X1": "pink",
} as const;

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const { add } = useCart();
  const ingredients = useMemo(() => productIngredients(product), [product]);

  const addProduct = () => {
    add({
      id: `${product.id}-${Date.now()}`,
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url,
      base_ingredients: ingredients,
      removed_ingredients: [],
      added_ingredients: [],
      item_notes: "",
    });
    toast.success(`Se añadio ${product.name}`, { duration: 2000 });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 40, rotate: -0.5 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ type: "spring", stiffness: 220, damping: 22, delay: index * 0.06 }}
      whileHover={{ y: -6 }}
      style={{ perspective: 1000 }}
      className="group relative"
    >
      <div className="sticker-lg relative overflow-hidden bg-card transition-transform group-hover:[transform:rotateX(1deg)_rotateY(-1deg)]">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden border-b border-ink bg-cream">
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
          {/* Urban texture overlay on hover */}
          <div className="absolute inset-0 halftone opacity-0 transition-opacity group-hover:opacity-100" />

          {product.badge && (
            <div className="absolute top-2 left-2 animate-badge-wiggle">
              <Sticker color={BADGE_COLORS[product.badge] ?? "mustard"} rotate={-8}>
                {product.badge}
              </Sticker>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="font-display text-2xl leading-none">{product.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {product.description}
          </p>
          <div className="flex items-center justify-between pt-2">
            <span className="font-display text-3xl text-ink">${product.price.toFixed(2)}</span>
            <motion.button
              onClick={addProduct}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.85, rotate: 0 }}
              className="inline-flex h-12 w-12 cursor-pointer items-center justify-center border border-primary bg-primary text-primary-foreground shadow-[0_12px_24px_-18px_var(--ink)] transition-all hover:cursor-pointer hover:bg-primary-glow hover:shadow-[0_18px_32px_-22px_var(--ink)]"
              aria-label={`Agregar ${product.name}`}
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
            </motion.button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 border border-primary opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </motion.article>
  );
}
