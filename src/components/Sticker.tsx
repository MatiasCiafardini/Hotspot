import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  rotate?: number;
  delay?: number;
  className?: string;
  color?: "red" | "mustard" | "cream" | "ink" | "cyan" | "pink";
};

const COLORS: Record<NonNullable<Props["color"]>, string> = {
  red: "bg-primary text-primary-foreground",
  mustard: "bg-mustard text-mustard-foreground",
  cream: "bg-cream text-ink",
  ink: "bg-ink text-cream",
  cyan: "bg-cyan text-ink",
  pink: "bg-pink text-ink",
};

export function Sticker({ children, rotate = -6, delay = 0, className = "", color = "mustard" }: Props) {
  return (
    <motion.div
      initial={{ scale: 0.3, rotate: rotate - 20, opacity: 0 }}
      animate={{ scale: 1, rotate, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 14, delay }}
      className={`inline-flex items-center gap-1 border-[3px] border-ink px-3 py-1 font-display text-sm uppercase tracking-wide shadow-[3px_3px_0_0_var(--ink)] ${COLORS[color]} ${className}`}
    >
      {children}
    </motion.div>
  );
}
