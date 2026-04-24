import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { resolveImage, type Product } from "@/lib/products";
import { Sticker } from "./Sticker";

const BADGE_COLORS: Record<string, "red" | "mustard" | "cyan" | "pink"> = {
  PICANTE: "red",
  TOP: "mustard",
  VEGGIE: "cyan",
  "2X1": "pink",
};

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const { add } = useCart();

  return (
    <motion.article
      initial={{ opacity: 0, y: 40, rotate: -1 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ type: "spring", stiffness: 220, damping: 22, delay: index * 0.06 }}
      whileHover={{ y: -6, rotate: 0.5 }}
      style={{ perspective: 1000 }}
      className="group relative"
    >
      <div className="sticker-lg relative overflow-hidden bg-card transition-transform group-hover:[transform:rotateX(2deg)_rotateY(-2deg)]">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden border-b-[3px] border-ink bg-cream">
          <motion.img
            src={resolveImage(product.image_url)}
            alt={product.name}
            loading="lazy"
            width={1024}
            height={1024}
            className="h-full w-full object-cover"
            whileHover={{ scale: 1.08, rotate: -2 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
          />
          {/* halftone overlay on hover */}
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
            <span className="font-display text-3xl text-primary">${product.price.toFixed(2)}</span>
            <motion.button
              onClick={() =>
                add({
                  id: product.id,
                  name: product.name,
                  price: Number(product.price),
                  image_url: product.image_url,
                })
              }
              whileHover={{ rotate: -8, scale: 1.08 }}
              whileTap={{ scale: 0.85, rotate: 0 }}
              className="inline-flex h-12 w-12 items-center justify-center border-[3px] border-ink bg-mustard text-ink shadow-[3px_3px_0_0_var(--ink)] hover:shadow-[5px_5px_0_0_var(--ink)] hover:bg-primary hover:text-primary-foreground transition-all"
              aria-label={`Agregar ${product.name}`}
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
            </motion.button>
          </div>
        </div>

        {/* Active red border on hover */}
        <div className="pointer-events-none absolute inset-0 border-[3px] border-primary opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </motion.article>
  );
}
