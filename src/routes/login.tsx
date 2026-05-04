import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { TransitionLink } from "@/components/RouteTransitionProvider";
import { useCustomerAuth } from "@/lib/customer-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Ingresar - Hotspot" },
      { name: "description", content: "Inicia sesion para confirmar tu pedido en Hotspot." },
    ],
  }),
  component: LoginPage,
});

function getRedirect() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("redirect");
  return value?.startsWith("/") ? value : "/";
}

function LoginPage() {
  const { customer, isLoading, login } = useCustomerAuth();
  const navigate = useNavigate();
  const redirect = useMemo(getRedirect, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && customer) navigate({ to: redirect as any });
  }, [customer, isLoading, navigate, redirect]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      await navigate({ to: redirect as any });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[78vh] max-w-md flex-col items-center justify-center px-4 py-12 md:px-6">
      <Sticker color="ink">Clientes</Sticker>
      <div className="mb-4 mt-4 flex h-16 w-16 items-center justify-center border border-primary bg-primary text-primary-foreground">
        <Lock className="h-8 w-8" />
      </div>
      <h1 className="mb-2 text-center font-display text-4xl">Ingresar</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">Entra a tu cuenta para continuar tu pedido.</p>

      <form onSubmit={submit} className="w-full sticker-lg space-y-3 bg-card p-6">
        <GoogleLoginButton redirectTo={redirect} className="w-full" />
        <div className="flex items-center gap-3 py-1 text-xs uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-ink/20" />
          <span>o con email</span>
          <span className="h-px flex-1 bg-ink/20" />
        </div>
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Contrasena"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
        <SmashButton type="submit" className="w-full" glow disabled={submitting || isLoading}>
          {submitting ? "Ingresando..." : "Iniciar sesion"}
        </SmashButton>
        <div className="grid gap-2 pt-2 text-center text-xs text-muted-foreground sm:grid-cols-2">
          <TransitionLink to={`/register?redirect=${encodeURIComponent(redirect)}`} className="hover:text-primary">
            Crear cuenta
          </TransitionLink>
          <TransitionLink to="/forgot-password" className="hover:text-primary">
            Olvide mi contrasena
          </TransitionLink>
        </div>
      </form>
    </section>
  );
}
