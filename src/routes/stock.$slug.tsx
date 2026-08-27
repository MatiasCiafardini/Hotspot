import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Mail,
  Minus,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { InventoryItem, StockList } from "@/lib/inventory";
import logo from "@/assets/logo_hotspot.png";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/$slug")({
  head: () => ({
    meta: [{ title: "Control de stock - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: StockControl,
});

type Payload = {
  lists: StockList[];
  items: Array<InventoryItem & { list_id: string; step: number }>;
};

async function api(slug: string, method: "GET" | "POST", body?: unknown) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(
    `/api/admin/inventory${method === "GET" ? `?slug=${encodeURIComponent(slug)}` : ""}`,
    {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || "No se pudo completar la accion."), {
      status: response.status,
    });
  return result;
}

function StockControl() {
  const { slug } = useParams({ from: "/stock/$slug" });
  const [payload, setPayload] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [auth, setAuth] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setAuth(false);
        return;
      }
      setAuth(true);
      const next = (await api(slug, "GET")) as Payload;
      setPayload(next);
      setDraft(Object.fromEntries(next.items.map((item) => [item.id, Number(item.quantity)])));
    } catch (error: any) {
      toast.error(error.status === 404 ? "No tenes acceso a esta lista." : error.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [slug]);
  useEffect(() => {
    setAuth(null);
    setPayload(null);
    setLoading(true);
    load();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuth(false);
        setPayload(null);
        return;
      }
      window.setTimeout(() => load(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);
  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (error) toast.error("Email o contraseña incorrectos.");
  };
  const save = async () => {
    if (!payload?.lists[0]) return;
    setBusy(true);
    try {
      await api(slug, "POST", {
        action: "save_count",
        list_id: payload.lists[0].id,
        notes,
        items: payload.items.map((item) => ({
          stock_item_id: item.id,
          quantity: draft[item.id],
          expected_updated_at: item.updated_at,
        })),
      });
      toast.success("Control diario guardado.");
      setNotes("");
      await load();
    } catch (error: any) {
      toast.error(
        error.status === 409
          ? "Otro operador modifico el stock. Recarga antes de guardar."
          : error.message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (auth === null || (auth && loading && !payload))
    return (
      <Shell>
        <p>Verificando acceso...</p>
      </Shell>
    );
  if (!auth)
    return (
      <StockLogin
        email={email}
        password={password}
        busy={busy}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={login}
      />
    );
  if (!payload)
    return (
      <Shell>
        <p>No se pudo abrir la lista o no estas autorizado.</p>
        <button className="mt-4 underline" onClick={() => supabase.auth.signOut()}>
          Cambiar cuenta
        </button>
      </Shell>
    );
  const list = payload.lists[0];
  const changed = payload.items.some((item) => draft[item.id] !== Number(item.quantity));
  const visibleItems = payload.items.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Shell>
      <header className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-orange-300">Control diario</p>
          <h1 className="break-words text-2xl font-bold leading-tight sm:text-3xl">{list.name}</h1>
          <p className="text-sm text-zinc-400">{list.description}</p>
        </div>
        <button
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else window.location.assign("/admin/stock");
          }}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm text-zinc-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a stock
        </button>
      </header>
      <div
        className={`sticky z-20 -mx-4 bg-black/95 px-4 pb-3 pt-1 backdrop-blur ${import.meta.env.VITE_APP_ENV === "staging" ? "top-6" : "top-0"}`}
      >
        <input
          type="search"
          className="w-full rounded-lg border border-white/20 bg-zinc-900 p-3"
          placeholder="Buscar producto"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="grid gap-3">
        {visibleItems.map((item) => {
          const value = draft[item.id] ?? 0;
          const low = value <= Number(item.low_stock_threshold);
          return (
            <article
              key={item.id}
              className={`rounded-xl border p-3 sm:p-4 ${low ? "border-orange-400/50 bg-orange-500/10" : "border-white/10 bg-zinc-900"}`}
            >
              <div className="mb-3 flex justify-between">
                <div>
                  <strong>{item.name}</strong>
                  <p className="text-xs text-zinc-400">
                    Paso {item.step} {item.unit} · Minimo {item.low_stock_threshold}
                  </p>
                </div>
                {low && <span className="text-xs font-bold text-orange-300">STOCK BAJO</span>}
              </div>
              <div className="grid grid-cols-[52px_1fr_52px] gap-2">
                <button
                  aria-label={`Restar ${item.name}`}
                  className="rounded bg-zinc-800"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      [item.id]: item.allow_negative
                        ? value - item.step
                        : Math.max(0, value - item.step),
                    })
                  }
                >
                  <Minus className="mx-auto" />
                </button>
                <input
                  aria-label={`Cantidad ${item.name}`}
                  className="min-w-0 rounded border border-white/20 bg-black p-3 text-center text-xl font-bold"
                  type="number"
                  step=".001"
                  value={value}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setDraft({ ...draft, [item.id]: item.allow_negative ? n : Math.max(0, n) });
                  }}
                />
                <button
                  aria-label={`Sumar ${item.name}`}
                  className="rounded bg-orange-500 text-black"
                  onClick={() => setDraft({ ...draft, [item.id]: value + item.step })}
                >
                  <Plus className="mx-auto" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <textarea
        className="mt-4 min-h-24 w-full rounded border border-white/20 bg-zinc-900 p-3"
        placeholder="Observaciones del control"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex gap-2 border-t border-white/10 bg-black/95 px-4 py-4 backdrop-blur">
        <button
          disabled={!changed || busy}
          onClick={() =>
            setDraft(Object.fromEntries(payload.items.map((x) => [x.id, Number(x.quantity)])))
          }
          className="flex flex-1 items-center justify-center gap-2 rounded border border-white/20 p-3 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
          Descartar
        </button>
        <button
          disabled={busy}
          onClick={save}
          className="flex flex-[2] items-center justify-center gap-2 rounded bg-orange-500 p-3 font-bold text-black disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          Guardar control
        </button>
      </div>
    </Shell>
  );
}

function StockLogin({
  email,
  password,
  busy,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  email: string;
  password: string;
  busy: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070707] text-white">
      {import.meta.env.VITE_APP_ENV === "staging" && (
        <div className="fixed inset-x-0 top-0 z-50 bg-yellow-300 px-3 py-1 text-center text-xs font-black uppercase tracking-widest text-black">
          Entorno local de pruebas · No es producción
        </div>
      )}

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -bottom-52 -left-40 h-[32rem] w-[32rem] rounded-full bg-orange-700/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-[1.05fr_.95fr] md:px-10 lg:gap-20">
        <section className="hidden md:block">
          <img src={logo} alt="Hotspot" className="mb-10 h-24 w-24 rounded-2xl object-cover" />
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-orange-400">
            Gestión de inventario
          </p>
          <h1 className="font-display max-w-xl text-5xl leading-[0.95] tracking-wide lg:text-6xl">
            El control diario, simple y en orden.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400">
            Registrá las cantidades reales de tu sector. Cada control queda guardado para que el
            equipo pueda preparar reportes y pedidos sin perder información.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 text-sm text-zinc-300">
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <ClipboardCheck className="h-4 w-4 text-orange-400" /> Conteo por lista
            </span>
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <ShieldCheck className="h-4 w-4 text-orange-400" /> Acceso individual
            </span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between md:hidden">
            <img src={logo} alt="Hotspot" className="h-16 w-16 rounded-xl object-cover" />
            <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-300">
              Control de stock
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-black shadow-lg shadow-orange-500/20">
                <LogIn className="h-5 w-5" />
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
                Acceso de operadores
              </p>
              <h2 className="font-display text-3xl tracking-wide">Ingresar al control</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Usá la cuenta que te asignaron para abrir tu lista de trabajo.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-200">Email</span>
                <span className="flex items-center rounded-xl border border-white/15 bg-black/50 px-4 transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/15">
                  <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input
                    className="min-w-0 flex-1 bg-transparent px-3 py-3.5 outline-none placeholder:text-zinc-600"
                    type="email"
                    placeholder="tu@email.com"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-200">Contraseña</span>
                <span className="flex items-center rounded-xl border border-white/15 bg-black/50 px-4 transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/15">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input
                    className="min-w-0 flex-1 bg-transparent px-3 py-3.5 outline-none placeholder:text-zinc-600"
                    type="password"
                    placeholder="Ingresá tu contraseña"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                  />
                </span>
              </label>

              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3.5 font-bold text-black transition hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="h-5 w-5" />
                )}
                {busy ? "Ingresando…" : "Ingresar"}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-relaxed text-zinc-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <p>Tu acceso es personal. Los controles quedarán registrados con tu cuenta.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`min-h-screen bg-black px-4 pb-6 text-white ${import.meta.env.VITE_APP_ENV === "staging" ? "pt-12" : "pt-6"}`}
    >
      {import.meta.env.VITE_APP_ENV === "staging" && (
        <div className="fixed inset-x-0 top-0 z-50 bg-yellow-300 px-3 py-1 text-center text-xs font-black uppercase tracking-widest text-black">
          Entorno local de pruebas · No es produccion
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <img src={logo} alt="Hotspot" className="mb-6 h-16 w-16 rounded-lg object-cover" />
        {children}
      </div>
    </main>
  );
}
