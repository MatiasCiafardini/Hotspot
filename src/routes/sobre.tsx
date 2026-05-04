import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sticker } from "@/components/Sticker";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "El Spot - Hotspot" },
      { name: "description", content: "La historia de Hotspot: hamburguesas, sabor de barrio." },
      { property: "og:title", content: "El Spot - Hotspot" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 md:px-6">
      <div className="flex flex-wrap gap-2 mb-6">
        <Sticker color="ink">El spot</Sticker>
        <Sticker color="cream" rotate={2}>Desde 2019</Sticker>
      </div>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-5xl md:text-7xl mb-8"
      >
        Nacimos en una <span className="bg-ink px-2 text-cream -rotate-1 inline-block">esquina</span>.
      </motion.h1>
      <div className="prose prose-lg max-w-none space-y-4 font-body text-foreground">
        <p>
          Hotspot empezó como un foodtruck en una esquina ruidosa, con una plancha,
          una bolsa de carne picada y un letrero pintado a spray. Sin
          inversionistas, sin marketing. Solo burgers hechas al momento y mucha bronca por
          hacer las cosas bien.
        </p>
        <p>
          Hoy somos local fijo, pero la onda no cambió: pan artesanal del barrio,
          carne fresca todos los días y salsas que no encontrás en ningún otro
          lado. Si te gusta lo simple bien hecho, este es tu lugar.
        </p>
        <p className="font-display text-3xl text-ink">
          Sin vueltas. Sin fancy. Solo sabor.
        </p>
      </div>
    </section>
  );
}
