import { motion } from "framer-motion";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "ink" | "mustard" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground border-primary",
  ink: "bg-foreground text-background border-foreground",
  mustard: "bg-primary text-primary-foreground border-primary",
  ghost: "bg-transparent text-foreground border-ink hover:bg-foreground hover:text-background",
};
const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-4 text-lg",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  glow?: boolean;
  children: ReactNode;
};

export const SmashButton = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", glow = false, className = "", children, ...rest }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -2, transition: { type: "spring", stiffness: 400, damping: 10 } }}
        whileTap={{ x: 0, y: 0, scale: 0.96 }}
        className={`group relative inline-flex items-center justify-center gap-2 border font-display uppercase tracking-wide shadow-[0_12px_24px_-18px_var(--ink)] hover:shadow-[0_18px_32px_-22px_var(--ink)] active:shadow-[0_8px_16px_-16px_var(--ink)] transition-shadow ${variants[variant]} ${sizes[size]} ${glow ? "animate-pulse-glow" : ""} ${className}`}
        {...(rest as any)}
      >
        <span className="group-hover:animate-shake-soft inline-flex items-center gap-2">
          {children}
        </span>
      </motion.button>
    );
  },
);
SmashButton.displayName = "SmashButton";
