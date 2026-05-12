import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json, methodNotAllowed } from "@/lib/server/customer-auth";
import { DEFAULT_STORE_ID } from "@/lib/server/customer-session";

type StockItemRow = {
  name: string;
  type: string;
};

type BurgerProductRow = {
  name: string;
  ingredients: string[] | null;
};

function keyFor(name: string, type: string) {
  return `${type}:${name.trim().toLowerCase()}`;
}

async function syncBurgerStock() {
  const { data: burgers, error: burgersError } = await (supabaseAdmin as any)
    .from("products")
    .select("name, ingredients")
    .eq("store_id", DEFAULT_STORE_ID)
    .eq("category", "burgers")
    .eq("available", true)
    .order("sort_order", { ascending: true });

  if (burgersError) throw burgersError;

  const { data: stockItems, error: stockError } = await (supabaseAdmin as any)
    .from("stock_items")
    .select("name, type")
    .eq("store_id", DEFAULT_STORE_ID);

  if (stockError) throw stockError;

  const existing = new Set(
    ((stockItems as StockItemRow[] | null) ?? []).map((item) => keyFor(item.name, item.type)),
  );
  const rows: Array<{
    store_id: number;
    name: string;
    type: "product" | "ingredient";
    quantity: number;
    low_stock_threshold: number;
    available: boolean;
  }> = [];

  for (const burger of (burgers as BurgerProductRow[] | null) ?? []) {
    const productKey = keyFor(burger.name, "product");
    if (!existing.has(productKey)) {
      existing.add(productKey);
      rows.push({
        store_id: DEFAULT_STORE_ID,
        name: burger.name,
        type: "product",
        quantity: 100,
        low_stock_threshold: 10,
        available: true,
      });
    }

    for (const rawIngredient of burger.ingredients ?? []) {
      const ingredient = rawIngredient.trim();
      if (!ingredient) continue;

      const ingredientKey = keyFor(ingredient, "ingredient");
      if (existing.has(ingredientKey)) continue;

      existing.add(ingredientKey);
      rows.push({
        store_id: DEFAULT_STORE_ID,
        name: ingredient,
        type: "ingredient",
        quantity: 1000,
        low_stock_threshold: 100,
        available: true,
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await (supabaseAdmin as any).from("stock_items").insert(rows);
    if (insertError) throw insertError;
  }

  return {
    created: rows.length,
    products: rows.filter((row) => row.type === "product").length,
    ingredients: rows.filter((row) => row.type === "ingredient").length,
  };
}

export const Route = createFileRoute("/api/admin/stock/sync-burgers")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return json(await syncBurgerStock());
        } catch (error) {
          return json(
            { error: error instanceof Error ? error.message : "No se pudo sincronizar stock." },
            { status: 500 },
          );
        }
      },
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
