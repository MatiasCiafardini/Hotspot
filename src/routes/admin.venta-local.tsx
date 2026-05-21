import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Clock,
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
import {
  DEFAULT_SETTINGS,
  extraIngredientPrice,
  formatIngredientList,
  formatMoney,
  productExtraIngredients,
  productIngredients,
  type StoreSettings,
} from "@/lib/admin";
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
type PaymentMethod = "efectivo" | "transferencia" | "dividido";
type DeliveryMethod = "pickup" | "delivery";

type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  removedIngredients: string[];
  addedIngredients: string[];
  notes: string;
};

function cartItemUnitPrice(item: CartItem) {
  return (
    Number(item.product.price) +
    item.addedIngredients.reduce(
      (sum, ingredient) => sum + extraIngredientPrice(item.product, ingredient),
      0,
    )
  );
}

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
  const [customAdded, setCustomAdded] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(DEFAULT_SETTINGS.delivery_fee);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [paymentCashAmount, setPaymentCashAmount] = useState(0);
  const [paymentTransferAmount, setPaymentTransferAmount] = useState(0);
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
        if (data) {
          const nextSettings = { ...DEFAULT_SETTINGS, ...data };
          setSettings(nextSettings);
          setDeliveryFee(Number(nextSettings.delivery_fee) || 0);
        }
      });
  }, []);

  const categoryLabel = (key: string) =>
    categories.find((category) => category.key === key)?.label ?? key;
  const currentShift = settings.current_menu_shift || "dinner";
  const midnightOnlyPickup = currentShift === "midnight";
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.key, category])),
    [categories],
  );
  const isProductAvailableNow = useCallback(
    (product: Product) =>
      categoryAvailableForShift(categoryMap.get(product.category), currentShift as MenuShift),
    [categoryMap, currentShift],
  );

  useEffect(() => {
    if (midnightOnlyPickup && deliveryMethod !== "pickup") {
      setDeliveryMethod("pickup");
      setCustomerAddress("");
    }
  }, [deliveryMethod, midnightOnlyPickup]);

  const visibleProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const availableForShift = isProductAvailableNow(product);
        const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
        const haystack = [product.name, product.description, productIngredients(product).join(" ")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          availableForShift && matchesCategory && (!cleanQuery || haystack.includes(cleanQuery))
        );
      })
      .sort((a, b) => {
        const availabilityDiff =
          Number(isProductAvailableNow(b)) - Number(isProductAvailableNow(a));
        if (availabilityDiff !== 0) return availabilityDiff;
        return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      });
  }, [categoryFilter, isProductAvailableNow, products, query]);
  const visibleCategories = useMemo(
    () => categories.filter((category) => categoryAvailableForShift(category, currentShift)),
    [categories, currentShift],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + cartItemUnitPrice(item) * item.quantity, 0),
    [cart],
  );
  const discountAmount = useMemo(() => {
    const value = Number(discountValue) || 0;
    const amount =
      discountType === "percent" ? subtotal * (Math.min(100, Math.max(0, value)) / 100) : value;
    return Math.min(subtotal, Math.max(0, amount));
  }, [discountType, discountValue, subtotal]);
  const safeDeliveryFee = Math.max(0, Number(deliveryFee) || 0);
  const deliveryAmount = deliveryMethod === "delivery" ? safeDeliveryFee : 0;
  const total = Math.max(0, subtotal - discountAmount + deliveryAmount);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const openCustomize = (product: Product) => {
    setCustomizing(product);
    setCustomQuantity(1);
    setCustomRemoved([]);
    setCustomAdded([]);
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
        addedIngredients: customAdded,
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
    setDeliveryMethod("pickup");
    setCustomerAddress("");
    setDeliveryFee(Number(settings.delivery_fee) || 0);
    setDeliveryTime("");
    setPaymentMethod("efectivo");
    setPaymentCashAmount(0);
    setPaymentTransferAmount(0);
    setDiscountType("percent");
    setDiscountValue(0);
    setNotes("");
  };

  const saveSale = async () => {
    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    const cleanAddress = customerAddress.trim();
    if (!cleanName) return toast.error("Carga el nombre del cliente.");
    if (midnightOnlyPickup && deliveryMethod === "delivery") {
      return toast.error("Durante madrugada solo se permite retiro local.");
    }
    if (deliveryMethod === "delivery" && !cleanAddress) return toast.error("Carga la direccion.");
    if (cart.length === 0) return toast.error("Suma al menos un item.");
    if (paymentMethod === "dividido") {
      const splitTotal = Number(paymentCashAmount || 0) + Number(paymentTransferAmount || 0);
      if (paymentCashAmount <= 0 || paymentTransferAmount <= 0) {
        return toast.error("Carga cuanto paga en efectivo y cuanto por transferencia.");
      }
      if (Math.abs(splitTotal - total) > 0.01) {
        return toast.error("La suma del pago dividido tiene que coincidir con el total.");
      }
    }

    setSaving(true);
    try {
      const response = await adminApiFetch("/api/admin/local-sale", {
        method: "POST",
        body: JSON.stringify({
          customerName: cleanName,
          customerPhone: cleanPhone,
          customerAddress: deliveryMethod === "delivery" ? cleanAddress : "",
          deliveryMethod,
          deliveryFee: deliveryMethod === "delivery" ? safeDeliveryFee : 0,
          deliveryTime,
          paymentMethod,
          paymentCashAmount: paymentMethod === "dividido" ? paymentCashAmount : null,
          paymentTransferAmount: paymentMethod === "dividido" ? paymentTransferAmount : null,
          discountType,
          discountValue,
          notes: notes.trim(),
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            removedIngredients: item.removedIngredients,
            addedIngredients: item.addedIngredients,
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
              {visibleCategories.map((category) => (
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
          customerAddress={customerAddress}
          deliveryMethod={deliveryMethod}
          deliveryFee={deliveryFee}
          deliveryTime={deliveryTime}
          discountAmount={discountAmount}
          discountType={discountType}
          discountValue={discountValue}
          notes={notes}
          paymentMethod={paymentMethod}
          paymentCashAmount={paymentCashAmount}
          paymentTransferAmount={paymentTransferAmount}
          midnightOnlyPickup={midnightOnlyPickup}
          saving={saving}
          subtotal={subtotal}
          total={total}
          onBack={() => setStep("menu")}
          onCustomerNameChange={setCustomerName}
          onCustomerPhoneChange={setCustomerPhone}
          onCustomerAddressChange={setCustomerAddress}
          onDeliveryFeeChange={setDeliveryFee}
          onDeliveryMethodChange={(method) => {
            setDeliveryMethod(method);
            if (method === "delivery") setDeliveryFee(Number(settings.delivery_fee) || 0);
          }}
          onDeliveryTimeChange={setDeliveryTime}
          onDiscountTypeChange={setDiscountType}
          onDiscountValueChange={setDiscountValue}
          onNotesChange={setNotes}
          onPaymentMethodChange={setPaymentMethod}
          onPaymentCashAmountChange={setPaymentCashAmount}
          onPaymentTransferAmountChange={setPaymentTransferAmount}
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
          added={customAdded}
          notes={customNotes}
          onClose={() => setCustomizing(null)}
          onNotesChange={setCustomNotes}
          onQuantityChange={setCustomQuantity}
          onRemovedChange={setCustomRemoved}
          onAddedChange={setCustomAdded}
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
  added,
  notes,
  onClose,
  onAddedChange,
  onNotesChange,
  onQuantityChange,
  onRemovedChange,
  onSubmit,
}: {
  product: Product;
  quantity: number;
  removed: string[];
  added: string[];
  notes: string;
  onClose: () => void;
  onAddedChange: (value: string[]) => void;
  onNotesChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
  onRemovedChange: (value: string[]) => void;
  onSubmit: () => void;
}) {
  const ingredients = productIngredients(product);
  const extraIngredients = productExtraIngredients(product);

  const toggleIngredient = (ingredient: string) => {
    onRemovedChange(
      removed.includes(ingredient)
        ? removed.filter((item) => item !== ingredient)
        : [...removed, ingredient],
    );
  };

  const changeAddedIngredient = (ingredient: string, delta: number) => {
    if (delta > 0) {
      onAddedChange([...added, ingredient]);
      return;
    }
    const index = added.lastIndexOf(ingredient);
    if (index === -1) return;
    onAddedChange(added.filter((_, currentIndex) => currentIndex !== index));
  };

  const unitPrice =
    Number(product.price) +
    added.reduce((sum, ingredient) => sum + extraIngredientPrice(product, ingredient), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-orange-400/30 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-white/10 p-5 pb-4">
          <div>
            <p className="text-xs font-bold uppercase text-orange-300">Personalizar</p>
            <h2 className="font-display text-4xl leading-none text-white">{product.name}</h2>
            <p className="mt-2 font-display text-3xl text-orange-300">{formatMoney(unitPrice)}</p>
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

        <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-5">
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

          {extraIngredients.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-zinc-300">Agregar extras</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {extraIngredients.map((ingredient) => {
                  const count = added.filter((item) => item === ingredient.name).length;
                  return (
                    <div
                      key={ingredient.name}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{ingredient.name}</span>
                        <span className="text-xs text-zinc-500">
                          Extra {formatMoney(ingredient.price)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <IconButton
                          label={`Restar ${ingredient.name}`}
                          onClick={() => changeAddedIngredient(ingredient.name, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </IconButton>
                        <span className="flex h-9 min-w-9 items-center justify-center rounded-md border border-white/10 font-mono text-sm text-white">
                          {count}
                        </span>
                        <IconButton
                          label={`Sumar ${ingredient.name}`}
                          onClick={() => changeAddedIngredient(ingredient.name, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </IconButton>
                      </span>
                    </div>
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

        <div className="shrink-0 flex flex-col gap-2 border-t border-white/10 p-5 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-3xl text-white">{formatMoney(unitPrice * quantity)}</p>
          <AdminButton onClick={onSubmit}>Sumar a comanda</AdminButton>
        </div>
      </div>
    </div>
  );
}

function CheckoutStep({
  cart,
  customerAddress,
  customerName,
  customerPhone,
  deliveryMethod,
  deliveryFee,
  deliveryTime,
  discountAmount,
  discountType,
  discountValue,
  notes,
  paymentMethod,
  paymentCashAmount,
  paymentTransferAmount,
  midnightOnlyPickup,
  saving,
  subtotal,
  total,
  onBack,
  onCustomerAddressChange,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onDeliveryFeeChange,
  onDeliveryMethodChange,
  onDeliveryTimeChange,
  onDiscountTypeChange,
  onDiscountValueChange,
  onNotesChange,
  onPaymentMethodChange,
  onPaymentCashAmountChange,
  onPaymentTransferAmountChange,
  onRemoveItem,
  onSave,
  onUpdateItemNotes,
  onUpdateQuantity,
}: {
  cart: CartItem[];
  customerAddress: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryFee: number;
  deliveryTime: string;
  discountAmount: number;
  discountType: DiscountType;
  discountValue: number;
  notes: string;
  paymentMethod: PaymentMethod;
  paymentCashAmount: number;
  paymentTransferAmount: number;
  midnightOnlyPickup: boolean;
  saving: boolean;
  subtotal: number;
  total: number;
  onBack: () => void;
  onCustomerAddressChange: (value: string) => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onDeliveryFeeChange: (value: number) => void;
  onDeliveryMethodChange: (value: DeliveryMethod) => void;
  onDeliveryTimeChange: (value: string) => void;
  onDiscountTypeChange: (value: DiscountType) => void;
  onDiscountValueChange: (value: number) => void;
  onNotesChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onPaymentCashAmountChange: (value: number) => void;
  onPaymentTransferAmountChange: (value: number) => void;
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
          <AdminField label="Entrega">
            <div className="grid grid-cols-2 gap-2">
              {(["pickup", "delivery"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    if (midnightOnlyPickup && method === "delivery") return;
                    onDeliveryMethodChange(method);
                  }}
                  disabled={midnightOnlyPickup && method === "delivery"}
                  className={cn(
                    "rounded-md border px-3 py-2 font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    deliveryMethod === method
                      ? "border-orange-400 bg-orange-500 text-black"
                      : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-orange-400/40",
                  )}
                >
                  {method === "pickup" ? "Retiro local" : "Delivery"}
                </button>
              ))}
            </div>
          </AdminField>
          {midnightOnlyPickup && (
            <p className="rounded-md border border-orange-400/30 bg-orange-500/10 p-3 text-sm text-orange-100">
              En madrugada solo se permite retiro local.
            </p>
          )}
          {deliveryMethod === "delivery" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <AdminField label="Direccion">
                <AdminInput
                  value={customerAddress}
                  onChange={(event) => onCustomerAddressChange(event.target.value)}
                  placeholder="Calle, numero, piso/depto"
                />
              </AdminField>
              <AdminField label="Costo de envio">
                <AdminInput
                  type="number"
                  min={0}
                  step={1}
                  inputMode="decimal"
                  value={deliveryFee || ""}
                  onChange={(event) => onDeliveryFeeChange(Number(event.target.value))}
                  placeholder="5500"
                />
              </AdminField>
            </div>
          )}
          <AdminField label="Horario de entrega opcional">
            <AdminTimePicker value={deliveryTime} onChange={onDeliveryTimeChange} />
          </AdminField>
          <AdminField label="Metodo de pago">
            <PaymentMethodPicker value={paymentMethod} onChange={onPaymentMethodChange} />
          </AdminField>
          {paymentMethod === "dividido" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Efectivo">
                <AdminInput
                  type="number"
                  min={0}
                  value={paymentCashAmount || ""}
                  onChange={(event) => onPaymentCashAmountChange(Number(event.target.value))}
                  placeholder="0"
                />
              </AdminField>
              <AdminField label="Transferencia">
                <AdminInput
                  type="number"
                  min={0}
                  value={paymentTransferAmount || ""}
                  onChange={(event) => onPaymentTransferAmountChange(Number(event.target.value))}
                  placeholder="0"
                />
              </AdminField>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {cart.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{item.product.name}</p>
                  <p className="text-sm text-zinc-400">
                    {formatMoney(cartItemUnitPrice(item) * item.quantity)}
                  </p>
                  {item.removedIngredients.length > 0 && (
                    <p className="mt-1 text-xs text-red-200">
                      Sin: {formatIngredientList(item.removedIngredients)}
                    </p>
                  )}
                  {item.addedIngredients.length > 0 && (
                    <p className="mt-1 text-xs text-orange-100">
                      Extra: {formatIngredientList(item.addedIngredients)}
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
          {deliveryMethod === "delivery" && (
            <div className="flex items-center justify-between text-zinc-400">
              <span>Envio</span>
              <span>{formatMoney(deliveryFee)}</span>
            </div>
          )}
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

function AdminTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hour = "20", minute = "00"] = value ? value.split(":") : ["20", "00"];
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center gap-3 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-left font-display text-3xl text-white outline-none transition-colors hover:border-orange-400 focus:border-orange-400"
      >
        <Clock className="h-5 w-5 text-orange-300" />
        {value || "Elegir hora"}
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-md border border-orange-400/40 bg-zinc-950 p-3 shadow-2xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="max-h-52 overflow-y-auto pr-1">
              {hours.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => onChange(`${option}:${minute}`)}
                  className={cn(
                    "mb-1 min-h-9 w-full rounded-md px-3 text-center font-mono text-sm transition-colors",
                    option === hour
                      ? "bg-orange-500 text-black"
                      : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="max-h-52 overflow-y-auto pr-1">
              {minutes.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => {
                    onChange(`${hour}:${option}`);
                    setOpen(false);
                  }}
                  className={cn(
                    "mb-1 min-h-9 w-full rounded-md px-3 text-center font-mono text-sm transition-colors",
                    option === minute
                      ? "bg-orange-500 text-black"
                      : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}) {
  const options: { value: PaymentMethod; label: string }[] = [
    { value: "efectivo", label: "Efectivo" },
    { value: "transferencia", label: "Transferencia" },
    { value: "dividido", label: "Pago dividido" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 rounded-md border px-3 py-2 text-sm font-bold transition-colors",
            value === option.value
              ? "border-orange-400 bg-orange-500 text-black"
              : "border-white/10 bg-black/40 text-zinc-200 hover:border-orange-400/50",
          )}
        >
          {option.label}
        </button>
      ))}
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
