import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Banknote, Check, ChevronLeft, ChevronRight, Clock, Copy, PartyPopper } from "lucide-react";
import { useCart } from "@/lib/cart";
import { isDefaultProductImage, resolveImage } from "@/lib/products";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { toast } from "sonner";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { useRouteTransition } from "@/components/RouteTransitionProvider";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  formatIngredientList,
  formatMoney,
  type StoreSettings,
} from "@/lib/admin";
import { useCustomerAuth } from "@/lib/customer-auth";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout - Hotspot" },
      { name: "description", content: "Confirmá tu pedido en 3 pasos." },
    ],
  }),
  component: CheckoutPage,
});

const STEPS = ["Tus datos", "Entrega", "Confirmar"] as const;

type CheckoutItem = ReturnType<typeof useCart>["items"][number];

async function createOrder(input: {
  customerName: string;
  customerPhone: string;
  deliveryMethod: "pickup" | "delivery";
  customerAddress: string | null;
  deliveryTime: string | null;
  notes: string | null;
  paymentMethod: "efectivo" | "transferencia";
  items: CheckoutItem[];
}) {
  const response = await fetch("/api/store/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      throw new Error(typeof data?.error === "string" ? data.error : "No pudimos crear el pedido.");
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("No pudimos crear el pedido.");
    }
  }
  return response.json() as Promise<{ order: { id: string; total: number } }>;
}

function CheckoutPage() {
  const { items, total, clear } = useCart();
  const { customer, isLoading: customerLoading, login } = useCustomerAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [transferSeconds, setTransferSeconds] = useState(300);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [createdOrder, setCreatedOrder] = useState<{ id: string; total: number } | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const validationTimerRef = useRef<number | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showDeliveryTime, setShowDeliveryTime] = useState(false);
  const { navigateWithTransition } = useRouteTransition();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    method: "pickup" as "pickup" | "delivery",
    address: "",
    deliveryTime: "",
    notes: "",
  });
  const midnightOnlyPickup = settings.current_menu_shift === "midnight";
  const deliveryFee = Math.max(0, Number(settings.delivery_fee) || 0);
  const orderTotal = total + (form.method === "delivery" ? deliveryFee : 0);
  const storeOpen = settings.is_open === true;

  useEffect(() => {
    if (!customer) return;
    setForm((current) => ({
      ...current,
      name: current.name || customer.name,
      phone: current.phone || customer.phone || "",
    }));
  }, [customer]);

  useEffect(() => {
    fetch("/api/store/menu", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { settings?: StoreSettings } | null) => {
        if (data?.settings) {
          const nextSettings = { ...DEFAULT_SETTINGS, ...data.settings };
          setSettings(nextSettings);
          setPaymentMethod(nextSettings.accepts_cash ? "efectivo" : "transferencia");
        }
      })
      .catch(() => {
        setSettings(DEFAULT_SETTINGS);
      });
  }, []);

  useEffect(() => {
    if (midnightOnlyPickup && form.method !== "pickup") {
      setForm((current) => ({ ...current, method: "pickup", address: "" }));
    }
  }, [form.method, midnightOnlyPickup]);

  useEffect(() => {
    if (
      paymentMethod !== "transferencia" ||
      step !== 2 ||
      done ||
      submitting ||
      transferSeconds <= 0
    )
      return;
    const timer = window.setInterval(() => {
      setTransferSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [done, paymentMethod, step, submitting, transferSeconds]);

  const transferTime = useMemo(() => {
    const minutes = Math.floor(transferSeconds / 60);
    const seconds = String(transferSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [transferSeconds]);

  const showValidationMessage = (message: string) => {
    if (validationTimerRef.current) window.clearTimeout(validationTimerRef.current);
    setValidationMessage(message);
    validationTimerRef.current = window.setTimeout(() => {
      setValidationMessage(null);
      validationTimerRef.current = null;
    }, 1500);
  };

  useEffect(
    () => () => {
      if (validationTimerRef.current) window.clearTimeout(validationTimerRef.current);
    },
    [],
  );

  const next = () => {
    if (step === 0 && !form.name.trim()) {
      showValidationMessage("Cargá tu nombre para continuar.");
      return;
    }
    if (step === 0 && !form.phone.trim()) {
      showValidationMessage("Cargá tu teléfono para continuar.");
      return;
    }
    if (step === 1 && form.method === "delivery" && !form.address.trim()) {
      showValidationMessage("Cargá la dirección para continuar.");
      return;
    }

    setStep((s) => {
      const nextStep = Math.min(STEPS.length - 1, s + 1);
      if (nextStep === 2 && paymentMethod === "transferencia") setTransferSeconds(300);
      return nextStep;
    });
  };
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
    if (!customer) {
      toast.error("Para confirmar tu pedido necesitas iniciar sesion.");
      return;
    }
    if (paymentMethod === "transferencia" && transferSeconds <= 0) {
      toast.error(
        "El tiempo para transferir vencio. Volve al paso anterior y generamos una nueva ventana.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await createOrder({
        customerName: form.name,
        customerPhone: form.phone,
        customerAddress: form.method === "delivery" ? form.address : null,
        deliveryMethod: form.method,
        deliveryTime: showDeliveryTime && form.deliveryTime ? form.deliveryTime : null,
        notes: form.notes || null,
        paymentMethod,
        items,
      });
      setCreatedOrder(result.order);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos crear el pedido. Proba de nuevo.",
      );
      setSubmitting(false);
      return;
    }

    setDone(true);
    clear();
    setSubmitting(false);
  };

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      await login(loginForm);
      toast.success("Sesion iniciada. Ya podes confirmar tu pedido.");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No pudimos iniciar sesion.");
    } finally {
      setLoginSubmitting(false);
    }
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

  if (customerLoading) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6">
        <h1 className="font-display text-4xl mb-2">Verificando tu cuenta</h1>
        <p className="text-muted-foreground">Un segundo, estamos preparando el checkout.</p>
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6">
        <Sticker color="ink">Cuenta requerida</Sticker>
        <div className="mt-4 sticker-lg bg-card p-6 md:p-8">
          <h1 className="font-display text-4xl mb-3">
            Para confirmar tu pedido necesitás iniciar sesión.
          </h1>
          <p className="text-muted-foreground mb-6">
            Podés seguir navegando y tu carrito queda guardado. Iniciá sesión o creá una cuenta para
            terminar el pedido.
          </p>
          <GoogleLoginButton redirectTo="/checkout" className="mx-auto mb-4 max-w-sm" />
          <div className="mb-4 flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-ink/20" />
            <span>o usa email</span>
            <span className="h-px flex-1 bg-ink/20" />
          </div>
          <form onSubmit={submitLogin} className="mx-auto grid max-w-sm gap-3 text-left">
            <input
              className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
              placeholder="Email"
              type="email"
              autoComplete="email"
              required
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, email: event.target.value }))
              }
            />
            <input
              className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
              placeholder="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, password: event.target.value }))
              }
            />
            {loginError && (
              <p className="border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">
                {loginError}
              </p>
            )}
            <SmashButton type="submit" className="w-full" glow disabled={loginSubmitting}>
              {loginSubmitting ? "Ingresando..." : "Iniciar sesion"}
            </SmashButton>
          </form>
          <div className="mx-auto mt-4 grid max-w-sm gap-2 text-center text-xs text-muted-foreground sm:grid-cols-2">
            <a href="/register?redirect=/checkout" className="hover:text-primary">
              Crear cuenta
            </a>
            <a href="/forgot-password" className="hover:text-primary">
              Olvide mi contraseña
            </a>
          </div>
          <button
            type="button"
            onClick={() => navigateWithTransition("/menu")}
            className="mt-6 text-xs font-bold uppercase text-muted-foreground hover:text-primary"
          >
            Seguir mirando el menu
          </button>
        </div>
      </section>
    );
  }
  if (!storeOpen) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6">
        <Sticker color="ink">Local cerrado</Sticker>
        <div className="mt-4 sticker-lg bg-card p-6 md:p-8">
          <h1 className="font-display text-4xl mb-3">Todavia no estamos tomando pedidos.</h1>
          <p className="text-muted-foreground mb-6">
            El carrito queda guardado. Cuando el local inicie el dia, vas a poder confirmar tu
            pedido.
          </p>
          <SmashButton onClick={() => navigateWithTransition("/menu")}>Volver al menu</SmashButton>
        </div>
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
          {paymentMethod === "efectivo"
            ? `Recibimos tu pedido. El local te enviara un mensaje por WhatsApp para confirmarlo. Pagas en efectivo ${form.method === "pickup" ? "al retirar" : "al recibir"}.`
            : "Recibimos tu pedido y quedo pendiente hasta que confirmemos la transferencia."}
        </p>
        {createdOrder && (
          <p className="mb-6 font-display text-2xl">Total: {formatMoney(createdOrder.total)}</p>
        )}
        <SmashButton onClick={() => navigateWithTransition("/")}>Volver al inicio</SmashButton>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <AnimatePresence>
        {validationMessage && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed left-1/2 top-1/2 z-[80] w-[min(90vw,24rem)] -translate-x-1/2 -translate-y-1/2 border-2 border-red-700 bg-red-600 px-5 py-4 text-center font-display text-lg uppercase text-white shadow-[6px_6px_0_#450a0a]"
          >
            {validationMessage}
          </motion.div>
        )}
      </AnimatePresence>

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
                <h2 className="font-display text-3xl mb-2">¿Quien pide hoy?</h2>
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
                      onClick={() => {
                        if (midnightOnlyPickup && m === "delivery") return;
                        setForm({ ...form, method: m });
                      }}
                      disabled={midnightOnlyPickup && m === "delivery"}
                      className={`border p-4 font-display uppercase shadow-[0_10px_20px_-18px_var(--ink)] transition-all ${
                        form.method === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-ink bg-background"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {m === "pickup" ? "Retiro" : "Delivery"}
                    </button>
                  ))}
                </div>
                {midnightOnlyPickup && (
                  <p className="border border-primary bg-primary/10 p-3 text-sm text-muted-foreground">
                    En el turno madrugada solo tomamos pedidos para retiro.
                  </p>
                )}
                {form.method === "delivery" && (
                  <input
                    className="w-full border border-ink bg-background px-4 py-3 font-body focus:outline-none focus:border-primary"
                    placeholder="Dirección"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                )}
                <div className="border border-ink/20 bg-background/70 p-3">
                  <button
                    type="button"
                    onClick={() => setShowDeliveryTime((current) => !current)}
                    className={`flex w-full items-center justify-between gap-3 border px-4 py-3 text-left transition-all ${
                      showDeliveryTime
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-ink bg-card hover:border-primary"
                    }`}
                  >
                    <span>
                      <span className="block font-display text-xl uppercase">
                        Horario de entrega
                      </span>
                      <span className="block text-xs opacity-80">
                        Opcional, para pedir ahora y recibirlo mas tarde.
                      </span>
                    </span>
                    <Clock className="h-5 w-5 shrink-0" />
                  </button>
                  <AnimatePresence initial={false}>
                    {showDeliveryTime && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
                            Elegi la hora
                          </span>
                          <CheckoutTimePicker
                            value={form.deliveryTime}
                            onChange={(value) => setForm({ ...form, deliveryTime: value })}
                          />
                        </label>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
                <h2 className="font-display text-3xl mb-2">¿Como queres pagar?</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {settings.accepts_cash && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("efectivo")}
                      className={`border p-4 text-left transition-all ${
                        paymentMethod === "efectivo"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-ink bg-background hover:border-primary"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-display text-xl uppercase">
                        <Banknote className="h-5 w-5" /> Efectivo
                      </span>
                      <span className="mt-1 block text-xs opacity-80">
                        Pagas {form.method === "pickup" ? "al retirar" : "al recibir"}
                      </span>
                    </button>
                  )}
                  {settings.accepts_transfer && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("transferencia");
                        setTransferSeconds(300);
                      }}
                      className={`border p-4 text-left transition-all ${
                        paymentMethod === "transferencia"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-ink bg-background hover:border-primary"
                      }`}
                    >
                      <span className="font-display text-xl uppercase">Transferencia</span>
                      <span className="mt-1 block text-xs opacity-80">
                        Transferis antes de enviar
                      </span>
                    </button>
                  )}
                </div>
                {!settings.accepts_cash && !settings.accepts_transfer && (
                  <p className="border border-red-500 bg-red-500/10 p-4 text-sm text-red-700">
                    El local no tiene medios de pago habilitados. Contactalo antes de continuar.
                  </p>
                )}
                {paymentMethod === "efectivo" && settings.accepts_cash && (
                  <div className="border border-primary bg-primary/10 p-4">
                    <p className="font-display text-2xl">Confirmacion por WhatsApp</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      El local revisara el pedido y te enviara un mensaje por WhatsApp para
                      confirmarlo. Pagas en efectivo{" "}
                      {form.method === "pickup" ? "al retirar" : "al recibir"}.
                    </p>
                  </div>
                )}
                {paymentMethod === "transferencia" && settings.accepts_transfer && (
                  <div className="border border-primary bg-primary/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-display uppercase text-muted-foreground">
                          Alias
                        </p>
                        <p className="font-display text-3xl text-ink">{settings.transfer_alias}</p>
                      </div>
                      <SmashButton variant="ghost" onClick={copyAlias}>
                        <Copy className="h-4 w-4" /> Copiar
                      </SmashButton>
                    </div>
                    <div className="mt-4 grid gap-2 border-t border-ink/20 pt-4 sm:grid-cols-2">
                      <p className="text-sm text-muted-foreground">
                        Importe exacto:{" "}
                        <strong className="text-ink">{formatMoney(orderTotal)}</strong>
                      </p>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground sm:justify-end">
                        <Clock className="h-4 w-4 text-primary" /> Tiempo restante:{" "}
                        <strong className="text-ink">{transferTime}</strong>
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Cuando termines la transferencia, toca el boton de abajo. El pedido queda
                      pendiente hasta que el local confirme el pago.
                    </p>
                  </div>
                )}
                <ul className="divide-y-[2px] divide-ink/20">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2">
                      <img
                        src={resolveImage(i.image_url)}
                        alt=""
                        className={cn(
                          "h-12 w-12 border border-ink",
                          isDefaultProductImage(i.image_url)
                            ? "bg-black p-1.5 object-contain"
                            : "object-cover",
                        )}
                      />
                      <div className="flex-1">
                        <p className="font-display uppercase">{i.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.quantity} × ${i.price.toFixed(2)}
                        </p>
                        {i.removed_ingredients.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Sin: {formatIngredientList(i.removed_ingredients)}
                          </p>
                        )}
                        {i.added_ingredients.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Extra: {formatIngredientList(i.added_ingredients)}
                          </p>
                        )}
                      </div>
                      <span className="font-display">${(i.quantity * i.price).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                {form.method === "delivery" && (
                  <div className="flex justify-between border-t border-ink/20 pt-3">
                    <span className="font-display text-xl">Delivery</span>
                    <span className="font-display text-xl text-ink">
                      {formatMoney(deliveryFee)}
                    </span>
                  </div>
                )}
                {showDeliveryTime && form.deliveryTime && (
                  <div className="flex justify-between border-t border-ink/20 pt-3">
                    <span className="font-display text-xl">Horario entrega</span>
                    <span className="font-display text-xl text-ink">{form.deliveryTime}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-ink pt-3">
                  <span className="font-display text-xl">Total</span>
                  <span className="font-display text-2xl text-ink">{formatMoney(orderTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {paymentMethod === "efectivo"
                    ? "El pedido se prepara cuando el local lo confirme por WhatsApp."
                    : "No se prepara el pedido hasta que el dueño confirme la transferencia en el panel."}
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
            <SmashButton onClick={next}>
              Siguiente <ChevronRight className="h-4 w-4" />
            </SmashButton>
          ) : (
            <SmashButton
              onClick={submit}
              disabled={
                submitting ||
                (!settings.accepts_cash && !settings.accepts_transfer) ||
                (paymentMethod === "transferencia" && transferSeconds <= 0)
              }
              glow
            >
              {submitting
                ? "Enviando…"
                : paymentMethod === "efectivo"
                  ? "Enviar pedido"
                  : "Transferencia realizada"}
            </SmashButton>
          )}
        </div>
      </div>
    </section>
  );
}

function CheckoutTimePicker({
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
        className="flex min-h-14 w-full items-center gap-3 border border-ink bg-background px-4 py-3 text-left font-display text-3xl text-ink transition-colors hover:border-primary focus:border-primary focus:outline-none"
      >
        <Clock className="h-5 w-5 text-primary" />
        {value || "Elegir hora"}
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 border border-ink bg-background p-3 shadow-[0_18px_40px_-22px_var(--ink)]">
          <div className="grid grid-cols-2 gap-3">
            <div className="max-h-52 overflow-y-auto pr-1">
              {hours.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => onChange(`${option}:${minute}`)}
                  className={`mb-1 min-h-9 w-full px-3 text-center font-mono text-sm transition-colors ${
                    option === hour
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-ink hover:bg-primary/15"
                  }`}
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
                  className={`mb-1 min-h-9 w-full px-3 text-center font-mono text-sm transition-colors ${
                    option === minute
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-ink hover:bg-primary/15"
                  }`}
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
