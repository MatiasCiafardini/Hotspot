import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Acceso dueño - Hotspot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname !== "/admin") return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin/dashboard" });
    });
  }, [navigate, pathname]);

  useEffect(() => {
    if (!loading) return;

    const timer = window.setTimeout(() => {
      const text = "La conexión con Supabase tardó demasiado. Probá de nuevo.";
      setLoading(false);
      setUnlocking(false);
      setMessage(text);
      toast.error(text);
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [loading]);

  if (pathname !== "/admin") {
    return (
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) {
        setMessage(error.message);
        toast.error(error.message);
        setLoading(false);
        return;
      }
      if (data.user && data.user.identities?.length === 0) {
        const text = "Ese email ya está registrado. Probá entrar en modo login.";
        setMessage(text);
        toast.error(text);
        setLoading(false);
        return;
      }
      if (!data.session) {
        const text = "Cuenta creada. Revisá tu email para confirmarla y después entrá con login.";
        setMessage(text);
        toast.success(text);
        setLoading(false);
        return;
      }
      toast.success("Cuenta creada. Ya podés entrar al panel.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        const text = error.message === "Email not confirmed"
          ? "Tenés que confirmar el email antes de entrar."
          : "No pudimos entrar. Revisá que el email y la contraseña sean exactamente los mismos que usaste al registrarte.";
        setMessage(text);
        toast.error(text);
        setLoading(false);
        return;
      }
    }
    setUnlocking(true);
    setTimeout(() => {
      setLoading(false);
      navigate({ to: "/admin/dashboard" });
    }, 700);
  };

  const resetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const text = "Escribí tu email arriba y después pedí recuperar contraseña.";
      setMessage(text);
      toast.error(text);
      return;
    }

    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/admin`,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      toast.error(error.message);
      return;
    }

    const text = "Te enviamos un email para recuperar la contraseña.";
    setMessage(text);
    toast.success(text);
  };

  const resendConfirmation = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const text = "Escribí tu email arriba y después pedí reenviar confirmación.";
      setMessage(text);
      toast.error(text);
      return;
    }

    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      toast.error(error.message);
      return;
    }

    const text = "Te reenviamos el email de confirmación.";
    setMessage(text);
    toast.success(text);
  };

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12 md:px-6">
      <div className="flex gap-2 mb-4">
        <Sticker color="ink">Panel admin</Sticker>
      </div>

      <motion.div
        animate={unlocking ? { rotate: [0, -15, 20, 0] } : {}}
        transition={{ duration: 0.6 }}
        className="mb-4 flex h-20 w-20 items-center justify-center border border-primary bg-primary shadow-[0_20px_40px_-28px_var(--ink)]"
      >
        {unlocking ? (
          <Unlock className="h-9 w-9 text-ink" />
        ) : (
          <Lock className="h-9 w-9 text-ink" />
        )}
      </motion.div>

      <h1 className="font-display text-4xl mb-1 text-center">{mode === "login" ? "Entrá" : "Primer acceso"}</h1>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        {mode === "login" ? "Entrá con tu cuenta para administrar." : "Creá una cuenta para entrar al panel."}
      </p>

      <form onSubmit={submit} className="w-full sticker-lg bg-card p-6 space-y-3">
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:outline-none focus:border-primary"
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border border-ink bg-background px-4 py-3 font-body focus:outline-none focus:border-primary"
          placeholder="Contraseña"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SmashButton type="submit" className="w-full" glow disabled={loading}>
          {loading ? "Cargando…" : mode === "login" ? "Desbloquear" : "Crear cuenta admin"}
        </SmashButton>
        {message && (
          <p className="border border-ink bg-background p-3 text-sm text-muted-foreground">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="hidden"
        >
          {mode === "login" ? "Primera vez (registrarse)" : "Ya tengo cuenta (login)"}
        </button>
        {mode === "login" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={resetPassword}
              disabled={loading}
              className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Recuperar contraseña
            </button>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={loading}
              className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Reenviar confirmación
            </button>
          </div>
        )}
      </form>

      <a
        href="/"
        data-transition-handled="true"
        onClick={() => window.scrollTo(0, 0)}
        className="mt-6 text-xs text-muted-foreground hover:text-primary"
      >
        ← volver al sitio
      </a>
    </section>
  );
}
