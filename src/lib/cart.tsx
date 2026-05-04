import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  base_ingredients: string[];
  removed_ingredients: string[];
  added_ingredients: string[];
  item_notes: string;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  clear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  total: number;
  count: number;
  lastAddedAt: number | null;
};

const Ctx = createContext<CartCtx | null>(null);
const CART_STORAGE_KEY = "hotspot-cart";
const LEGACY_CART_STORAGE_KEY = ["sma", "sh", "-cart"].join("");

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [lastAddedAt, setLastAddedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const currentCart = localStorage.getItem(CART_STORAGE_KEY);
      const legacyCart = localStorage.getItem(LEGACY_CART_STORAGE_KEY);
      const rawCart = currentCart || legacyCart || "[]";
      if (!currentCart && legacyCart) localStorage.setItem(CART_STORAGE_KEY, legacyCart);
      const saved = JSON.parse(rawCart) as Partial<CartItem>[];
      setItems(
        saved.map((item) => ({
          id: item.id || crypto.randomUUID(),
          product_id: item.product_id || item.id || "",
          name: item.name || "",
          price: Number(item.price || 0),
          image_url: item.image_url ?? null,
          quantity: Number(item.quantity || 1),
          base_ingredients: item.base_ingredients || [],
          removed_ingredients: item.removed_ingredients || [],
          added_ingredients: item.added_ingredients || [],
          item_notes: item.item_notes || "",
        })),
      );
    } catch {
      setItems([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const add: CartCtx["add"] = (item) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setLastAddedAt(Date.now());
  };

  const remove: CartCtx["remove"] = (id) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const setQty: CartCtx["setQty"] = (id, qty) => {
    if (qty <= 0) return remove(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  };

  const updateItem: CartCtx["updateItem"] = (id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const clear = () => setItems([]);

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return (
    <Ctx.Provider value={{ items, add, remove, setQty, updateItem, clear, open, setOpen, total, count, lastAddedAt }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
