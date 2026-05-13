import { motion } from "framer-motion";

const ITEMS = [
  "HOTSPOT NIGHT",
  "DELIVERY 24/7",
  "2X1 EN SHAKES",
  "NUEVO: FUEGO CALLEJERO",
  "NUESTRAS BURGERS",
];

export function Marquee() {
  const loop = [...ITEMS, ...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden border-y border-ink bg-foreground py-3 text-background">
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      >
        {loop.map((t, i) => (
          <span key={i} className="font-display text-2xl uppercase tracking-wide">
            {t}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
