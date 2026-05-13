import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame, Truck, Star, ArrowRight } from "lucide-react";
import heroImg from "@/assets/burger-double.jpg";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { Marquee } from "@/components/Marquee";
import { TransitionLink } from "@/components/RouteTransitionProvider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hotspot - Hamburguesas street food" },
      {
        name: "description",
        content: "Hamburguesas urbanas con sabor de barrio. Pedi online, retira o pedi delivery.",
      },
      { property: "og:title", content: "Hotspot - Hamburguesas street food" },
      { property: "og:image", content: "/src/assets/burger-double.jpg" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* HERO — street poster */}
      <section className="relative overflow-hidden border-b border-ink bg-background">
        <div className="absolute inset-0 halftone" />
        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-2 md:items-center md:gap-8 md:px-6 md:py-20">
          <div className="relative z-10 min-w-0 space-y-5 md:space-y-6">
            <div className="flex flex-wrap gap-2">
              <Sticker color="ink" rotate={-2} delay={0.1}>
                <Flame className="h-3 w-3" /> Hecha al momento
              </Sticker>
              <Sticker color="cream" rotate={2} delay={0.2}>
                Nueva carta
              </Sticker>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 20, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
              className="max-w-full break-words font-display text-[2.75rem] leading-[0.92] min-[390px]:text-[3rem] sm:text-7xl md:text-8xl md:leading-[0.85]"
            >
              Hamburguesas
              <br />
              <span className="inline-block bg-foreground px-3 text-background -rotate-1">
                con bronca
              </span>
              <br />y sabor.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Burgers hechas al momento, panes esponjosos y salsas de receta propia. Sin vueltas.
              Sin fancy. Solo sabor de calle.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="grid gap-3 sm:flex sm:flex-wrap"
            >
              <TransitionLink to="/menu" className="min-w-0">
                <SmashButton size="lg" glow className="w-full sm:w-auto">
                  Ver el menú <ArrowRight className="h-5 w-5" />
                </SmashButton>
              </TransitionLink>
              <TransitionLink to="/contacto" className="min-w-0">
                <SmashButton size="lg" variant="ghost" className="w-full sm:w-auto">
                  Cómo llegar
                </SmashButton>
              </TransitionLink>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-x-4 gap-y-2 pt-4 text-xs font-display uppercase sm:text-sm"
            >
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> Delivery
              </span>
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" /> 4.9 / 5
              </span>
              <span className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" /> Carne 100%
              </span>
            </motion.div>
          </div>

          {/* Hero image with label accents */}
          <div className="relative z-10 mt-1 min-w-0 md:mt-0">
            <motion.div
              initial={{ scale: 0.86, rotate: -2, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.2 }}
              className="relative z-10 mx-auto aspect-[16/9] max-h-[220px] w-full max-w-2xl overflow-hidden border border-ink bg-card shadow-[0_28px_60px_-38px_var(--ink)] sm:max-h-none"
            >
              <img
                src={heroImg}
                alt="Hamburguesa Hotspot"
                width={1536}
                height={864}
                className="h-full w-full object-cover object-center"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/25 via-transparent to-transparent" />
            </motion.div>
            <motion.div
              className="absolute -top-3 left-2 z-20 md:-left-4 md:-top-4"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: -15 }}
              transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.7 }}
            >
              <Sticker color="mustard" rotate={-8}>
                NUEVO
              </Sticker>
            </motion.div>
            <motion.div
              className="absolute -bottom-3 right-2 z-20 md:-bottom-4 md:-right-4"
              initial={{ scale: 0, rotate: 30 }}
              animate={{ scale: 1, rotate: 8 }}
              transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.9 }}
            >
              <Sticker color="ink" rotate={4}>
                TOP 1
              </Sticker>
            </motion.div>
          </div>
        </div>
      </section>

      <Marquee />

      {/* Features strip */}
      <section className="bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { t: "Carne fresca", d: "Cortes locales, hechos al momento sobre plancha caliente." },
              {
                t: "Pan artesanal",
                d: "Brioche y bun negro horneados todos los días en el barrio.",
              },
              {
                t: "Salsas de la casa",
                d: "Recetas propias. Picantes, dulces, ahumadas. Vos elegís.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.t}
                initial={{ opacity: 0, y: 30, rotate: i % 2 ? 1 : -1 }}
                whileInView={{ opacity: 1, y: 0, rotate: i % 2 ? 0.5 : -0.5 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 220, damping: 22, delay: i * 0.1 }}
                className="sticker-lg p-6 bg-card"
              >
                <div className="font-display text-3xl mb-2 text-primary">0{i + 1}</div>
                <h3 className="font-display text-2xl mb-2">{f.t}</h3>
                <p className="text-muted-foreground text-sm">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="relative overflow-hidden bg-foreground py-16 text-background">
        <div className="absolute inset-0 halftone opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 text-center md:px-6">
          <h2 className="font-display text-5xl md:text-7xl">¿Listo para pedir?</h2>
          <p className="mt-3 text-lg opacity-90">Pedi online en 2 minutos. Sin vueltas.</p>
          <div className="mt-8 flex justify-center">
            <TransitionLink to="/menu">
              <SmashButton size="lg" variant="ink">
                Ir al menú →
              </SmashButton>
            </TransitionLink>
          </div>
        </div>
      </section>
    </>
  );
}
