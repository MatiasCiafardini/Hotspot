import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Instagram, Clock } from "lucide-react";
import { Sticker } from "@/components/Sticker";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Contacto - Hotspot" },
      { name: "description", content: "Encontranos. Llamanos. Pedinos burgers en el barrio." },
      { property: "og:title", content: "Contacto - Hotspot" },
    ],
  }),
  component: ContactPage,
});

const CONTACT_ITEMS = [
  {
    Icon: MapPin,
    title: "Dirección",
    body: "Aristobulo del Valle 498",
    href: "https://www.google.com/maps/@-34.2522477,-59.4757485,3a,75y,266.71h,67.93t/data=!3m7!1e1!3m5!1sybKhR0fvntCwY3Qheb8IPg!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D22.06998740067975%26panoid%3DybKhR0fvntCwY3Qheb8IPg%26yaw%3D266.71433393466685!7i16384!8i8192?entry=ttu&g_ep=EgoyMDI2MDQyMi4wIKXMDSoASAFQAw%3D%3D",
  },
  {
    Icon: Phone,
    title: "Teléfono",
    body: "+54 9 2326 49-4882",
    href: "tel:+5492326494882",
  },
  {
    Icon: Instagram,
    title: "Instagram",
    body: "@hotspot_pupi",
    href: "https://www.instagram.com/hotspot_pupi/",
  },
  {
    Icon: Clock,
    title: "Horarios",
    body: "Mié–Dom · 19:00 a 02:00",
    href: null,
  },
] as const;

function ContactPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
      <div className="flex gap-2 mb-4">
        <Sticker color="mustard">Encontranos</Sticker>
      </div>
      <h1 className="font-display text-5xl md:text-7xl mb-10">Pasá por el <span className="bg-ink text-cream px-2 -rotate-1 inline-block">spot</span></h1>

      <div className="grid gap-6 md:grid-cols-2">
        {CONTACT_ITEMS.map(({ Icon, title, body, href }) => {
          const inner = (
            <div className="sticker-lg p-6 bg-card flex items-start gap-4 w-full">
              <div className="flex h-12 w-12 items-center justify-center border border-primary bg-primary">
                <Icon className="h-5 w-5 text-ink" />
              </div>
              <div>
                <h3 className="font-display text-2xl">{title}</h3>
                <p className={`text-muted-foreground ${href ? "group-hover:text-primary transition-colors" : ""}`}>{body}</p>
              </div>
            </div>
          );
          return href ? (
            <a key={title} href={href} target="_blank" rel="noopener noreferrer" className="group">
              {inner}
            </a>
          ) : (
            <div key={title}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}
