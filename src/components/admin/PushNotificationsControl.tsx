import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Download, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { adminApiFetch, readApiError } from "@/lib/admin-api";
import { getInstallPrompt, isStandaloneApp, subscribeToInstallPrompt } from "@/lib/pwa-install";
import { cn } from "@/lib/utils";

type PushState = "loading" | "unsupported" | "blocked" | "inactive" | "active" | "error";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function sameApplicationServerKey(current: ArrayBuffer | null, expected: Uint8Array) {
  if (!current || current.byteLength !== expected.byteLength) return false;
  const currentBytes = new Uint8Array(current);
  return currentBytes.every((value, index) => value === expected[index]);
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PushNotificationsControl({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const prepareAudio = useCallback(async () => {
    const AudioContextClass = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    if (context.state === "suspended") await context.resume();
  }, []);

  const playAlarm = useCallback(async () => {
    try {
      await prepareAudio();
      const context = audioContextRef.current;
      if (!context) return;
      [0, 0.22].forEach((delay) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.16);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + 0.17);
      });
    } catch {
      // The visible toast remains the fallback when the browser blocks audio.
    }
  }, [prepareAudio]);

  const getRegistration = useCallback(async () => {
    await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    return navigator.serviceWorker.ready;
  }, []);

  const refreshState = useCallback(async () => {
    if (!supported) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        window.localStorage.setItem("hotspot-push-active", "false");
        return setState("inactive");
      }
      const response = await adminApiFetch("/api/admin/push/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("No se pudo validar la suscripcion Push.");
      window.localStorage.setItem("hotspot-push-active", "true");
      setState("active");
    } catch {
      window.localStorage.setItem("hotspot-push-active", "false");
      setState("error");
    }
  }, [getRegistration, supported]);

  useEffect(() => {
    setInstallAvailable(Boolean(getInstallPrompt()) || (isIosDevice() && !isStandaloneApp()));
    return subscribeToInstallPrompt(() => {
      setInstallAvailable(Boolean(getInstallPrompt()) || (isIosDevice() && !isStandaloneApp()));
    });
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (!supported) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "NEW_ORDER_PUSH") return;
      const payload = event.data.payload as { title?: string; body?: string };
      void playAlarm();
      toast.success(payload.title || "Nuevo pedido", { description: payload.body });
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [playAlarm, supported]);

  const install = async () => {
    if (isIosDevice() && !isStandaloneApp()) {
      setShowIosHelp(true);
      return;
    }
    const prompt = getInstallPrompt();
    if (!prompt) return toast.info("Usa la opcion Instalar aplicacion de tu navegador.");
    await prompt.prompt();
    await prompt.userChoice;
    setInstallAvailable(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      await prepareAudio();
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "inactive");
        return;
      }
      const configResponse = await adminApiFetch("/api/admin/push/config");
      if (!configResponse.ok) {
        throw new Error(await readApiError(configResponse, "Push no esta configurado."));
      }
      const { publicKey } = (await configResponse.json()) as { publicKey: string };
      const registration = await getRegistration();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      let current = await registration.pushManager.getSubscription();
      if (
        current &&
        !sameApplicationServerKey(current.options.applicationServerKey, applicationServerKey)
      ) {
        await current.unsubscribe();
        current = null;
      }
      const subscription =
        current ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));
      const response = await adminApiFetch("/api/admin/push/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "No se pudo guardar el dispositivo."));
      }
      setState("active");
      window.localStorage.setItem("hotspot-push-active", "true");
      toast.success("Notificaciones activadas en este dispositivo.");
    } catch (error) {
      setState("error");
      toast.error(error instanceof Error ? error.message : "No se pudieron activar.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await adminApiFetch("/api/admin/push/subscriptions", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("inactive");
      window.localStorage.setItem("hotspot-push-active", "false");
      toast.success("Notificaciones desactivadas en este dispositivo.");
    } catch {
      toast.error("No se pudieron desactivar las notificaciones.");
    } finally {
      setBusy(false);
    }
  };

  const label: Record<PushState, string> = {
    loading: "Revisando avisos...",
    unsupported: "Push no compatible",
    blocked: "Notificaciones bloqueadas",
    inactive: "Activar notificaciones",
    active: "Notificaciones activas",
    error: "Reintentar notificaciones",
  };

  return (
    <>
      <div className={cn("grid gap-2", compact && "text-xs")}>
        {installAvailable && (
          <button
            type="button"
            onClick={install}
            className="flex items-center justify-center gap-2 rounded-md border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-orange-200 hover:bg-orange-500/20"
          >
            <Download className="h-4 w-4" /> Instalar aplicacion
          </button>
        )}
        <button
          type="button"
          disabled={busy || state === "loading" || state === "unsupported"}
          onClick={state === "active" ? disable : enable}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border px-3 py-2 disabled:opacity-50",
            state === "active"
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-white/15 bg-zinc-900 text-zinc-300 hover:border-orange-400/40",
          )}
        >
          {state === "active" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {busy ? "Procesando..." : label[state]}
        </button>
      </div>

      {showIosHelp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-w-sm rounded-lg border border-orange-400/40 bg-zinc-950 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="absolute right-3 top-3 text-zinc-400"
              aria-label="Cerrar instrucciones"
            >
              <X className="h-5 w-5" />
            </button>
            <Smartphone className="mb-3 h-8 w-8 text-orange-300" />
            <h2 className="font-display text-2xl">Instalar en iPhone</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
              <li>Abrí esta pagina en Safari.</li>
              <li>Tocá Compartir.</li>
              <li>Elegí Agregar a pantalla de inicio.</li>
              <li>Abrí Hotspot desde el nuevo icono y activá las notificaciones.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
