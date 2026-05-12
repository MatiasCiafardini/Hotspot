import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { TransitionLink } from "@/components/RouteTransitionProvider";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña - Hotspot" },
      {
        name: "description",
        content: "Crea una nueva contraseña para tu cuenta de cliente en Hotspot.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function getToken() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") || "";
}

async function resetPassword(token: string, password: string) {
  const response = await fetch("/api/store/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
    credentials: "include",
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      throw new Error(
        typeof data?.error === "string" ? data.error : "No pudimos cambiar la contraseña.",
      );
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("No pudimos cambiar la contraseña.");
    }
  }
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const token = useMemo(getToken, []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "El enlace de recuperacion no es valido.",
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cambiar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[78vh] max-w-md flex-col items-center justify-center px-4 py-12 md:px-6">
      <Sticker color="ink">Cuenta</Sticker>
      <div className="mb-4 mt-4 flex h-16 w-16 items-center justify-center border border-primary bg-primary text-primary-foreground">
        <KeyRound className="h-8 w-8" />
      </div>
      <h1 className="mb-2 text-center font-display text-4xl">Nueva contraseña</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Elegí una clave nueva para tu cuenta.
      </p>

      <form onSubmit={submit} className="w-full sticker-lg space-y-3 bg-card p-6">
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={!token || done}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:border-primary focus:outline-none"
          placeholder="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={!token || done}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {done && (
          <p className="border border-emerald-600 bg-emerald-500/10 p-3 text-sm text-emerald-700">
            Listo. Ya podes ingresar con tu nueva contraseña.
          </p>
        )}
        {error && (
          <p className="border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>
        )}
        {!done ? (
          <SmashButton type="submit" className="w-full" glow disabled={submitting || !token}>
            {submitting ? "Guardando..." : "Guardar contraseña"}
          </SmashButton>
        ) : (
          <SmashButton
            type="button"
            className="w-full"
            glow
            onClick={() => navigate({ to: "/login" })}
          >
            Iniciar sesion
          </SmashButton>
        )}
        <p className="pt-2 text-center text-xs text-muted-foreground">
          <TransitionLink to="/login" className="hover:text-primary">
            Volver a ingresar
          </TransitionLink>
        </p>
      </form>
    </section>
  );
}
