import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { TransitionLink } from "@/components/RouteTransitionProvider";
import { useCustomerAuth } from "@/lib/customer-auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crear cuenta - Hotspot" },
      { name: "description", content: "Crea tu cuenta de cliente para pedir en Hotspot." },
    ],
  }),
  component: RegisterPage,
});

function getRedirect() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("redirect");
  return value?.startsWith("/") ? value : "/";
}

function RegisterPage() {
  const { customer, isLoading, register } = useCustomerAuth();
  const navigate = useNavigate();
  const redirect = useMemo(getRedirect, []);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && customer) navigate({ to: redirect as any });
  }, [customer, isLoading, navigate, redirect]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      await navigate({ to: redirect as any });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear la cuenta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[78vh] max-w-md flex-col items-center justify-center px-4 py-12 md:px-6">
      <Sticker color="ink">Clientes</Sticker>
      <div className="mb-4 mt-4 flex h-16 w-16 items-center justify-center border border-primary bg-primary text-primary-foreground">
        <UserPlus className="h-8 w-8" />
      </div>
      <h1 className="mb-2 text-center font-display text-4xl">Crear cuenta</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">Guarda tus datos y confirma pedidos mas rapido.</p>

      <form onSubmit={submit} className="w-full sticker-lg space-y-3 bg-card p-6">
        <GoogleLoginButton redirectTo={redirect} className="w-full" text="signup_with" />
        <div className="flex items-center gap-3 py-1 text-xs uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-ink/20" />
          <span>o crea tu cuenta</span>
          <span className="h-px flex-1 bg-ink/20" />
        </div>
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Nombre"
          autoComplete="name"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Telefono"
          type="tel"
          autoComplete="tel"
          required
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Contrasena"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Confirmar contrasena"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.confirmPassword}
          onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
        />
        {error && <p className="border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
        <SmashButton type="submit" className="w-full" glow disabled={submitting || isLoading}>
          {submitting ? "Creando..." : "Crear cuenta"}
        </SmashButton>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Ya tenes cuenta?{" "}
          <TransitionLink to={`/login?redirect=${encodeURIComponent(redirect)}`} className="text-ink hover:text-primary">
            Ingresar
          </TransitionLink>
        </p>
      </form>
    </section>
  );
}
