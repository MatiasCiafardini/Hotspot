import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { TransitionLink } from "@/components/RouteTransitionProvider";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña - Hotspot" },
      { name: "description", content: "Recupera el acceso a tu cuenta de cliente en Hotspot." },
    ],
  }),
  component: ForgotPasswordPage,
});

async function requestPasswordReset(email: string) {
  const response = await fetch("/api/store/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });

  if (!response.ok) throw new Error("No pudimos preparar la recuperacion.");
  return response.json() as Promise<{ ok: boolean; resetUrl?: string | null }>;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setDevResetUrl(null);

    try {
      const data = await requestPasswordReset(email);
      setMessage("Si el email existe, preparamos un enlace para recuperar tu contraseña.");
      if (data.resetUrl) setDevResetUrl(data.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos preparar la recuperacion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[78vh] max-w-md flex-col items-center justify-center px-4 py-12 md:px-6">
      <Sticker color="ink">Cuenta</Sticker>
      <div className="mb-4 mt-4 flex h-16 w-16 items-center justify-center border border-primary bg-primary text-primary-foreground">
        <Mail className="h-8 w-8" />
      </div>
      <h1 className="mb-2 text-center font-display text-4xl">Recuperar contraseña</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Te ayudamos a volver a entrar a tu cuenta.
      </p>

      <form onSubmit={submit} className="w-full sticker-lg space-y-3 bg-card p-6">
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {message && (
          <p className="border border-emerald-600 bg-emerald-500/10 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {devResetUrl && (
          <a
            className="block break-words border border-ink/20 bg-background p-3 text-xs hover:text-primary"
            href={devResetUrl}
          >
            Abrir enlace de recuperacion
          </a>
        )}
        {error && (
          <p className="border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>
        )}
        <SmashButton type="submit" className="w-full" glow disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar enlace"}
        </SmashButton>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          <TransitionLink to="/login" className="hover:text-primary">
            Volver a ingresar
          </TransitionLink>
        </p>
      </form>
    </section>
  );
}
