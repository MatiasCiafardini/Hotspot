// Map server image paths (stored as /src/assets/foo.jpg) to bundled imports
import classic from "@/assets/burger-classic.jpg";
import spicy from "@/assets/burger-spicy.jpg";
import doubleB from "@/assets/burger-double.jpg";
import veggie from "@/assets/burger-veggie.jpg";
import fries from "@/assets/side-fries.jpg";
import rings from "@/assets/side-rings.jpg";
import shake from "@/assets/drink-shake.jpg";
import cola from "@/assets/drink-cola.jpg";

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

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "burgers", label: "Hamburguesas" },
  { key: "sides", label: "Sides" },
  { key: "drinks", label: "Bebidas" },
];

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
};
