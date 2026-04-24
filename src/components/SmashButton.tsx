import { motion } from "framer-motion";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "ink" | "mustard" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground border-ink",
  ink: "bg-ink text-cream border-ink",
  mustard: "bg-mustard text-mustard-foreground border-ink",
  ghost: "bg-transparent text-ink border-ink hover:bg-ink hover:text-cream",
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
        whileHover={{ x: -2, y: -2, transition: { type: "spring", stiffness: 400, damping: 10 } }}
        whileTap={{ x: 0, y: 0, scale: 0.96 }}
        className={`group relative inline-flex items-center justify-center gap-2 border-[3px] font-display uppercase tracking-wider shadow-[4px_4px_0_0_var(--ink)] hover:shadow-[6px_6px_0_0_var(--ink)] active:shadow-[2px_2px_0_0_var(--ink)] transition-shadow ${variants[variant]} ${sizes[size]} ${glow ? "animate-pulse-glow" : ""} ${className}`}
        {...(rest as any)}
      >
        <span className="group-hover:animate-shake-soft inline-flex items-center gap-2">{children}</span>
      </motion.button>
    );
  }
);
SmashButton.displayName = "SmashButton";
