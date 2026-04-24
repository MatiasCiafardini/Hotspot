import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Acceso dueño — SMASH" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin/dashboard` },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Cuenta creada. Si es tu primera vez, ya sos el dueño.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Credenciales inválidas");
        setLoading(false);
        return;
      }
    }
    setUnlocking(true);
    setTimeout(() => navigate({ to: "/admin/dashboard" }), 700);
  };

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12 md:px-6">
      <div className="flex gap-2 mb-4">
        <Sticker color="ink">Solo dueño</Sticker>
      </div>

      <motion.div
        animate={unlocking ? { rotate: [0, -15, 20, 0] } : {}}
        transition={{ duration: 0.6 }}
        className="mb-4 flex h-20 w-20 items-center justify-center border-[4px] border-ink bg-mustard shadow-[6px_6px_0_0_var(--ink)]"
      >
        {unlocking ? (
          <Unlock className="h-9 w-9 text-ink" />
        ) : (
          <Lock className="h-9 w-9 text-ink" />
        )}
      </motion.div>

      <h1 className="font-display text-4xl mb-1 text-center">{mode === "login" ? "Entrá" : "Primer acceso"}</h1>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        {mode === "login" ? "Solo el dueño puede entrar acá." : "El primer registro se vuelve dueño automáticamente."}
      </p>

      <form onSubmit={submit} className="w-full sticker-lg bg-card p-6 space-y-3">
        <input
          className="w-full border-[3px] border-ink bg-cream px-4 py-3 font-body focus:outline-none focus:bg-mustard/30"
          placeholder="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border-[3px] border-ink bg-cream px-4 py-3 font-body focus:outline-none focus:bg-mustard/30"
          placeholder="Contraseña"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SmashButton type="submit" className="w-full" glow disabled={loading}>
          {loading ? "Cargando…" : mode === "login" ? "Desbloquear" : "Crear cuenta dueño"}
        </SmashButton>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {mode === "login" ? "Primera vez (registrarse)" : "Ya tengo cuenta (login)"}
        </button>
      </form>

      <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-primary">
        ← volver al sitio
      </Link>
    </section>
  );
}
