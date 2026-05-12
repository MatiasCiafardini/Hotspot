import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_SETTINGS } from "@/lib/admin";
import { REAL_MENU_CATEGORIES, REAL_MENU_PRODUCTS } from "@/lib/real-menu";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";

export const Route = createFileRoute("/api/store/menu")({
  server: {
    handlers: {
      GET: async () => {
        const [{ data: products }, { data: categories }, { data: settings }, { data: stockItems }] =
          await Promise.all([
          (supabaseAdmin as any)
            .from("products")
            .select("*")
            .eq("available", true)
            .order("sort_order"),
          (supabaseAdmin as any)
            .from("product_categories")
            .select("*")
            .eq("active", true)
            .order("sort_order"),
          (supabaseAdmin as any).from("store_settings").select("*").limit(1).maybeSingle(),
          (supabaseAdmin as any)
            .from("stock_items")
            .select("name, type, quantity, available")
            .eq("type", "ingredient"),
        ]);

        const loadedProducts = products ?? [];
        const hasRealMenu = loadedProducts.some(
          (product: { name?: string }) => product.name === "BIG MC",
        );

        return json({
          products: hasRealMenu ? loadedProducts : REAL_MENU_PRODUCTS,
          categories: hasRealMenu && categories?.length ? categories : REAL_MENU_CATEGORIES,
          settings: settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS,
          stockItems: stockItems ?? [],
        });
      },
      POST: methodNotAllowed,
    },
  },
});
