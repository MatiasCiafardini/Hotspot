import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  categoryAvailableForShift,
  DEFAULT_CATEGORIES,
  MENU_SHIFT_LABEL,
  type Product,
  type ProductCategory,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { DEFAULT_SETTINGS, type StockItem, type StoreSettings } from "@/lib/admin";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu - Hotspot" },
      {
        name: "description",
        content: "Mira toda la carta de Hotspot: hamburguesas, sides y bebidas.",
      },
      { property: "og:title", content: "Menu - Hotspot" },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    fetch("/api/store/menu")
      .then((response) => {
        if (!response.ok) throw new Error("No pudimos cargar el menu.");
        return response.json() as Promise<{
          products: Product[];
          categories: ProductCategory[];
          settings: StoreSettings;
          stockItems?: StockItem[];
        }>;
      })
      .then(({ products, categories, settings, stockItems }) => {
        setProducts(products);
        setCategories(categories.length ? categories : DEFAULT_CATEGORIES);
        setSettings({ ...DEFAULT_SETTINGS, ...settings });
        setStockItems(stockItems ?? []);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setCategories(DEFAULT_CATEGORIES);
        setStockItems([]);
        setLoading(false);
      });
  }, []);

  const categoryTabs = [{ key: "all", label: "Todo" }, ...categories];
  const currentShift = settings.current_menu_shift || "dinner";
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.key, category])),
    [categories],
  );
  const isProductAvailableNow = useCallback(
    (product: Product) =>
      categoryAvailableForShift(categoryMap.get(product.category), currentShift),
    [categoryMap, currentShift],
  );
  const unavailableIngredientMap = useMemo(() => {
    const unavailable = new Set(
      stockItems
        .filter(
          (item) => item.type === "ingredient" && (!item.available || Number(item.quantity) <= 0),
        )
        .map((item) => item.name.trim().toLowerCase()),
    );

    return new Map(
      products.map((product) => [
        product.id,
        (product.ingredients ?? []).filter((ingredient) =>
          unavailable.has(ingredient.trim().toLowerCase()),
        ),
      ]),
    );
  }, [products, stockItems]);

  const filtered = useMemo(() => {
    const visibleCategories = new Set(
      categories
        .filter((category) => categoryAvailableForShift(category, settings.current_menu_shift))
        .map((category) => category.key),
    );
    const shiftProducts = products.filter((product) => visibleCategories.has(product.category));
    const visible =
      active === "all" ? shiftProducts : shiftProducts.filter((p) => p.category === active);
    return [...visible].sort(
      (a, b) => Number(isProductAvailableNow(b)) - Number(isProductAvailableNow(a)),
    );
  }, [active, categories, isProductAvailableNow, products, settings.current_menu_shift]);

  const visibleCategoryTabs = categoryTabs.filter(
    (category) =>
      category.key === "all" ||
      categoryAvailableForShift(
        categories.find((item) => item.key === category.key),
        settings.current_menu_shift,
      ),
  );

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
        <p className="mt-2 text-muted-foreground">
          {settings.is_open && settings.current_menu_shift
            ? `Turno activo: ${MENU_SHIFT_LABEL[currentShift]}`
            : `Carta visible: ${MENU_SHIFT_LABEL[currentShift]}. El local esta cerrado para pedidos.`}
        </p>
      </div>

      <div className="-mx-4 mb-8 overflow-x-auto border-y border-ink bg-background px-4 py-3 shadow-[0_16px_26px_-24px_var(--ink)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-6 md:px-6">
        <div className="flex w-max min-w-full gap-2 md:flex-wrap">
          {visibleCategoryTabs.map((c) => (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={`min-h-11 shrink-0 border border-ink px-4 py-2 font-display uppercase text-sm shadow-[0_10px_20px_-18px_var(--ink)] transition-all hover:-translate-y-0.5 hover:border-primary ${
                active === c.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-ink"
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
          {!loading && filtered.length === 0 && (
            <div className="sticker-lg col-span-full bg-card p-8 text-center">
              <h2 className="font-display text-4xl">Local cerrado</h2>
              <p className="mt-2 text-muted-foreground">
                Todavia no hay productos cargados para visualizar en este turno.
              </p>
            </div>
          )}
          {filtered.map((p, i) => {
            const availableNow = isProductAvailableNow(p);
            return (
              <ProductCard
                key={p.id}
                product={p}
                index={i}
                disabledReason={
                  !settings.is_open
                    ? "El local esta cerrado"
                    : !availableNow
                      ? "No disponible en este horario"
                      : undefined
                }
                unavailableIngredients={unavailableIngredientMap.get(p.id) ?? []}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
