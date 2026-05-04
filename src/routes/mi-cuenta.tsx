import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User } from "lucide-react";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { TransitionLink } from "@/components/RouteTransitionProvider";
import { useCustomerAuth } from "@/lib/customer-auth";

export const Route = createFileRoute("/mi-cuenta")({
  head: () => ({
    meta: [
      { title: "Mi cuenta - Hotspot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { customer, isLoading, logout } = useCustomerAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/" });
  };

  if (isLoading) {
    return <section className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">Cargando cuenta...</section>;
  }

  if (!customer) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6">
        <Sticker color="ink">Mi cuenta</Sticker>
        <h1 className="mb-3 mt-4 font-display text-4xl">Necesitas iniciar sesion</h1>
        <p className="mb-6 text-muted-foreground">Entra a tu cuenta para ver tus datos.</p>
        <TransitionLink to="/login?redirect=/mi-cuenta" className="inline-flex border border-primary bg-primary px-6 py-3 font-display uppercase text-primary-foreground">
          Ingresar
        </TransitionLink>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Sticker color="ink">Mi cuenta</Sticker>
      <div className="mt-4 sticker-lg bg-card p-6 md:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center border border-primary bg-primary text-primary-foreground">
            <User className="h-10 w-10" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
            <p className="text-sm text-muted-foreground">{customer.phone || "Sin telefono cargado"}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <TransitionLink to="/menu" className="inline-flex items-center justify-center border border-primary bg-primary px-5 py-3 font-display uppercase text-primary-foreground">
            Hacer pedido
          </TransitionLink>
          <SmashButton type="button" variant="ghost" onClick={handleLogout}>
            Cerrar sesion
          </SmashButton>
        </div>
      </div>
    </section>
  );
}
