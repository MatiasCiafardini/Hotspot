import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { useCart } from "@/lib/cart";
import { resolveImage } from "@/lib/products";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

function CheckoutPage() {
  const { items, total, clear } = useCart();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    method: "pickup" as "pickup" | "delivery",
    address: "",
    notes: "",
  });

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: form.name,
        customer_phone: form.phone,
        customer_address: form.method === "delivery" ? form.address : null,
        delivery_method: form.method,
        notes: form.notes || null,
        total,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("No pudimos crear el pedido. Probá de nuevo.");
      setSubmitting(false);
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((i) => ({
        order_id: data.id,
        product_id: i.id,
        product_name: i.name,
        unit_price: i.price,
        quantity: i.quantity,
      })),
    );

    if (itemsError) {
      toast.error("Error guardando los ítems del pedido.");
      setSubmitting(false);
      return;
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
        <SmashButton onClick={() => navigate({ to: "/menu" })}>Ir al menú</SmashButton>
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
          className="mx-auto mb-6 flex h-28 w-28 items-center justify-center border-[4px] border-ink bg-primary text-primary-foreground shadow-[8px_8px_0_0_var(--ink)]"
        >
          <PartyPopper className="h-14 w-14" />
        </motion.div>
        <h1 className="font-display text-5xl spray-text mb-2">¡Listo!</h1>
        <p className="text-muted-foreground mb-6">
          Recibimos tu pedido. Te llamamos al teléfono que dejaste para confirmar.
        </p>
        <SmashButton onClick={() => navigate({ to: "/" })}>Volver al inicio</SmashButton>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <div className="flex flex-wrap gap-2 mb-4">
        <Sticker color="red">Casi listo</Sticker>
      </div>
      <h1 className="font-display text-5xl md:text-6xl mb-8">
        <span className="bg-mustard px-2 -rotate-1 inline-block">Checkout</span>
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
                    className="flex h-10 w-10 items-center justify-center border-[3px] border-ink font-display text-lg"
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
                  className="w-full border-[3px] border-ink bg-cream px-4 py-3 font-body focus:outline-none focus:bg-mustard/30"
                  placeholder="Tu nombre"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="w-full border-[3px] border-ink bg-cream px-4 py-3 font-body focus:outline-none focus:bg-mustard/30"
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
                      className={`border-[3px] border-ink p-4 font-display uppercase shadow-[3px_3px_0_0_var(--ink)] transition-all ${
                        form.method === m ? "bg-primary text-primary-foreground" : "bg-cream"
                      }`}
                    >
                      {m === "pickup" ? "Retiro" : "Delivery"}
                    </button>
                  ))}
                </div>
                {form.method === "delivery" && (
                  <input
                    className="w-full border-[3px] border-ink bg-cream px-4 py-3 font-body focus:outline-none focus:bg-mustard/30"
                    placeholder="Dirección"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                )}
                <textarea
                  className="w-full border-[3px] border-ink bg-cream px-4 py-3 font-body focus:outline-none focus:bg-mustard/30 min-h-[100px]"
                  placeholder="Notas (sin cebolla, extra picante…)"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-display text-3xl mb-2">Revisá y confirmá</h2>
                <ul className="divide-y-[2px] divide-ink/20">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2">
                      <img src={resolveImage(i.image_url)} alt="" className="h-12 w-12 border-[2px] border-ink object-cover" />
                      <div className="flex-1">
                        <p className="font-display uppercase">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{i.quantity} × ${i.price.toFixed(2)}</p>
                      </div>
                      <span className="font-display">${(i.quantity * i.price).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between border-t-[3px] border-ink pt-3">
                  <span className="font-display text-xl">Total</span>
                  <span className="font-display text-2xl text-primary">${total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pago al retirar / al recibir. Te llamamos para confirmar.
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
            <SmashButton onClick={submit} disabled={submitting} glow>
              {submitting ? "Enviando…" : "Confirmar pedido"}
            </SmashButton>
          )}
        </div>
      </div>
    </section>
  );
}
