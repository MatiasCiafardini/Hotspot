import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { Toaster } from "@/components/ui/sonner";
import { RouteTransitionProvider } from "@/components/RouteTransitionProvider";
import { CustomerAuthProvider } from "@/lib/customer-auth";
import favicon from "@/assets/logo_hotspot.png?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="font-display text-[10rem] leading-none text-ink">404</p>
      <p className="mt-2 font-display text-2xl uppercase">Esta calle no existe</p>
      <a
        href="/"
        className="mt-6 inline-flex items-center border border-primary bg-primary px-6 py-3 font-display uppercase text-primary-foreground shadow-[0_12px_24px_-18px_var(--ink)]"
      >
        Volver al spot
      </a>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hotspot - Burgers y street food" },
      {
        name: "description",
        content: "Hamburguesas urbanas, sabor de barrio. Pedi online y retira o te lo llevamos.",
      },
      { name: "theme-color", content: "#f28c28" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Hotspot" },
      { property: "og:title", content: "Hotspot - Burgers y street food" },
      { property: "og:description", content: "Hamburguesas urbanas, sabor de barrio." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: favicon },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/pwa-icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bowlby+One&family=Permanent+Marker&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const isAdmin = useRouterState({
    select: (state) => state.location.pathname.startsWith("/admin"),
  });

  return (
    <CartProvider>
      <CustomerAuthProvider>
        <RouteTransitionProvider>
          <div className="flex min-h-screen flex-col">
            {!isAdmin && <Header />}
            <main className={!isAdmin ? "flex-1 pt-[73px] md:pt-[81px]" : "flex-1"}>
              <Outlet />
            </main>
            {!isAdmin && <Footer />}
            {!isAdmin && <CartDrawer />}
            <Toaster />
          </div>
        </RouteTransitionProvider>
      </CustomerAuthProvider>
    </CartProvider>
  );
}
