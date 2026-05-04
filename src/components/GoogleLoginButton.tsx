import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCustomerAuth } from "@/lib/customer-auth";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleButtonConfig = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
        };
      };
    };
  }
}

type GoogleLoginButtonProps = {
  redirectTo?: string;
  className?: string;
  text?: GoogleButtonConfig["text"];
};

const GOOGLE_SCRIPT_ID = "google-identity-services";

function loadGoogleScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      if (existing.dataset.loaded === "true") {
        window.setTimeout(() => (window.google?.accounts?.id ? resolve() : reject(new Error("No pudimos cargar Google."))), 0);
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No pudimos cargar Google.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("No pudimos cargar Google."));
    document.head.appendChild(script);
  });
}

function getRedirect(fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = new URLSearchParams(window.location.search).get("redirect");
  return value?.startsWith("/") ? value : fallback;
}

export function GoogleLoginButton({ redirectTo, className, text = "continue_with" }: GoogleLoginButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { googleLogin } = useCustomerAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = useMemo(() => redirectTo ?? getRedirect("/mi-cuenta"), [redirectTo]);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    let cancelled = false;

    if (!clientId) {
      setError("Falta configurar VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response.credential) {
              setError("Google no devolvio una credencial valida.");
              return;
            }

            setBusy(true);
            setError(null);
            try {
              await googleLogin(response.credential);
              await navigate({ to: target as any });
            } catch (err) {
              setError(err instanceof Error ? err.message : "No pudimos iniciar sesion con Google.");
            } finally {
              setBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          width: Math.min(360, buttonRef.current.clientWidth || 320),
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No pudimos cargar Google.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, googleLogin, navigate, target, text]);

  return (
    <div className={className}>
      <div className={busy ? "pointer-events-none opacity-60" : undefined} ref={buttonRef} />
      {error && <p className="mt-2 border border-red-500 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
