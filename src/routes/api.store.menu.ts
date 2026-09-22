import { fetchAllRows } from "@/lib/fetch-all-rows";
import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_SETTINGS } from "@/lib/admin";
import { REAL_MENU_CATEGORIES, REAL_MENU_PRODUCTS } from "@/lib/real-menu";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";

export const Route = createFileRoute("/api/store/menu")({
  server: {
    handlers: {
      GET: async () => {
        const [
          { data: products, error: productsError },
          { data: categories, error: categoriesError },
          { data: settings, error: settingsError },
          { data: stockItems, error: stockError },
        ] = await Promise.all([
          fetchAllRows(() =>
            (supabaseAdmin as any)
              .from("products")
              .select("*", { count: "exact" })
              .order("sort_order")
              .order("id"),
          ),
          fetchAllRows(() =>
            (supabaseAdmin as any)
              .from("product_categories")
              .select("*", { count: "exact" })
              .eq("active", true)
              .order("sort_order")
              .order("id"),
          ),
          (supabaseAdmin as any).from("store_settings").select("*").limit(1).maybeSingle(),
          fetchAllRows(() =>
            (supabaseAdmin as any)
              .from("stock_items")
              .select("name, type, quantity, available", { count: "exact" })
              .eq("type", "ingredient")
              .order("id"),
          ),
        ]);

        const error = productsError || categoriesError || settingsError || stockError;
        if (error) return json({ error: error.message }, { status: 500 });

        const allProducts = products ?? [];
        const loadedProducts = allProducts.filter(
          (product: { available?: boolean }) => product.available !== false,
        );
        const hasRealMenu = allProducts.some(
          (product: { name?: string }) => product.name === "BIG MC",
        );

        return json({
          products: allProducts.length ? loadedProducts : REAL_MENU_PRODUCTS,
          categories: hasRealMenu && categories?.length ? categories : REAL_MENU_CATEGORIES,
          settings: settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS,
          stockItems: stockItems ?? [],
        });
      },
      POST: methodNotAllowed,
    },
  },
});
