import { createContext, useCallback, useContext, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, useAnimationControls } from "framer-motion";
import logoHotspot from "@/assets/logo_hotspot.png";

const WIPE_DURATION_SECONDS = 0.62;
const WIPE_DURATION_MS = WIPE_DURATION_SECONDS * 1000;
const WIPE_EASE = [0.76, 0, 0.24, 1] as const;

type RouteTransitionContextValue = {
  active: boolean;
  navigateWithTransition: (path: string, options?: { resetScroll?: boolean }) => Promise<void>;
};

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null);

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function normalizePath(path: string) {
  const url = new URL(path, window.location.origin);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const isAdmin = useRouterState({ select: (state) => state.location.pathname.startsWith("/admin") });
  const controls = useAnimationControls();
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  const navigateWithTransition = useCallback(
    async (path: string, options?: { resetScroll?: boolean }) => {
      if (activeRef.current) return;

      const resetScroll = options?.resetScroll ?? true;
      const nextPath = normalizePath(path);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;

      activeRef.current = true;
      setActive(true);

      controls.set({ clipPath: "inset(0 100% 0 0)" });
      await controls.start({
        clipPath: "inset(0 0% 0 0)",
        transition: { duration: WIPE_DURATION_SECONDS, ease: WIPE_EASE },
      });

      await navigate({ to: nextPath as any, resetScroll });
      await waitForPaint();
      if (resetScroll) window.scrollTo(0, 0);

      await controls.start({
        clipPath: "inset(0 0 0 100%)",
        transition: { duration: WIPE_DURATION_SECONDS, ease: WIPE_EASE },
      });

      controls.set({ clipPath: "inset(0 100% 0 0)" });
      activeRef.current = false;
      setActive(false);
    },
    [controls, navigate],
  );

  const handleInternalLink = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.dataset.transitionHandled === "true") return;

    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    void navigateWithTransition(`${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <RouteTransitionContext.Provider value={{ active, navigateWithTransition }}>
      <div onClickCapture={handleInternalLink}>
        {children}
        <motion.div
          aria-hidden="true"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={controls}
          className={`fixed inset-x-0 bottom-0 top-0 z-[40] bg-background will-change-[clip-path] ${
            active ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div className="absolute inset-0 halftone opacity-30" />
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <img
              src={logoHotspot}
              alt=""
              className="w-[min(72vw,520px)] max-h-[52vh] object-contain drop-shadow-[0_20px_55px_rgba(0,0,0,0.55)]"
            />
          </div>
        </motion.div>
      </div>
    </RouteTransitionContext.Provider>
  );
}

export function useRouteTransition() {
  const value = useContext(RouteTransitionContext);
  if (!value) {
    throw new Error("useRouteTransition must be used inside RouteTransitionProvider");
  }
  return value;
}

export function TransitionLink({
  to,
  children,
  className,
  onClick,
  resetScroll,
  "aria-label": ariaLabel,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  resetScroll?: boolean;
  "aria-label"?: string;
}) {
  const { navigateWithTransition } = useRouteTransition();

  return (
    <a
      href={to}
      data-transition-handled="true"
      aria-label={ariaLabel}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onClick?.();
        void navigateWithTransition(to, { resetScroll });
      }}
    >
      {children}
    </a>
  );
}
