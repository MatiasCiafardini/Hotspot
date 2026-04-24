import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Product } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menú — SMASH" },
      { name: "description", content: "Mirá toda la carta de SMASH: hamburguesas, sides y bebidas." },
      { property: "og:title", content: "Menú — SMASH" },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("available", true)
      .order("sort_order")
      .then(({ data }) => {
        setProducts((data as Product[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(
    () => (active === "all" ? products : products.filter((p) => p.category === active)),
    [products, active],
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 20, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="font-display text-5xl md:text-7xl"
        >
          La <span className="bg-mustard px-2 -rotate-1 inline-block">Carta</span>
        </motion.h1>
        <p className="mt-2 text-muted-foreground">Tocá una categoría o pedí lo que más te tire.</p>
      </div>

      {/* Category tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {[{ key: "all", label: "Todo" }, ...CATEGORIES].map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={`border-[3px] border-ink px-4 py-2 font-display uppercase text-sm shadow-[3px_3px_0_0_var(--ink)] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_0_var(--ink)] ${
              active === c.key ? "bg-primary text-primary-foreground" : "bg-cream text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="sticker-lg aspect-[3/4] animate-pulse bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
