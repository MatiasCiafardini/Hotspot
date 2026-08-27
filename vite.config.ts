// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const staging = process.env.VITE_APP_ENV === "staging";

export default defineConfig({
  vite: {
    define: staging
      ? {
          "import.meta.env.VITE_APP_ENV": JSON.stringify("staging"),
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ),
        }
      : undefined,
    server: {
      allowedHosts: ["hotspot.com.ar", "www.hotspot.com.ar"],
    },
    preview: {
      allowedHosts: ["hotspot.com.ar", "www.hotspot.com.ar"],
    },
  },
});
