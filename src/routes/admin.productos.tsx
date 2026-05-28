import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit3, ImageUp, Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CATEGORIES,
  resolveImage,
  type Product,
  type ProductCategory,
} from "@/lib/products";
import { REAL_MENU_CATEGORIES, REAL_MENU_PRODUCTS } from "@/lib/real-menu";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminBits";
import { buildExtraIngredientOptions, formatMoney } from "@/lib/admin";
import { createClientId } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/productos")({
  head: () => ({
    meta: [{ title: "Productos admin - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: ProductsPage,
});

const blank: Partial<Product> = {
  name: "",
  description: "",
  price: 0,
  category: "burgers",
  image_url: "",
  modal_image_url: "",
  badge: "",
  available: true,
  promotion: "",
  stock_quantity: 0,
  low_stock_threshold: 5,
  ingredients: [],
  extra_ingredient_prices: {},
};

const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type ExtraIngredientRow = {
  id: string;
  name: string;
  price: number;
};

function extensionFromFile(file: File) {
  return (
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg"
  );
}

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [editing, setEditing] = useState<Partial<Product>>(blank);
  const [editorOpen, setEditorOpen] = useState(false);
  const [ingredientsText, setIngredientsText] = useState("");
  const [extraIngredientRows, setExtraIngredientRows] = useState<ExtraIngredientRow[]>([]);
  const [uploadingImage, setUploadingImage] = useState<"image_url" | "modal_image_url" | null>(
    null,
  );
  const [importingMenu, setImportingMenu] = useState(false);

  const newBlank = (category = categories[0]?.key || "burgers") => ({ ...blank, category });

  const load = () => {
    (supabase as any)
      .from("products")
      .select("*")
      .order("sort_order")
      .then(({ data }: { data: Product[] | null }) => setProducts(data ?? []));

    (supabase as any)
      .from("product_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }: { data: ProductCategory[] | null }) => {
        if (data?.length) setCategories(data);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const hasRealMenu = products.some((product) => product.name === "BIG MC");
  const parseIngredients = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const rowsFromExtraPrices = (prices: Record<string, number> | null | undefined) =>
    Object.entries(prices ?? {}).map(([name, price]) => ({
      id: createClientId(),
      name,
      price: Number(price) || 0,
    }));

  const extraPricesFromRows = (rows = extraIngredientRows) =>
    Object.fromEntries(
      rows
        .map((row) => [row.name.trim(), Number(row.price) || 0] as const)
        .filter(([name]) => name.length > 0),
    );

  const syncIngredientsFromText = (value = ingredientsText) => {
    const nextIngredients = parseIngredients(value);
    setEditing((current) => ({
      ...current,
      ingredients: nextIngredients,
    }));
    return nextIngredients;
  };

  const openNewEditor = () => {
    setEditing(newBlank());
    setIngredientsText("");
    setExtraIngredientRows([]);
    setEditorOpen(true);
  };

  const openEditEditor = (product: Product) => {
    setEditing(product);
    setIngredientsText((product.ingredients ?? []).join(", "));
    setExtraIngredientRows(rowsFromExtraPrices(product.extra_ingredient_prices));
    setEditorOpen(true);
  };

  const addExtraIngredient = () => {
    setExtraIngredientRows((current) => [...current, { id: createClientId(), name: "", price: 0 }]);
  };

  const updateExtraIngredient = (
    rowId: string,
    patch: Partial<Pick<ExtraIngredientRow, "name" | "price">>,
  ) => {
    setExtraIngredientRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const removeExtraIngredient = (rowId: string) => {
    setExtraIngredientRows((current) => current.filter((row) => row.id !== rowId));
  };

  const syncBurgerStock = async () => {
    const response = await fetch("/api/admin/stock/sync-burgers", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.error ?? "No se pudo sincronizar el stock.");
      return null;
    }
    return data as { created: number; products: number; ingredients: number };
  };

  const importRealMenu = async () => {
    setImportingMenu(true);

    const { error: categoriesError } = await (supabase as any)
      .from("product_categories")
      .upsert(REAL_MENU_CATEGORIES, { onConflict: "key" });
    if (categoriesError) {
      setImportingMenu(false);
      toast.error("No se pudieron cargar las categorias reales.");
      return;
    }

    const { error: pauseError } = await (supabase as any)
      .from("products")
      .update({ available: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (pauseError) {
      setImportingMenu(false);
      toast.error("No se pudieron pausar los productos viejos.");
      return;
    }

    const payload = REAL_MENU_PRODUCTS.map(({ id, ...product }) => ({
      ...product,
      stock_quantity: product.stock_quantity ?? 30,
      low_stock_threshold: product.low_stock_threshold ?? 5,
      ingredients: product.ingredients ?? [],
      extra_ingredient_prices: Object.fromEntries(
        buildExtraIngredientOptions(product.ingredients ?? []).map((extra) => [
          extra.name,
          extra.price,
        ]),
      ),
    }));
    const { error: productsError } = await (supabase as any).from("products").insert(payload);
    if (productsError) {
      setImportingMenu(false);
      toast.error("No se pudo cargar el menu real.");
      return;
    }

    const stockSync = await syncBurgerStock();
    toast.success(
      stockSync?.created
        ? `Menu real cargado. Stock sincronizado: ${stockSync.created} item(s) nuevos.`
        : "Menu real cargado en gestion de productos.",
    );
    setImportingMenu(false);
    load();
  };

  const save = async () => {
    const nextIngredients = syncIngredientsFromText();
    const payload = {
      ...editing,
      price: Number(editing.price || 0),
      stock_quantity: Number(editing.stock_quantity || 0),
      low_stock_threshold: Number(editing.low_stock_threshold || 0),
      ingredients: nextIngredients,
      extra_ingredient_prices: extraPricesFromRows(),
    };
    const request = (nextPayload: Record<string, unknown>) =>
      editing.id
        ? (supabase as any).from("products").update(nextPayload).eq("id", editing.id)
        : (supabase as any).from("products").insert(nextPayload);
    let nextPayload: Record<string, unknown> = payload;
    let { error } = await request(nextPayload);
    if (error?.message?.includes("modal_image_url")) {
      toast.error("Falta actualizar Supabase: agregá la columna modal_image_url en products.");
      return;
    }
    if (error?.message?.includes("extra_ingredient_prices")) {
      const { extra_ingredient_prices: _extraIngredientPrices, ...fallbackPayload } = nextPayload;
      nextPayload = fallbackPayload;
      const retry = await request(nextPayload);
      error = retry.error;
    }
    if (error) return toast.error("No se pudo guardar el producto.");
    const stockSync = payload.category === "burgers" ? await syncBurgerStock() : null;
    toast.success(
      stockSync?.created
        ? `Producto guardado. Stock sincronizado: ${stockSync.created} item(s) nuevos.`
        : "Producto guardado.",
    );
    setEditing(newBlank());
    setIngredientsText("");
    setExtraIngredientRows([]);
    setEditorOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) return toast.error("No se pudo eliminar.");
    toast.success("Producto eliminado.");
    load();
  };

  const uploadImage = async (file: File | null, field: "image_url" | "modal_image_url") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo tiene que ser una imagen.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("La imagen no puede superar los 5 MB.");
      return;
    }

    setUploadingImage(field);
    const path = `products/${Date.now()}-${createClientId()}.${extensionFromFile(file)}`;
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });

    if (error) {
      setUploadingImage(null);
      toast.error("No se pudo subir la imagen. Revisá que exista el bucket product-images.");
      return;
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    setEditing((current) => ({ ...current, [field]: data.publicUrl }));
    setUploadingImage(null);
    toast.success("Imagen cargada.");
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogo"
        title="Productos"
        description="Alta, edicion, imagenes, promociones, stock e ingredientes base que luego ve el cliente al personalizar."
        action={
          <div className="flex flex-wrap gap-2">
            {!hasRealMenu && (
              <AdminButton variant="ghost" onClick={importRealMenu} disabled={importingMenu}>
                {importingMenu ? "Cargando..." : "Cargar menu real"}
              </AdminButton>
            )}
            <AdminButton onClick={openNewEditor}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </AdminButton>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article
            key={product.id}
            className="rounded-lg border border-white/10 bg-zinc-900/70 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-orange-300">{product.category}</p>
                <h2 className="font-display text-3xl">{product.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{product.description}</p>
              </div>
              <span className={product.available ? "text-emerald-300" : "text-red-300"}>
                {product.available ? "Activo" : "Pausado"}
              </span>
            </div>
            <p className="mt-3 font-display text-3xl text-orange-300">
              {formatMoney(product.price)}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Ingredientes: {product.ingredients?.join(", ") || "Sin ingredientes cargados"}
            </p>
            {product.extra_ingredient_prices &&
              Object.values(product.extra_ingredient_prices).some((price) => Number(price) > 0) && (
                <p className="mt-1 text-xs text-orange-200">
                  Extras configurados:{" "}
                  {Object.entries(product.extra_ingredient_prices)
                    .filter(([, price]) => Number(price) > 0)
                    .map(([ingredient, price]) => `${ingredient} ${formatMoney(price)}`)
                    .join(", ")}
                </p>
              )}
            <div className="mt-4 flex gap-2">
              <AdminButton variant="ghost" onClick={() => openEditEditor(product)}>
                <Edit3 className="h-4 w-4" /> Editar
              </AdminButton>
              <AdminButton variant="danger" onClick={() => remove(product.id)}>
                <Trash2 className="h-4 w-4" />
              </AdminButton>
            </div>
          </article>
        ))}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 p-4" onClick={() => setEditorOpen(false)}>
          <div
            className="mx-auto flex max-h-[92vh] max-w-3xl flex-col overflow-hidden rounded-lg border border-orange-400/30 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <h2 className="font-display text-4xl leading-none">
                {editing.id ? "Editar producto" : "Nuevo producto"}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-md border border-white/10 p-2 text-zinc-300 hover:border-orange-400/40"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 overflow-y-auto p-5">
              <AdminField label="Nombre">
                <AdminInput
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </AdminField>
              <AdminField label="Descripcion">
                <AdminTextarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </AdminField>
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Precio">
                  <AdminInput
                    type="number"
                    placeholder="0"
                    value={editing.price ? editing.price : ""}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                </AdminField>
                <AdminField label="Categoria">
                  <AdminSelect
                    value={editing.category || categories[0]?.key || "burgers"}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  >
                    {categories.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.label}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
              </div>
              <AdminField label="Imagen del menu">
                <div className="grid gap-3">
                  {editing.image_url && (
                    <img
                      src={resolveImage(editing.image_url)}
                      alt={editing.name || "Producto"}
                      className="h-40 w-full rounded-md border border-white/10 object-cover"
                    />
                  )}
                  <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-orange-400/40 bg-black/30 p-4 text-center text-sm text-zinc-300 transition-colors hover:border-orange-300 hover:bg-orange-500/10">
                    <ImageUp className="h-6 w-6 text-orange-300" />
                    <span className="font-semibold">
                      {uploadingImage === "image_url" ? "Subiendo imagen..." : "Seleccionar imagen"}
                    </span>
                    <span className="text-xs text-zinc-500">JPG, PNG o WEBP hasta 5 MB</span>
                    <AdminInput
                      type="file"
                      accept="image/*"
                      disabled={Boolean(uploadingImage)}
                      className="sr-only"
                      onChange={(e) => uploadImage(e.target.files?.[0] ?? null, "image_url")}
                    />
                  </label>
                </div>
              </AdminField>
              <AdminField label="Imagen del popup (opcional)">
                <div className="grid gap-3">
                  {editing.modal_image_url && (
                    <img
                      src={resolveImage(editing.modal_image_url)}
                      alt={editing.name || "Producto"}
                      className="h-40 w-full rounded-md border border-white/10 object-cover"
                    />
                  )}
                  <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-orange-400/40 bg-black/30 p-4 text-center text-sm text-zinc-300 transition-colors hover:border-orange-300 hover:bg-orange-500/10">
                    <ImageUp className="h-6 w-6 text-orange-300" />
                    <span className="font-semibold">
                      {uploadingImage === "modal_image_url"
                        ? "Subiendo imagen..."
                        : "Seleccionar imagen"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Si no cargas una, se usa la imagen del menu
                    </span>
                    <AdminInput
                      type="file"
                      accept="image/*"
                      disabled={Boolean(uploadingImage)}
                      className="sr-only"
                      onChange={(e) => uploadImage(e.target.files?.[0] ?? null, "modal_image_url")}
                    />
                  </label>
                </div>
              </AdminField>
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Promocion / badge">
                  <AdminInput
                    value={editing.badge || ""}
                    onChange={(e) => setEditing({ ...editing, badge: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Stock disponible">
                  <AdminInput
                    type="number"
                    value={editing.stock_quantity || 0}
                    onChange={(e) =>
                      setEditing({ ...editing, stock_quantity: Number(e.target.value) })
                    }
                  />
                </AdminField>
              </div>
              <AdminField label="Ingredientes base, separados por coma">
                <AdminTextarea
                  value={ingredientsText}
                  onChange={(e) => {
                    setIngredientsText(e.target.value);
                  }}
                  onBlur={() => syncIngredientsFromText()}
                />
              </AdminField>
              <AdminField label="Ingredientes extra para agregar">
                <div className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3">
                  {extraIngredientRows.length > 0 && (
                    <div className="grid gap-2">
                      {extraIngredientRows.map((ingredient) => (
                        <div
                          key={ingredient.id}
                          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_40px]"
                        >
                          <AdminInput
                            value={ingredient.name}
                            onChange={(event) =>
                              updateExtraIngredient(ingredient.id, { name: event.target.value })
                            }
                            placeholder="Ej: Huevo frito"
                          />
                          <AdminInput
                            type="number"
                            min={0}
                            value={ingredient.price || ""}
                            onChange={(event) =>
                              updateExtraIngredient(ingredient.id, {
                                price: Number(event.target.value),
                              })
                            }
                            placeholder="Precio"
                          />
                          <AdminButton
                            type="button"
                            variant="danger"
                            className="px-0"
                            onClick={() => removeExtraIngredient(ingredient.id)}
                            aria-label={`Eliminar ${ingredient.name || "extra"}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </AdminButton>
                        </div>
                      ))}
                    </div>
                  )}
                  <AdminButton type="button" variant="ghost" onClick={addExtraIngredient}>
                    <Plus className="h-4 w-4" /> Agregar extra
                  </AdminButton>
                </div>
              </AdminField>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={editing.available ?? true}
                  onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                />
                Producto activo
              </label>
              <AdminButton onClick={save}>
                <Save className="h-4 w-4" /> Guardar producto
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
