import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit3, KeyRound, Plus, Save, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminTextarea,
} from "@/components/admin/AdminBits";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/admin";
import {
  DEFAULT_CATEGORIES,
  MENU_SHIFT_LABEL,
  MENU_SHIFTS,
  type MenuShift,
  type ProductCategory,
  type Product,
} from "@/lib/products";
import { resolveImage } from "@/lib/products";
import { toast } from "sonner";

type SettingsTab = "account" | "local" | "categories" | "shipping" | "payments";

const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: "account", label: "Cuenta" },
  { key: "local", label: "Local" },
  { key: "categories", label: "Categorias" },
  { key: "shipping", label: "Costo de envios" },
  { key: "payments", label: "Pagos y comanda" },
];

export const Route = createFileRoute("/admin/configuracion")({
  head: () => ({
    meta: [{ title: "Configuracion admin - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [heroProducts, setHeroProducts] = useState<Product[]>([]);
  const [account, setAccount] = useState({
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [accountSaving, setAccountSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory>({
    key: "",
    label: "",
    sort_order: 0,
    active: true,
    menu_shifts: ["lunch", "dinner"],
  });
  const [editingOriginalKey, setEditingOriginalKey] = useState<string | null>(null);

  const loadCategories = () => {
    fetch("/api/admin/config", { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("No pudimos cargar la configuracion.");
        return response.json() as Promise<{
          settings: StoreSettings | null;
          categories: ProductCategory[];
          products: Product[];
        }>;
      })
      .then(({ settings, categories, products }) => {
        if (settings) setSettings({ ...DEFAULT_SETTINGS, ...settings });
        if (categories.length) setCategories(categories);
        setHeroProducts(products ?? []);
      })
      .catch(() => toast.error("No pudimos cargar la configuracion."));
  };

  useEffect(() => {
    loadCategories();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setAccount((current) => ({
        ...current,
        email: user.email ?? "",
        name:
          (user.user_metadata?.name as string | undefined) ||
          (user.user_metadata?.full_name as string | undefined) ||
          "",
      }));
    });
  }, []);

  const save = async () => {
    if (!settings.accepts_cash && !settings.accepts_transfer) {
      toast.error("Habilita al menos un medio de pago.");
      return;
    }
    if (settings.accepts_transfer && !settings.transfer_alias.trim()) {
      toast.error("Configura el alias antes de habilitar transferencias.");
      return;
    }
    const payload = {
      ...settings,
      transfer_alias: settings.transfer_alias.trim(),
      payment_methods: [
        settings.accepts_cash ? "Efectivo" : null,
        settings.accepts_transfer ? "Transferencia" : null,
      ].filter(Boolean),
    };
    const request = settings.id
      ? (supabase as any)
          .from("store_settings")
          .update(payload)
          .eq("id", settings.id)
          .select()
          .single()
      : (supabase as any).from("store_settings").insert(payload).select().single();
    const { data, error } = await request;
    if (error) return toast.error(error.message || "No se pudo guardar la configuracion.");
    if (data) setSettings({ ...settings, ...(data as StoreSettings) });
    toast.success("Configuracion guardada.");
  };

  const saveAccount = async () => {
    const cleanName = account.name.trim();
    const cleanPassword = account.password.trim();

    if (!cleanName) {
      toast.error("El nombre de la cuenta es obligatorio.");
      return;
    }

    if (cleanPassword && cleanPassword.length < 6) {
      toast.error("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }

    if (cleanPassword && cleanPassword !== account.confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setAccountSaving(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { name: cleanName, full_name: cleanName },
      ...(cleanPassword ? { password: cleanPassword } : {}),
    });
    setAccountSaving(false);

    if (error) {
      toast.error(error.message || "No se pudo actualizar la cuenta.");
      return;
    }

    setAccount({
      email: data.user?.email ?? account.email,
      name: cleanName,
      password: "",
      confirmPassword: "",
    });
    toast.success("Cuenta actualizada.");
  };

  const resetCategoryForm = () => {
    setEditingCategory({
      key: "",
      label: "",
      sort_order: categories.length + 1,
      active: true,
      menu_shifts: ["lunch", "dinner"],
    });
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
      menu_shifts: editingCategory.menu_shifts?.length
        ? editingCategory.menu_shifts
        : ["lunch", "dinner"],
    };
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: editingCategory.id,
        ...payload,
        originalKey: editingOriginalKey,
      }),
    });
    if (!response.ok) return toast.error("No se pudo guardar la categoria.");

    toast.success("Categoria guardada.");
    resetCategoryForm();
    loadCategories();
  };

  const editCategory = (category: ProductCategory) => {
    setEditingCategory({
      ...category,
      menu_shifts: category.menu_shifts?.length ? category.menu_shifts : MENU_SHIFTS,
    });
    setEditingOriginalKey(category.key);
  };

  const toggleCategoryShift = (shift: MenuShift, checked: boolean) => {
    const current = editingCategory.menu_shifts?.length ? editingCategory.menu_shifts : [];
    const next = checked
      ? [...new Set([...current, shift])]
      : current.filter((item) => item !== shift);
    setEditingCategory({ ...editingCategory, menu_shifts: next });
  };

  const removeCategory = async (category: ProductCategory) => {
    if (!category.id) return;
    const response = await fetch("/api/admin/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: category.id }),
    });
    if (!response.ok) return toast.error("No se pudo eliminar la categoria.");
    toast.success("Categoria eliminada.");
    if (editingCategory.id === category.id) resetCategoryForm();
    loadCategories();
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Local"
        title="Configuracion"
        description="Datos del local, pagos activos, mensajes y parametros de impresion conectados a Supabase."
      />

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-zinc-900/70 p-2">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-10 rounded-md border px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === tab.key
                ? "border-orange-400 bg-orange-500 text-black"
                : "border-transparent text-zinc-300 hover:border-orange-400/40 hover:bg-zinc-800 hover:text-orange-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "account" && (
          <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-orange-400/40 bg-orange-500/15 text-orange-200">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-3xl">Cuenta</h2>
                <p className="mt-1 text-sm text-zinc-400">Perfil de acceso al panel admin.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <AdminField label="Email">
                <AdminInput value={account.email} readOnly className="text-zinc-400" />
              </AdminField>
              <AdminField label="Nombre">
                <AdminInput
                  value={account.name}
                  onChange={(e) => setAccount({ ...account, name: e.target.value })}
                  placeholder="Nombre del admin"
                />
              </AdminField>
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Nueva contraseña">
                  <AdminInput
                    type="password"
                    autoComplete="new-password"
                    value={account.password}
                    onChange={(e) => setAccount({ ...account, password: e.target.value })}
                    placeholder="Dejar vacio para no cambiar"
                  />
                </AdminField>
                <AdminField label="Confirmar contraseña">
                  <AdminInput
                    type="password"
                    autoComplete="new-password"
                    value={account.confirmPassword}
                    onChange={(e) => setAccount({ ...account, confirmPassword: e.target.value })}
                    placeholder="Repetir contraseña"
                  />
                </AdminField>
              </div>
              <AdminButton onClick={saveAccount} disabled={accountSaving}>
                <KeyRound className="h-4 w-4" /> {accountSaving ? "Guardando..." : "Guardar cuenta"}
              </AdminButton>
            </div>
          </section>
        )}

        {activeTab === "local" && (
          <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
            <h2 className="font-display text-3xl">Datos del local</h2>
            <div className="mt-4 grid gap-3">
              <AdminField label="Nombre del local">
                <AdminInput
                  value={settings.store_name}
                  onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                />
              </AdminField>
              <AdminField label="Logo URL">
                <AdminInput
                  value={settings.logo_url || ""}
                  onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                />
              </AdminField>
              <AdminField label="Hamburguesa destacada en el inicio">
                <select
                  value={settings.hero_product_id || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, hero_product_id: e.target.value || null })
                  }
                  className="min-h-11 w-full rounded-md border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
                >
                  <option value="">Automatica (primera hamburguesa disponible)</option>
                  {heroProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}{product.available ? "" : " (pausada)"}
                    </option>
                  ))}
                </select>
              </AdminField>
              {settings.hero_product_id &&
                heroProducts.find((product) => product.id === settings.hero_product_id) && (
                  <img
                    src={resolveImage(
                      heroProducts.find((product) => product.id === settings.hero_product_id)
                        ?.image_url,
                    )}
                    alt="Vista previa del hero"
                    className="h-36 w-full rounded-md border border-white/15 object-cover sm:w-64"
                  />
                )}
              <AdminField label="Horarios">
                <AdminInput
                  value={settings.hours}
                  onChange={(e) => setSettings({ ...settings, hours: e.target.value })}
                />
              </AdminField>
              <AdminField label="Telefono / contacto">
                <AdminInput
                  value={settings.contact_phone}
                  onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                />
              </AdminField>
              <AdminField label="Direccion">
                <AdminInput
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                />
              </AdminField>
              <AdminField label="Alias transferencia">
                <AdminInput
                  value={settings.transfer_alias}
                  onChange={(e) => setSettings({ ...settings, transfer_alias: e.target.value })}
                />
              </AdminField>
              <AdminButton onClick={save}>
                <Save className="h-4 w-4" /> Guardar configuracion
              </AdminButton>
            </div>
          </section>
        )}

        {activeTab === "categories" && (
          <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">Categorías</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Administran los filtros del menú y el selector al crear productos.
                </p>
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
                        key: editingCategory.id
                          ? editingCategory.key
                          : categoryKeyFromLabel(e.target.value),
                      })
                    }
                  />
                </AdminField>
                <AdminField label="Clave">
                  <AdminInput
                    value={editingCategory.key}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        key: categoryKeyFromLabel(e.target.value),
                      })
                    }
                  />
                </AdminField>
                <AdminField label="Orden">
                  <AdminInput
                    type="number"
                    value={editingCategory.sort_order ?? 0}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, sort_order: Number(e.target.value) })
                    }
                  />
                </AdminField>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={editingCategory.active ?? true}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, active: e.target.checked })
                  }
                />
                Categoría visible
              </label>
              <div className="grid gap-2 rounded-md border border-white/10 bg-black/30 p-3">
                <p className="text-sm font-semibold text-zinc-300">Disponible en</p>
                <div className="flex flex-wrap gap-3">
                  {MENU_SHIFTS.map((shift) => (
                    <label key={shift} className="flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={(editingCategory.menu_shifts || []).includes(shift)}
                        onChange={(event) => toggleCategoryShift(shift, event.target.checked)}
                      />
                      {MENU_SHIFT_LABEL[shift]}
                    </label>
                  ))}
                </div>
              </div>
              <AdminButton onClick={saveCategory}>
                <Save className="h-4 w-4" /> Guardar categoría
              </AdminButton>
            </div>

            <div className="mt-5 grid gap-2">
              {categories.map((category) => (
                <div
                  key={category.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3"
                >
                  <div>
                    <p className="font-semibold text-white">{category.label}</p>
                    <p className="text-xs text-zinc-500">
                      {category.key} - orden {category.sort_order ?? 0} -{" "}
                      {category.active === false ? "oculta" : "visible"} -{" "}
                      {(category.menu_shifts?.length ? category.menu_shifts : MENU_SHIFTS)
                        .map((shift) => MENU_SHIFT_LABEL[shift])
                        .join(" + ")}
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
        )}

        {activeTab === "payments" && (
          <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
            <h2 className="font-display text-3xl">Pagos y comanda</h2>
            <div className="mt-4 grid gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={settings.accepts_cash}
                  onChange={(e) => setSettings({ ...settings, accepts_cash: e.target.checked })}
                />
                Acepta efectivo
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={settings.accepts_transfer}
                  onChange={(e) => setSettings({ ...settings, accepts_transfer: e.target.checked })}
                />
                Acepta transferencia
              </label>
              <AdminField label="Mensaje automatico para pedidos">
                <AdminTextarea
                  value={settings.automatic_message}
                  onChange={(e) => setSettings({ ...settings, automatic_message: e.target.value })}
                />
              </AdminField>
              <AdminField label="Mensaje de confirmacion para efectivo">
                <AdminTextarea
                  value={settings.cash_confirmation_message}
                  onChange={(e) =>
                    setSettings({ ...settings, cash_confirmation_message: e.target.value })
                  }
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Variables: {"{nombre}"}, {"{pedido}"}, {"{total}"} y {"{entrega}"}.
                </p>
              </AdminField>
              <AdminField label="Ancho comanda en mm">
                <AdminInput
                  type="number"
                  value={settings.print_width_mm}
                  onChange={(e) =>
                    setSettings({ ...settings, print_width_mm: Number(e.target.value) })
                  }
                />
              </AdminField>
              <AdminButton onClick={save}>
                <Save className="h-4 w-4" /> Guardar configuracion
              </AdminButton>
            </div>
          </section>
        )}

        {activeTab === "shipping" && (
          <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5">
            <h2 className="font-display text-3xl">Costo de envios</h2>
            <div className="mt-4 grid gap-3">
              <AdminField label="Costo de envio predeterminado">
                <AdminInput
                  type="number"
                  min={0}
                  step={1}
                  inputMode="decimal"
                  value={settings.delivery_fee ?? DEFAULT_SETTINGS.delivery_fee}
                  onChange={(e) =>
                    setSettings({ ...settings, delivery_fee: Number(e.target.value) })
                  }
                  placeholder="5500"
                />
              </AdminField>
              <AdminButton onClick={save}>
                <Save className="h-4 w-4" /> Guardar costo de envio
              </AdminButton>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
