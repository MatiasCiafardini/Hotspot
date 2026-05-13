import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, AdminInput, AdminPageHeader } from "@/components/admin/AdminBits";
import type { StockItem } from "@/lib/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/stock")({
  head: () => ({
    meta: [{ title: "Stock admin - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: StockPage,
});

function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [draft, setDraft] = useState({ name: "", quantity: 0, low_stock_threshold: 5 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("stock_items")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast.error("Falta crear la tabla stock_items en Supabase.");
      setLoading(false);
      return;
    }
    setItems((data as StockItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (item: StockItem, patch: Partial<StockItem>) => {
    const next = { ...item, ...patch };
    setItems((current) => current.map((i) => (i.id === item.id ? next : i)));
    const { error } = await (supabase as any).from("stock_items").update(patch).eq("id", item.id);
    if (error) {
      setItems((current) => current.map((i) => (i.id === item.id ? item : i)));
      toast.error("No se pudo actualizar stock.");
    }
  };

  const create = async () => {
    const { error } = await (supabase as any)
      .from("stock_items")
      .insert({ ...draft, type: "ingredient", available: true });
    if (error) return toast.error("No se pudo crear el item.");
    toast.success("Item de stock creado.");
    setDraft({ name: "", quantity: 0, low_stock_threshold: 5 });
    load();
  };

  const remove = async (item: StockItem) => {
    const previous = items;
    setItems((current) => current.filter((i) => i.id !== item.id));
    const { error } = await (supabase as any).from("stock_items").delete().eq("id", item.id);
    if (error) {
      setItems(previous);
      toast.error("No se pudo eliminar el item.");
      return;
    }
    toast.success("Item eliminado.");
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Inventario"
        title="Stock"
        description="Items de stock conectados a Supabase, con cantidades, minimo, alertas y disponibilidad."
      />

      <div className="mb-5 grid gap-3 rounded-lg border border-orange-400/30 bg-zinc-900/80 p-4 md:grid-cols-[1fr_150px_150px_auto]">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
          Item
          <AdminInput
            placeholder="Nombre"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
          Stock
          <AdminInput
            type="number"
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
          Minimo
          <AdminInput
            type="number"
            value={draft.low_stock_threshold}
            onChange={(e) => setDraft({ ...draft, low_stock_threshold: Number(e.target.value) })}
          />
        </label>
        <AdminButton onClick={create} disabled={!draft.name}>
          <Save className="h-4 w-4" /> Agregar
        </AdminButton>
      </div>

      {loading ? (
        <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-10 text-center text-zinc-400">
          Cargando stock...
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const low = item.quantity <= item.low_stock_threshold;
            const out = !item.available || item.quantity <= 0;
            return (
              <div
                key={item.id}
                className={`grid gap-3 rounded-lg border bg-zinc-900/70 p-4 md:grid-cols-[1fr_150px_150px_170px_48px] md:items-center ${
                  out ? "border-red-400/40" : low ? "border-orange-400/40" : "border-white/10"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <AdminInput
                      value={item.name}
                      onChange={(e) => update(item, { name: e.target.value })}
                    />
                    {(low || out) && (
                      <AlertTriangle
                        className={out ? "h-4 w-4 text-red-300" : "h-4 w-4 text-orange-300"}
                      />
                    )}
                  </div>
                </div>
                <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
                  Stock
                  <AdminInput
                    type="number"
                    value={item.quantity}
                    onChange={(e) => update(item, { quantity: Number(e.target.value) })}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
                  Minimo
                  <AdminInput
                    type="number"
                    value={item.low_stock_threshold}
                    onChange={(e) => update(item, { low_stock_threshold: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(e) => update(item, { available: e.target.checked })}
                  />
                  Disponible
                </label>
                <AdminButton
                  variant="danger"
                  onClick={() => remove(item)}
                  aria-label={`Eliminar ${item.name}`}
                  className="px-3"
                >
                  <Trash2 className="h-4 w-4" />
                </AdminButton>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
