import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Minus,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminBits";
import { supabase } from "@/integrations/supabase/client";
import { adminApiFetch, readApiError } from "@/lib/admin-api";
import { DEFAULT_SETTINGS, formatMoney, productIngredients, type StoreSettings } from "@/lib/admin";
import {
  categoryAvailableForShift,
  DEFAULT_CATEGORIES,
  type MenuShift,
  type Product,
  type ProductCategory,
} from "@/lib/products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/venta-local")({
  head: () => ({
    meta: [{ title: "Venta local - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: LocalSalePage,
});

type Step = "menu" | "checkout";
type DiscountType = "percent" | "fixed";
type PaymentMethod = "efectivo" | "transferencia";

type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  removedIngredients: string[];
  notes: string;
};

function LocalSalePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("menu");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customRemoved, setCustomRemoved] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from("products")
      .select("*")
      .eq("available", true)
      .order("sort_order")
      .then(({ data, error }: { data: Product[] | null; error: unknown }) => {
        if (error) {
          toast.error("No se pudo cargar el menu.");
          return;
        }
        setProducts(data ?? []);
      });

    (supabase as any)
      .from("product_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }: { data: ProductCategory[] | null }) => {
        if (data?.length) setCategories(data);
      });

    (supabase as any)
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: StoreSettings | null }) => {
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      });
  }, []);

  const categoryLabel = (key: string) =>
    categories.find((category) => category.key === key)?.label ?? key;
  const currentShift = settings.current_menu_shift || "dinner";
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.key, category])),
    [categories],
  );
  const isProductAvailableNow = useCallback(
    (product: Product) =>
      categoryAvailableForShift(categoryMap.get(product.category), currentShift as MenuShift),
    [categoryMap, currentShift],
  );

  const visibleProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
        const haystack = [product.name, product.description, productIngredients(product).join(" ")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return matchesCategory && (!cleanQuery || haystack.includes(cleanQuery));
      })
      .sort((a, b) => {
        const availabilityDiff =
          Number(isProductAvailableNow(b)) - Number(isProductAvailableNow(a));
        if (availabilityDiff !== 0) return availabilityDiff;
        return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      });
  }, [categoryFilter, isProductAvailableNow, products, query]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
    [cart],
  );
  const discountAmount = useMemo(() => {
    const value = Number(discountValue) || 0;
    const amount =
      discountType === "percent" ? subtotal * (Math.min(100, Math.max(0, value)) / 100) : value;
    return Math.min(subtotal, Math.max(0, amount));
  }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const openCustomize = (product: Product) => {
    setCustomizing(product);
    setCustomQuantity(1);
    setCustomRemoved([]);
    setCustomNotes("");
  };

  const addCustomizedItem = () => {
    if (!customizing) return;
    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        product: customizing,
        quantity: customQuantity,
        removedIngredients: customRemoved,
        notes: customNotes.trim(),
      },
    ]);
    setCustomizing(null);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const updateNotes = (itemId: string, value: string) => {
    setCart((current) =>
      current.map((item) => (item.id === itemId ? { ...item, notes: value } : item)),
    );
  };

  const resetForm = () => {
    setStep("menu");
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("efectivo");
    setDiscountType("percent");
    setDiscountValue(0);
    setNotes("");
  };

  const saveSale = async () => {
    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    if (!cleanName) return toast.error("Carga el nombre del cliente.");
    if (cart.length === 0) return toast.error("Suma al menos un item.");

    setSaving(true);
    try {
      const response = await adminApiFetch("/api/admin/local-sale", {
        method: "POST",
        body: JSON.stringify({
          customerName: cleanName,
          customerPhone: cleanPhone,
          paymentMethod,
          discountType,
          discountValue,
          notes: notes.trim(),
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            removedIngredients: item.removedIngredients,
            notes: item.notes.trim(),
          })),
        }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response, "No se pudo crear la venta local."));
        return;
      }

      toast.success("Venta cargada como pedido confirmado.");
      resetForm();
      navigate({ to: "/admin/pedidos" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la venta local.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Caja"
        title="Venta local"
        description="Carga por pasos: primero elegis y personalizas el menu, despues cerras la comanda."
      />

      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        <StepButton
          active={step === "menu"}
          index="1"
          title="Menu"
          subtitle={`${itemCount} item(s) en comanda`}
          onClick={() => setStep("menu")}
        />
        <StepButton
          active={step === "checkout"}
          index="2"
          title="Checkout"
          subtitle={formatMoney(total)}
          onClick={() => setStep("checkout")}
        />
      </div>

      {step === "menu" ? (
        <section className="pb-24">
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <AdminInput
                className="pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o ingrediente"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterButton
                active={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
              >
                Todos
              </FilterButton>
              {categories.map((category) => (
                <FilterButton
                  key={category.key}
                  active={categoryFilter === category.key}
                  onClick={() => setCategoryFilter(category.key)}
                >
                  {category.label}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleProducts.map((product) => {
              const availableNow = isProductAvailableNow(product);
              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => openCustomize(product)}
                  disabled={!availableNow}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    availableNow
                      ? "group border-white/10 bg-zinc-900/75 hover:border-orange-400 hover:bg-orange-500 focus:border-orange-400 focus:bg-orange-500 focus:outline-none"
                      : "cursor-not-allowed border-white/10 bg-zinc-950/70 opacity-70",
                  )}
                  aria-label={
                    availableNow
                      ? `Personalizar ${product.name}`
                      : `${product.name} fuera de horario`
                  }
                >
                  <div className="flex min-h-32 flex-col justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-bold uppercase leading-none text-orange-300 group-hover:text-white group-focus:text-white">
                          {categoryLabel(product.category)}
                        </p>
                        {!availableNow && (
                          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase leading-none text-zinc-400">
                            Fuera de turno
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 line-clamp-2 font-display text-2xl leading-none text-white group-hover:text-white group-focus:text-white">
                        {product.name}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400 group-hover:text-white/80 group-focus:text-white/80">
                        {productIngredients(product).join(", ") ||
                          product.description ||
                          "Sin ingredientes cargados"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-2xl text-orange-300 group-hover:text-white group-focus:text-white">
                        {formatMoney(product.price)}
                      </span>
                      {availableNow && (
                        <span className="text-xs font-bold uppercase text-zinc-500 group-hover:text-white/80 group-focus:text-white/80">
                          Tocar para elegir
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {visibleProducts.length === 0 && (
              <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-10 text-center text-zinc-400 md:col-span-2">
                No hay productos para ese filtro.
              </div>
            )}
          </div>

          <div className="fixed bottom-4 left-4 right-4 z-20 lg:left-72">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-lg border border-orange-400/40 bg-black/95 p-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase text-zinc-500">Comanda actual</p>
                <p className="font-display text-2xl text-white">
                  {itemCount} item(s) ·{" "}
                  <span className="text-orange-300">{formatMoney(subtotal)}</span>
                </p>
              </div>
              <AdminButton disabled={cart.length === 0} onClick={() => setStep("checkout")}>
                Ir al checkout <ArrowRight className="h-4 w-4" />
              </AdminButton>
            </div>
          </div>
        </section>
      ) : (
        <CheckoutStep
          cart={cart}
          customerName={customerName}
          customerPhone={customerPhone}
          discountAmount={discountAmount}
          discountType={discountType}
          discountValue={discountValue}
          notes={notes}
          paymentMethod={paymentMethod}
          saving={saving}
          subtotal={subtotal}
          total={total}
          onBack={() => setStep("menu")}
          onCustomerNameChange={setCustomerName}
          onCustomerPhoneChange={setCustomerPhone}
          onDiscountTypeChange={setDiscountType}
          onDiscountValueChange={setDiscountValue}
          onNotesChange={setNotes}
          onPaymentMethodChange={setPaymentMethod}
          onRemoveItem={(itemId) =>
            setCart((current) => current.filter((item) => item.id !== itemId))
          }
          onSave={saveSale}
          onUpdateItemNotes={updateNotes}
          onUpdateQuantity={updateQuantity}
        />
      )}

      {customizing && (
        <CustomizeDialog
          product={customizing}
          quantity={customQuantity}
          removed={customRemoved}
          notes={customNotes}
          onClose={() => setCustomizing(null)}
          onNotesChange={setCustomNotes}
          onQuantityChange={setCustomQuantity}
          onRemovedChange={setCustomRemoved}
          onSubmit={addCustomizedItem}
        />
      )}
    </>
  );
}

function StepButton({
  active,
  index,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  index: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-orange-400 bg-orange-500/15"
          : "border-white/10 bg-zinc-900/70 hover:border-orange-400/40",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md font-display text-xl",
          active ? "bg-orange-500 text-black" : "bg-black text-zinc-400",
        )}
      >
        {index}
      </span>
      <span>
        <span className="block font-display text-2xl leading-none text-white">{title}</span>
        <span className="mt-1 block text-xs text-zinc-500">{subtitle}</span>
      </span>
    </button>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-md border px-3 py-2 text-sm font-bold transition-colors",
        active
          ? "border-orange-400 bg-orange-500 text-black"
          : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-orange-400/40",
      )}
    >
      {children}
    </button>
  );
}

function CustomizeDialog({
  product,
  quantity,
  removed,
  notes,
  onClose,
  onNotesChange,
  onQuantityChange,
  onRemovedChange,
  onSubmit,
}: {
  product: Product;
  quantity: number;
  removed: string[];
  notes: string;
  onClose: () => void;
  onNotesChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
  onRemovedChange: (value: string[]) => void;
  onSubmit: () => void;
}) {
  const ingredients = productIngredients(product);

  const toggleIngredient = (ingredient: string) => {
    onRemovedChange(
      removed.includes(ingredient)
        ? removed.filter((item) => item !== ingredient)
        : [...removed, ingredient],
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-6 max-w-2xl rounded-lg border border-orange-400/30 bg-zinc-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase text-orange-300">Personalizar</p>
            <h2 className="font-display text-4xl leading-none text-white">{product.name}</h2>
            <p className="mt-2 font-display text-3xl text-orange-300">
              {formatMoney(product.price)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 p-2 text-zinc-300 hover:border-orange-400/40"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-zinc-300">Cantidad</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-200"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex h-10 min-w-12 items-center justify-center rounded-md border border-white/10 font-mono text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onQuantityChange(quantity + 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {ingredients.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-zinc-300">Ingredientes</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ingredients.map((ingredient) => {
                  const isRemoved = removed.includes(ingredient);
                  return (
                    <button
                      type="button"
                      key={ingredient}
                      onClick={() => toggleIngredient(ingredient)}
                      className={cn(
                        "flex min-h-11 items-center rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        isRemoved
                          ? "border-orange-400 bg-orange-500 text-black"
                          : "border-white/10 bg-zinc-900 text-zinc-100 hover:border-orange-400/50",
                      )}
                    >
                      <span className={cn("min-w-0", isRemoved && "line-through opacity-70")}>
                        {ingredient}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <AdminField label="Observaciones">
            <AdminTextarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Ej: bien cocida, sin sal, cortar al medio"
            />
          </AdminField>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-3xl text-white">
            {formatMoney(Number(product.price) * quantity)}
          </p>
          <AdminButton onClick={onSubmit}>Sumar a comanda</AdminButton>
        </div>
      </div>
    </div>
  );
}

function CheckoutStep({
  cart,
  customerName,
  customerPhone,
  discountAmount,
  discountType,
  discountValue,
  notes,
  paymentMethod,
  saving,
  subtotal,
  total,
  onBack,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onDiscountTypeChange,
  onDiscountValueChange,
  onNotesChange,
  onPaymentMethodChange,
  onRemoveItem,
  onSave,
  onUpdateItemNotes,
  onUpdateQuantity,
}: {
  cart: CartItem[];
  customerName: string;
  customerPhone: string;
  discountAmount: number;
  discountType: DiscountType;
  discountValue: number;
  notes: string;
  paymentMethod: PaymentMethod;
  saving: boolean;
  subtotal: number;
  total: number;
  onBack: () => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onDiscountTypeChange: (value: DiscountType) => void;
  onDiscountValueChange: (value: number) => void;
  onNotesChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onRemoveItem: (itemId: string) => void;
  onSave: () => void;
  onUpdateItemNotes: (itemId: string, value: string) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-300 hover:text-orange-200"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al menu
      </button>

      <aside className="rounded-lg border border-orange-400/30 bg-zinc-900/90 p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs font-bold uppercase text-orange-300">Pedido local</p>
            <h2 className="font-display text-4xl leading-none text-white">Comanda</h2>
          </div>
          <ReceiptText className="h-6 w-6 text-orange-300" />
        </div>

        <div className="mt-4 grid gap-3">
          <AdminField label="Nombre del cliente">
            <AdminInput
              value={customerName}
              onChange={(event) => onCustomerNameChange(event.target.value)}
              placeholder="Ej: Juan"
            />
          </AdminField>
          <AdminField label="Telefono opcional">
            <AdminInput
              value={customerPhone}
              onChange={(event) => onCustomerPhoneChange(event.target.value)}
              placeholder="Ej: 11 5555 5555"
            />
          </AdminField>
          <AdminField label="Metodo de pago">
            <AdminSelect
              value={paymentMethod}
              onChange={(event) => onPaymentMethodChange(event.target.value as PaymentMethod)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </AdminSelect>
          </AdminField>
        </div>

        <div className="mt-5 space-y-3">
          {cart.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{item.product.name}</p>
                  <p className="text-sm text-zinc-400">
                    {formatMoney(Number(item.product.price) * item.quantity)}
                  </p>
                  {item.removedIngredients.length > 0 && (
                    <p className="mt-1 text-xs text-red-200">
                      Sin: {item.removedIngredients.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <IconButton label="Quitar unidad" onClick={() => onUpdateQuantity(item.id, -1)}>
                    <Minus className="h-4 w-4" />
                  </IconButton>
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-md border border-white/10 font-mono text-sm text-white">
                    {item.quantity}
                  </span>
                  <IconButton label="Agregar unidad" onClick={() => onUpdateQuantity(item.id, 1)}>
                    <Plus className="h-4 w-4" />
                  </IconButton>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                    aria-label="Eliminar item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <AdminInput
                className="mt-3"
                value={item.notes}
                onChange={(event) => onUpdateItemNotes(item.id, event.target.value)}
                placeholder="Observaciones para cocina"
              />
            </div>
          ))}

          {cart.length === 0 && (
            <div className="rounded-md border border-dashed border-white/15 bg-black/20 p-5 text-center text-sm text-zinc-500">
              Todavia no agregaste productos.
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 border-t border-white/10 pt-4">
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <AdminSelect
              value={discountType}
              onChange={(event) => onDiscountTypeChange(event.target.value as DiscountType)}
            >
              <option value="percent">Descuento %</option>
              <option value="fixed">Descuento $</option>
            </AdminSelect>
            <AdminInput
              type="number"
              min={0}
              placeholder="0"
              value={discountValue === 0 ? "" : discountValue}
              onChange={(event) => onDiscountValueChange(Number(event.target.value))}
            />
          </div>
          <AdminField label="Notas generales">
            <AdminTextarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Opcional"
            />
          </AdminField>
        </div>

        <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span>Descuento</span>
            <span>-{formatMoney(discountAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-white">
            <span className="font-display text-2xl">Total</span>
            <span className="font-display text-4xl text-orange-300">{formatMoney(total)}</span>
          </div>
        </div>

        <AdminButton
          className="mt-5 w-full"
          onClick={onSave}
          disabled={saving || cart.length === 0}
        >
          <Banknote className="h-4 w-4" /> {saving ? "Guardando..." : "Confirmar venta"}
        </AdminButton>
      </aside>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-200 hover:border-orange-400/40"
      aria-label={label}
    >
      {children}
    </button>
  );
}
