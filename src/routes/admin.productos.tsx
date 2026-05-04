import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit3, ImageUp, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CATEGORIES, resolveImage, type Product, type ProductCategory } from "@/lib/products";
import { AdminButton, AdminField, AdminInput, AdminPageHeader, AdminSelect, AdminTextarea } from "@/components/admin/AdminBits";
import { formatMoney } from "@/lib/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/productos")({
  head: () => ({ meta: [{ title: "Productos admin - Hotspot" }, { name: "robots", content: "noindex" }] }),
  component: ProductsPage,
});

const blank: Partial<Product> = {
  name: "",
  description: "",
  price: 0,
  category: "burgers",
  image_url: "",
  badge: "",
  available: true,
  promotion: "",
  stock_quantity: 0,
  low_stock_threshold: 5,
  ingredients: [],
};

const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function extensionFromFile(file: File) {
  return file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [editing, setEditing] = useState<Partial<Product>>(blank);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const save = async () => {
    const payload = {
      ...editing,
      price: Number(editing.price || 0),
      stock_quantity: Number(editing.stock_quantity || 0),
      low_stock_threshold: Number(editing.low_stock_threshold || 0),
      ingredients: editing.ingredients ?? [],
    };
    const request = editing.id
      ? (supabase as any).from("products").update(payload).eq("id", editing.id)
      : (supabase as any).from("products").insert(payload);
    const { error } = await request;
    if (error) return toast.error("No se pudo guardar el producto.");
    toast.success("Producto guardado.");
    setEditing(newBlank());
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) return toast.error("No se pudo eliminar.");
    toast.success("Producto eliminado.");
    load();
  };

  const uploadImage = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo tiene que ser una imagen.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("La imagen no puede superar los 5 MB.");
      return;
    }

    setUploadingImage(true);
    const path = `products/${Date.now()}-${crypto.randomUUID()}.${extensionFromFile(file)}`;
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });

    if (error) {
      setUploadingImage(false);
      toast.error("No se pudo subir la imagen. Revisá que exista el bucket product-images.");
      return;
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
    setEditing((current) => ({ ...current, image_url: data.publicUrl }));
    setUploadingImage(false);
    toast.success("Imagen cargada.");
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogo"
        title="Productos"
        description="Alta, edicion, imagenes, promociones, stock e ingredientes base que luego ve el cliente al personalizar."
        action={
          <AdminButton onClick={() => setEditing(newBlank())}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </AdminButton>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <article key={product.id} className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-orange-300">{product.category}</p>
                  <h2 className="font-display text-3xl">{product.name}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{product.description}</p>
                </div>
                <span className={product.available ? "text-emerald-300" : "text-red-300"}>{product.available ? "Activo" : "Pausado"}</span>
              </div>
              <p className="mt-3 font-display text-3xl text-orange-300">{formatMoney(product.price)}</p>
              <p className="mt-2 text-xs text-zinc-500">Ingredientes: {product.ingredients?.join(", ") || "Sin ingredientes cargados"}</p>
              <div className="mt-4 flex gap-2">
                <AdminButton variant="ghost" onClick={() => setEditing(product)}>
                  <Edit3 className="h-4 w-4" /> Editar
                </AdminButton>
                <AdminButton variant="danger" onClick={() => remove(product.id)}>
                  <Trash2 className="h-4 w-4" />
                </AdminButton>
              </div>
            </article>
          ))}
        </div>

        <div className="h-fit rounded-lg border border-orange-400/30 bg-zinc-900/90 p-4">
          <h2 className="font-display text-3xl">{editing.id ? "Editar" : "Nuevo"} producto</h2>
          <div className="mt-4 grid gap-3">
            <AdminField label="Nombre">
              <AdminInput value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </AdminField>
            <AdminField label="Descripcion">
              <AdminTextarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </AdminField>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Precio">
                <AdminInput type="number" value={editing.price || 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              </AdminField>
              <AdminField label="Categoria">
                <AdminSelect value={editing.category || categories[0]?.key || "burgers"} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {categories.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
            </div>
            <AdminField label="Imagen">
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
                  <span className="font-semibold">{uploadingImage ? "Subiendo imagen..." : "Seleccionar imagen"}</span>
                  <span className="text-xs text-zinc-500">JPG, PNG o WEBP hasta 5 MB</span>
                  <AdminInput
                    type="file"
                    accept="image/*"
                    disabled={uploadingImage}
                    className="sr-only"
                    onChange={(e) => uploadImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </AdminField>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Promocion / badge">
                <AdminInput value={editing.badge || ""} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} />
              </AdminField>
              <AdminField label="Stock disponible">
                <AdminInput type="number" value={editing.stock_quantity || 0} onChange={(e) => setEditing({ ...editing, stock_quantity: Number(e.target.value) })} />
              </AdminField>
            </div>
            <AdminField label="Ingredientes base, separados por coma">
              <AdminTextarea
                value={(editing.ingredients || []).join(", ")}
                onChange={(e) => setEditing({ ...editing, ingredients: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
              />
            </AdminField>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={editing.available ?? true} onChange={(e) => setEditing({ ...editing, available: e.target.checked })} />
              Producto activo
            </label>
            <AdminButton onClick={save}>
              <Save className="h-4 w-4" /> Guardar producto
            </AdminButton>
          </div>
        </div>
      </div>
    </>
  );
}
