import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame, Truck, Star, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-burger.jpg";
import { SmashButton } from "@/components/SmashButton";
import { Sticker } from "@/components/Sticker";
import { Marquee } from "@/components/Marquee";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SMASH — Hamburguesas street food" },
      { name: "description", content: "Hamburguesas urbanas con sabor de barrio. Pedí online, retirá o pedí delivery." },
      { property: "og:title", content: "SMASH — Hamburguesas street food" },
      { property: "og:image", content: "/src/assets/hero-burger.jpg" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* HERO — street poster */}
      <section className="relative overflow-hidden border-b-[3px] border-ink">
        <div className="absolute inset-0 halftone" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-20 md:px-6">
          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Sticker color="red" rotate={-5} delay={0.1}>
                <Flame className="h-3 w-3" /> Recién smasheada
              </Sticker>
              <Sticker color="cyan" rotate={4} delay={0.2}>
                Nueva carta
              </Sticker>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 20, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
              className="font-display text-6xl md:text-8xl leading-[0.85]"
            >
              Hamburguesas
              <br />
              <span className="inline-block bg-primary px-3 text-primary-foreground -rotate-2 spray-text">
                con bronca
              </span>
              <br />
              y sabor.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="max-w-md text-lg text-muted-foreground"
            >
              Carne smasheada al fuego, panes esponjosos y salsas de receta propia.
              Sin vueltas. Sin fancy. Solo sabor de calle.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/menu">
                <SmashButton size="lg" glow>
                  Ver el menú <ArrowRight className="h-5 w-5" />
                </SmashButton>
              </Link>
              <Link to="/contacto">
                <SmashButton size="lg" variant="ghost">
                  Cómo llegar
                </SmashButton>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-4 pt-4 text-sm font-display uppercase"
            >
              <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Delivery</span>
              <span className="flex items-center gap-2"><Star className="h-4 w-4 text-mustard" /> 4.9 / 5</span>
              <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> Carne 100%</span>
            </motion.div>
          </div>

          {/* Hero image with sticker accents */}
          <div className="relative">
            <motion.img
              src={heroImg}
              alt="Hamburguesa SMASH"
              width={1536}
              height={1536}
              initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: -2, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.2 }}
              className="relative z-10 w-full max-w-xl mx-auto border-[4px] border-ink shadow-[10px_10px_0_0_var(--ink)]"
            />
            <motion.div
              className="absolute -top-4 -left-4 z-20"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: -15 }}
              transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.7 }}
            >
              <Sticker color="mustard" rotate={-15}>NUEVO</Sticker>
            </motion.div>
            <motion.div
              className="absolute -bottom-4 -right-4 z-20"
              initial={{ scale: 0, rotate: 30 }}
              animate={{ scale: 1, rotate: 8 }}
              transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.9 }}
            >
              <Sticker color="ink" rotate={8}>★ TOP 1</Sticker>
            </motion.div>
          </div>
        </div>
      </section>

      <Marquee />

      {/* Features strip */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { t: "Carne fresca", d: "Cortes locales, smasheados al momento sobre plancha caliente." },
              { t: "Pan artesanal", d: "Brioche y bun negro horneados todos los días en el barrio." },
              { t: "Salsas de la casa", d: "Recetas propias. Picantes, dulces, ahumadas. Vos elegís." },
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
      <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground">
        <div className="absolute inset-0 halftone opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 text-center md:px-6">
          <h2 className="font-display text-5xl md:text-7xl spray-text">¿Listo para smashear?</h2>
          <p className="mt-3 text-lg opacity-90">Pedí online en 2 minutos. Sin login. Sin vueltas.</p>
          <div className="mt-8 flex justify-center">
            <Link to="/menu">
              <SmashButton size="lg" variant="ink">
                Ir al menú →
              </SmashButton>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
