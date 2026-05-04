import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CATEGORIES, type Product, type ProductCategory } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu - Hotspot" },
      { name: "description", content: "Mira toda la carta de Hotspot: hamburguesas, sides y bebidas." },
      { property: "og:title", content: "Menu - Hotspot" },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("*").eq("available", true).order("sort_order"),
      (supabase as any).from("product_categories").select("*").eq("active", true).order("sort_order"),
    ]).then(([productsResult, categoriesResult]) => {
        setProducts((productsResult.data as Product[]) ?? []);
        if (categoriesResult.data?.length) setCategories(categoriesResult.data as ProductCategory[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(
    () => (active === "all" ? products : products.filter((p) => p.category === active)),
    [products, active],
  );

  const categoryTabs = [{ key: "all", label: "Todo" }, ...categories];

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 md:px-6 md:pt-12">
      <div className="mb-6 md:mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 20, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="font-display text-5xl md:text-7xl"
        >
          La <span className="bg-ink px-2 text-cream -rotate-1 inline-block">Carta</span>
        </motion.h1>
        <p className="mt-2 text-muted-foreground">Tocá una categoría o pedí lo que más te tire.</p>
      </div>

      <div className="-mx-4 mb-8 overflow-x-auto border-y border-ink bg-background px-4 py-3 shadow-[0_16px_26px_-24px_var(--ink)] md:-mx-6 md:px-6">
        <div className="flex w-max min-w-full gap-2 md:flex-wrap">
        {categoryTabs.map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={`shrink-0 border border-ink px-4 py-2 font-display uppercase text-sm shadow-[0_10px_20px_-18px_var(--ink)] transition-all hover:-translate-y-0.5 hover:border-primary ${
              active === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
        </div>
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
