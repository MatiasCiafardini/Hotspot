// Map server image paths (stored as /src/assets/foo.jpg) to bundled imports
import classic from "@/assets/burger-classic.jpg";
import spicy from "@/assets/burger-spicy.jpg";
import doubleB from "@/assets/burger-double.jpg";
import veggie from "@/assets/burger-veggie.jpg";
import fries from "@/assets/side-fries.jpg";
import rings from "@/assets/side-rings.jpg";
import shake from "@/assets/drink-shake.jpg";
import cola from "@/assets/drink-cola.jpg";
import { REAL_MENU_CATEGORIES } from "@/lib/real-menu";

const map: Record<string, string> = {
  "/src/assets/burger-classic.jpg": classic,
  "/src/assets/burger-spicy.jpg": spicy,
  "/src/assets/burger-double.jpg": doubleB,
  "/src/assets/burger-veggie.jpg": veggie,
  "/src/assets/side-fries.jpg": fries,
  "/src/assets/side-rings.jpg": rings,
  "/src/assets/drink-shake.jpg": shake,
  "/src/assets/drink-cola.jpg": cola,
};

export function resolveImage(url: string | null | undefined): string {
  if (!url) return classic;
  return map[url] ?? url;
}

export type ProductCategory = {
  id?: string;
  key: string;
  label: string;
  sort_order?: number | null;
  active?: boolean | null;
  menu_shifts?: MenuShift[] | null;
};

export type MenuShift = "lunch" | "dinner" | "midnight";

export const MENU_SHIFTS: MenuShift[] = ["lunch", "dinner", "midnight"];

export const MENU_SHIFT_LABEL: Record<MenuShift, string> = {
  lunch: "Mediodia",
  dinner: "Cena",
  midnight: "Madrugada",
};

export const DEFAULT_CATEGORIES: ProductCategory[] = [...REAL_MENU_CATEGORIES];

export const CATEGORIES = DEFAULT_CATEGORIES;

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  badge: string | null;
  available: boolean;
  sort_order: number;
  promotion?: string | null;
  stock_quantity?: number | null;
  low_stock_threshold?: number | null;
  ingredients?: string[] | null;
  extra_ingredient_prices?: Record<string, number> | null;
};

export function categoryAvailableForShift(
  category: ProductCategory | undefined,
  shift: MenuShift | null | undefined,
) {
  if (!shift) return false;
  const shifts = category?.menu_shifts?.length
    ? category.menu_shifts
    : (["lunch", "dinner"] as MenuShift[]);
  return shifts.includes(shift);
}
