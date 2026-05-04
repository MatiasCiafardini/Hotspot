import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit3, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminButton, AdminField, AdminInput, AdminPageHeader, AdminTextarea } from "@/components/admin/AdminBits";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/admin";
import { DEFAULT_CATEGORIES, type ProductCategory } from "@/lib/products";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracion")({
  head: () => ({ meta: [{ title: "Configuracion admin - Hotspot" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [editingCategory, setEditingCategory] = useState<ProductCategory>({ key: "", label: "", sort_order: 0, active: true });
  const [editingOriginalKey, setEditingOriginalKey] = useState<string | null>(null);

  const loadCategories = () => {
    (supabase as any)
      .from("product_categories")
      .select("*")
      .order("sort_order")
      .then(({ data, error }: { data: ProductCategory[] | null; error: Error | null }) => {
        if (error) {
          toast.error("Falta crear la tabla product_categories en Supabase.");
          return;
        }
        if (data?.length) setCategories(data);
      });
  };

  useEffect(() => {
    (supabase as any)
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: { data: StoreSettings | null; error: Error | null }) => {
        if (error) {
          toast.error("Falta crear la tabla store_settings en Supabase.");
          return;
        }
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      });
    loadCategories();
  }, []);

  const save = async () => {
    const payload = {
      ...settings,
      payment_methods: [settings.accepts_cash ? "Efectivo" : null, settings.accepts_transfer ? "Transferencia" : null].filter(Boolean),
    };
    const request = settings.id
      ? (supabase as any).from("store_settings").update(payload).eq("id", settings.id).select().single()
      : (supabase as any).from("store_settings").insert(payload).select().single();
    const { data, error } = await request;
    if (error) return toast.error("No se pudo guardar la configuracion.");
    if (data) setSettings({ ...settings, ...(data as StoreSettings) });
    toast.success("Configuracion guardada.");
  };

  const resetCategoryForm = () => {
    setEditingCategory({ key: "", label: "", sort_order: categories.length + 1, active: true });
    setEditingOriginalKey(null);
  };

  const categoryKeyFromLabel = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const saveCategory = async () => {
    const key = (editingCategory.key || categoryKeyFromLabel(editingCategory.label)).trim();
    const label = editingCategory.label.trim();
    if (!key || !label) {
      toast.error("Completá nombre y clave de la categoría.");
      return;
    }

    const payload = {
      key,
      label,
      sort_order: Number(editingCategory.sort_order ?? 0),
      active: editingCategory.active ?? true,
    };
    const request = editingCategory.id
      ? (supabase as any).from("product_categories").update(payload).eq("id", editingCategory.id).select().single()
      : (supabase as any).from("product_categories").insert(payload).select().single();
    const { error } = await request;
    if (error) return toast.error("No se pudo guardar la categoría.");

    if (editingOriginalKey && editingOriginalKey !== key) {
      await (supabase as any).from("products").update({ category: key }).eq("category", editingOriginalKey);
    }

    toast.success("Categoría guardada.");
    resetCategoryForm();
    loadCategories();
  };

  const editCategory = (category: ProductCategory) => {
    setEditingCategory({ ...category });
    setEditingOriginalKey(category.key);
  };

  const removeCategory = async (category: ProductCategory) => {
    if (!category.id) return;
    const { error } = await (supabase as any).from("product_categories").delete().eq("id", category.id);
    if (error) return toast.error("No se pudo eliminar la categoría.");
    toast.success("Categoría eliminada.");
    if (editingCategory.id === category.id) resetCategoryForm();
    loadCategories();
  };

  return (
    <>
      <AdminPageHeader eyebrow="Local" title="Configuracion" description="Datos del local, pagos activos, mensajes y parametros de impresion conectados a Supabase." />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
          <h2 className="font-display text-3xl">Datos del local</h2>
          <div className="mt-4 grid gap-3">
            <AdminField label="Nombre del local">
              <AdminInput value={settings.store_name} onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} />
            </AdminField>
            <AdminField label="Logo URL">
              <AdminInput value={settings.logo_url || ""} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} />
            </AdminField>
            <AdminField label="Horarios">
              <AdminInput value={settings.hours} onChange={(e) => setSettings({ ...settings, hours: e.target.value })} />
            </AdminField>
            <AdminField label="Telefono / contacto">
              <AdminInput value={settings.contact_phone} onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })} />
            </AdminField>
            <AdminField label="Direccion">
              <AdminInput value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
            </AdminField>
            <AdminField label="Alias transferencia">
              <AdminInput value={settings.transfer_alias} onChange={(e) => setSettings({ ...settings, transfer_alias: e.target.value })} />
            </AdminField>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl">Categorías</h2>
              <p className="mt-1 text-sm text-zinc-400">Administran los filtros del menú y el selector al crear productos.</p>
            </div>
            <AdminButton variant="ghost" onClick={resetCategoryForm}>
              <Plus className="h-4 w-4" /> Nueva
            </AdminButton>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
              <AdminField label="Nombre">
                <AdminInput
                  value={editingCategory.label}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      label: e.target.value,
                      key: editingCategory.id ? editingCategory.key : categoryKeyFromLabel(e.target.value),
                    })
                  }
                />
              </AdminField>
              <AdminField label="Clave">
                <AdminInput value={editingCategory.key} onChange={(e) => setEditingCategory({ ...editingCategory, key: categoryKeyFromLabel(e.target.value) })} />
              </AdminField>
              <AdminField label="Orden">
                <AdminInput
                  type="number"
                  value={editingCategory.sort_order ?? 0}
                  onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: Number(e.target.value) })}
                />
              </AdminField>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={editingCategory.active ?? true}
                onChange={(e) => setEditingCategory({ ...editingCategory, active: e.target.checked })}
              />
              Categoría visible
            </label>
            <AdminButton onClick={saveCategory}>
              <Save className="h-4 w-4" /> Guardar categoría
            </AdminButton>
          </div>

          <div className="mt-5 grid gap-2">
            {categories.map((category) => (
              <div key={category.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3">
                <div>
                  <p className="font-semibold text-white">{category.label}</p>
                  <p className="text-xs text-zinc-500">
                    {category.key} · orden {category.sort_order ?? 0} · {category.active === false ? "oculta" : "visible"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <AdminButton variant="ghost" onClick={() => editCategory(category)}>
                    <Edit3 className="h-4 w-4" /> Editar
                  </AdminButton>
                  <AdminButton variant="danger" onClick={() => removeCategory(category)}>
                    <Trash2 className="h-4 w-4" />
                  </AdminButton>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
          <h2 className="font-display text-3xl">Pagos y comanda</h2>
          <div className="mt-4 grid gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={settings.accepts_cash} onChange={(e) => setSettings({ ...settings, accepts_cash: e.target.checked })} />
              Acepta efectivo
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={settings.accepts_transfer} onChange={(e) => setSettings({ ...settings, accepts_transfer: e.target.checked })} />
              Acepta transferencia
            </label>
            <AdminField label="Mensaje automatico para pedidos">
              <AdminTextarea value={settings.automatic_message} onChange={(e) => setSettings({ ...settings, automatic_message: e.target.value })} />
            </AdminField>
            <AdminField label="Ancho comanda en mm">
              <AdminInput type="number" value={settings.print_width_mm} onChange={(e) => setSettings({ ...settings, print_width_mm: Number(e.target.value) })} />
            </AdminField>
            <AdminButton onClick={save}>
              <Save className="h-4 w-4" /> Guardar configuracion
            </AdminButton>
          </div>
        </section>
      </div>
    </>
  );
}
