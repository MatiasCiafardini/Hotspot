import type { LucideIcon } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
          {eyebrow}
        </p>
        <h1 className="font-display text-4xl text-white md:text-6xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  title,
  value,
  Icon,
  tone = "default",
}: {
  title: string;
  value: string | number;
  Icon: LucideIcon;
  tone?: "default" | "orange" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-zinc-900/80 p-4 shadow-lg",
        tone === "orange" && "border-orange-400/50 bg-orange-500/15",
        tone === "danger" && "border-red-400/40 bg-red-500/10",
        tone === "default" && "border-white/10",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{title}</p>
        <Icon className={cn("h-5 w-5", tone === "orange" ? "text-orange-300" : "text-zinc-400")} />
      </div>
      <p className="mt-3 font-display text-3xl text-white">{value}</p>
    </div>
  );
}

export function AdminButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "border-orange-400 bg-orange-500 text-black hover:bg-orange-400",
        variant === "ghost" &&
          "border-white/15 bg-zinc-900 text-zinc-100 hover:border-orange-400/50 hover:text-orange-200",
        variant === "danger" && "border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400",
        props.className,
      )}
    />
  );
}

export function AdminTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400",
        props.className,
      )}
    />
  );
}

export function AdminSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "min-h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400",
        props.className,
      )}
    />
  );
}

export function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
