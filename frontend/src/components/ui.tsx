"use client";
import clsx from "clsx";
import { useState, type ReactNode } from "react";

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  if (!children) return null;
  const styles = {
    error: "border-red-400/30 bg-red-500/10 text-red-200",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    info: "border-sky-400/25 bg-sky-500/10 text-sky-200",
    warning: "border-gold-400/40 bg-gold-400/10 text-gold-200",
  }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={clsx("rounded-xl border px-4 py-3 text-sm", styles)}>{children}</div>;
}

const badgeColors: Record<string, string> = {
  ACTIVE: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  ENROLLED: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  CONFIRMED: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  RESOLVED: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  COMPLETED: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  NEW: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  OPEN: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  REQUESTED: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  CONTACTED: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/30",
  IN_PROGRESS: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/30",
  PENDING_VERIFICATION: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  PENDING_OWNER_APPROVAL: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  PENDING_LEGAL_REVIEW: "bg-orange-400/10 text-orange-300 ring-orange-400/30",
  SUSPENDED: "bg-red-400/10 text-red-300 ring-red-400/30",
  CANCELLED: "bg-white/5 text-white/50 ring-white/15",
  CLOSED: "bg-white/5 text-white/50 ring-white/15",
  PAID: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  APPROVED: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  PENDING: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  PENDING_APPROVAL: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  CREATED: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  FAILED: "bg-red-400/10 text-red-300 ring-red-400/30",
  VOIDED: "bg-white/5 text-white/50 ring-white/15",
  REFUNDED: "bg-white/5 text-white/50 ring-white/15",
  WITHDRAWN: "bg-white/5 text-white/50 ring-white/15",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", badgeColors[value] ?? "bg-white/5 text-white/50 ring-white/15", className)}>
      {value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl text-white sm:text-4xl">{title}</h1>
        <div className="mt-3 h-[2px] w-16 rounded-full bg-gold-grad" />
        {subtitle && <p className="mt-3 text-sm text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat-tile">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 font-serif text-3xl text-gold-grad">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center text-sm text-white/45">{children}</div>;
}

export function Spinner() {
  return <div className="flex items-center justify-center gap-3 py-12 text-sm text-white/45"><span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />Loading…</div>;
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-outline btn-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="lux-card-gold my-8 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl text-white">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Numbered section label in the portal, e.g. <SecNo n={1}>Overview</SecNo> */
export function SecNo({ n, children }: { n: number; children: ReactNode }) {
  return <div className="sec-no mb-4"><span>{String(n).padStart(2, "0")}</span><span className="text-white/50">{children}</span></div>;
}
