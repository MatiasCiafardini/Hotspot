import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Instagram, Clock } from "lucide-react";
import { Sticker } from "@/components/Sticker";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Contacto — SMASH" },
      { name: "description", content: "Encontranos. Llamanos. Pedinos. SMASH burgers en el barrio." },
      { property: "og:title", content: "Contacto — SMASH" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
      <div className="flex gap-2 mb-4">
        <Sticker color="mustard">Encontranos</Sticker>
      </div>
      <h1 className="font-display text-5xl md:text-7xl mb-10">Pasá por el <span className="bg-primary text-primary-foreground px-2 -rotate-1 inline-block">spot</span></h1>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { Icon: MapPin, title: "Dirección", body: "Av. Siempre Viva 742, Ciudad" },
          { Icon: Phone, title: "Teléfono", body: "+54 9 11 5555 5555" },
          { Icon: Instagram, title: "Instagram", body: "@smashburgers" },
          { Icon: Clock, title: "Horarios", body: "Mié–Dom · 19:00 a 02:00" },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="sticker-lg p-6 bg-card flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center border-[3px] border-ink bg-mustard">
              <Icon className="h-5 w-5 text-ink" />
            </div>
            <div>
              <h3 className="font-display text-2xl">{title}</h3>
              <p className="text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
