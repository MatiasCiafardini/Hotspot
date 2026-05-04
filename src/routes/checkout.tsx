import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Clock, Copy, PartyPopper } from "lucide-react";
import { useCart } from "@/lib/cart";
import { resolveImage } from "@/lib/products";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRouteTransition } from "@/components/RouteTransitionProvider";
import { DEFAULT_SETTINGS, formatMoney, type StoreSettings } from "@/lib/admin";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — SMASH" },
      { name: "description", content: "Confirmá tu pedido en 3 pasos." },
    ],
  }),
  component: CheckoutPage,
});

const STEPS = ["Tus datos", "Entrega", "Confirmar"] as const;

type CheckoutItem = ReturnType<typeof useCart>["items"][number];

function buildOrderItem(orderId: string, item: CheckoutItem, includeProductId: boolean) {
  return {
    order_id: orderId,
    product_id: includeProductId ? item.product_id || item.id : null,
    product_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
    base_ingredients: item.base_ingredients,
    removed_ingredients: item.removed_ingredients,
    added_ingredients: item.added_ingredients,
    item_notes: item.item_notes || null,
  };
}

function CheckoutPage() {
  const { items, total, clear } = useCart();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [transferSeconds, setTransferSeconds] = useState(300);
  const { navigateWithTransition } = useRouteTransition();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    method: "pickup" as "pickup" | "delivery",
    address: "",
    notes: "",
  });

  useEffect(() => {
    (supabase as any)
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: StoreSettings | null }) => {
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      });
  }, []);

  useEffect(() => {
    if (step !== 2 || done || submitting || transferSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setTransferSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [done, step, submitting, transferSeconds]);

  const transferTime = useMemo(() => {
    const minutes = Math.floor(transferSeconds / 60);
    const seconds = String(transferSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [transferSeconds]);

  const next = () =>
    setStep((s) => {
      const nextStep = Math.min(STEPS.length - 1, s + 1);
      if (nextStep === 2) setTransferSeconds(300);
      return nextStep;
    });
  const back = () => setStep((s) => Math.max(0, s - 1));

  const copyAlias = async () => {
    try {
      await navigator.clipboard.writeText(settings.transfer_alias);
      toast.success("Alias copiado.");
    } catch {
      toast.error("No pudimos copiar el alias.");
    }
  };

  const submit = async () => {
    if (transferSeconds <= 0) {
      toast.error("El tiempo para transferir vencio. Volve al paso anterior y generamos una nueva ventana.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await (supabase as any)
      .from("orders")
      .insert({
        customer_name: form.name,
        customer_phone: form.phone,
        customer_address: form.method === "delivery" ? form.address : null,
        delivery_method: form.method,
        payment_method: "transferencia",
        payment_status: "pending",
        notes: form.notes || null,
        status: "pending_payment",
        total,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("No pudimos crear el pedido. Probá de nuevo.");
      setSubmitting(false);
      return;
    }

    const { error: itemsError } = await (supabase as any)
      .from("order_items")
      .insert(items.map((item) => buildOrderItem(data.id, item, true)));

    if (itemsError) {
      const { error: retryError } = await (supabase as any)
        .from("order_items")
        .insert(items.map((item) => buildOrderItem(data.id, item, false)));
      if (retryError) {
        toast.error("Error guardando los ítems del pedido.");
        setSubmitting(false);
        return;
      }
    }

    setDone(true);
    clear();
    setSubmitting(false);
  };

  if (items.length === 0 && !done) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6">
        <h1 className="font-display text-4xl mb-2">Tu carrito está vacío</h1>
        <p className="text-muted-foreground mb-6">Agregá algo del menú primero.</p>
        <SmashButton onClick={() => navigateWithTransition("/menu")}>Ir al menú</SmashButton>
      </section>
    );
  }

  if (done) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className="mx-auto mb-6 flex h-28 w-28 items-center justify-center border border-primary bg-primary text-primary-foreground shadow-[0_24px_48px_-32px_var(--ink)]"
        >
          <PartyPopper className="h-14 w-14" />
        </motion.div>
        <h1 className="font-display text-5xl mb-2">¡Listo!</h1>
        <p className="text-muted-foreground mb-6">
          Recibimos tu pedido y quedo pendiente hasta que confirmemos la transferencia.
        </p>
        <SmashButton onClick={() => navigateWithTransition("/")}>Volver al inicio</SmashButton>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <div className="flex flex-wrap gap-2 mb-4">
        <Sticker color="ink">Casi listo</Sticker>
      </div>
      <h1 className="font-display text-5xl md:text-6xl mb-8">
        <span className="bg-ink px-2 text-cream -rotate-1 inline-block">Checkout</span>
      </h1>

      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => {
            const completed = i < step;
            const current = i === step;
            return (
              <div key={label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={{
                      scale: current ? 1.1 : 1,
                      backgroundColor: completed || current ? "var(--primary)" : "var(--cream)",
                      color: completed || current ? "var(--primary-foreground)" : "var(--ink)",
                    }}
                    className="flex h-10 w-10 items-center justify-center border border-ink font-display text-lg"
                  >
                    {completed ? <Check className="h-5 w-5" /> : i + 1}
                  </motion.div>
                  <span className="mt-1 text-xs font-display uppercase">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-2 flex-1 h-1 bg-ink/20 relative overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ width: completed ? "100%" : "0%" }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-y-0 left-0 bg-primary"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sticker-lg bg-card p-6 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-display text-3xl mb-2">¿Quién smashea hoy?</h2>
                <input
                  className="w-full border border-ink bg-background px-4 py-3 font-body focus:outline-none focus:border-primary"
                  placeholder="Tu nombre"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="w-full border border-ink bg-background px-4 py-3 font-body focus:outline-none focus:border-primary"
                  placeholder="Teléfono"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-display text-3xl mb-2">¿Cómo lo querés?</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(["pickup", "delivery"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setForm({ ...form, method: m })}
                      className={`border p-4 font-display uppercase shadow-[0_10px_20px_-18px_var(--ink)] transition-all ${
                        form.method === m ? "border-primary bg-primary text-primary-foreground" : "border-ink bg-background"
                      }`}
                    >
                      {m === "pickup" ? "Retiro" : "Delivery"}
                    </button>
                  ))}
                </div>
                {form.method === "delivery" && (
                  <input
                    className="w-full border border-ink bg-background px-4 py-3 font-body focus:outline-none focus:border-primary"
                    placeholder="Dirección"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                )}
                <textarea
                  className="w-full border border-ink bg-background px-4 py-3 font-body focus:outline-none focus:border-primary min-h-[100px]"
                  placeholder="Notas (sin cebolla, extra picante…)"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-display text-3xl mb-2">Transferi y avisa</h2>
                <div className="border border-primary bg-primary/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-display uppercase text-muted-foreground">Alias</p>
                      <p className="font-display text-3xl text-ink">{settings.transfer_alias}</p>
                    </div>
                    <SmashButton variant="ghost" onClick={copyAlias}>
                      <Copy className="h-4 w-4" /> Copiar
                    </SmashButton>
                  </div>
                  <div className="mt-4 grid gap-2 border-t border-ink/20 pt-4 sm:grid-cols-2">
                    <p className="text-sm text-muted-foreground">
                      Importe exacto: <strong className="text-ink">{formatMoney(total)}</strong>
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground sm:justify-end">
                      <Clock className="h-4 w-4 text-primary" /> Tiempo restante: <strong className="text-ink">{transferTime}</strong>
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Cuando termines la transferencia, toca el boton de abajo. El pedido queda pendiente hasta que el local confirme el pago.
                  </p>
                </div>
                <ul className="divide-y-[2px] divide-ink/20">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2">
                      <img src={resolveImage(i.image_url)} alt="" className="h-12 w-12 border border-ink object-cover" />
                      <div className="flex-1">
                        <p className="font-display uppercase">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{i.quantity} × ${i.price.toFixed(2)}</p>
                        {i.removed_ingredients.length > 0 && (
                          <p className="text-xs text-muted-foreground">Sin: {i.removed_ingredients.join(", ")}</p>
                        )}
                      </div>
                      <span className="font-display">${(i.quantity * i.price).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between border-t border-ink pt-3">
                  <span className="font-display text-xl">Total</span>
                  <span className="font-display text-2xl text-ink">{formatMoney(total)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  No se prepara el pedido hasta que el duenio confirme la transferencia en el panel.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3">
          <SmashButton variant="ghost" onClick={back} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" /> Atrás
          </SmashButton>
          {step < STEPS.length - 1 ? (
            <SmashButton
              onClick={next}
              disabled={
                (step === 0 && (!form.name || !form.phone)) ||
                (step === 1 && form.method === "delivery" && !form.address)
              }
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </SmashButton>
          ) : (
            <SmashButton onClick={submit} disabled={submitting || transferSeconds <= 0} glow>
              {submitting ? "Enviando…" : "Transferencia realizada"}
            </SmashButton>
          )}
        </div>
      </div>
    </section>
  );
}
