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
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-navy-100 bg-navy-50 text-navy-800",
    warning: "border-gold-300 bg-gold-50 text-gold-700",
  }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={clsx("rounded-xl border px-4 py-3 text-sm", styles)}>{children}</div>;
}

const badgeColors: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ENROLLED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  NEW: "bg-sky-50 text-sky-700 ring-sky-200",
  OPEN: "bg-sky-50 text-sky-700 ring-sky-200",
  REQUESTED: "bg-sky-50 text-sky-700 ring-sky-200",
  CONTACTED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PENDING_VERIFICATION: "bg-amber-50 text-amber-700 ring-amber-200",
  PENDING_OWNER_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-200",
  PENDING_LEGAL_REVIEW: "bg-orange-50 text-orange-700 ring-orange-200",
  SUSPENDED: "bg-red-50 text-red-700 ring-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
  WITHDRAWN: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", badgeColors[value] ?? "bg-slate-100 text-slate-700 ring-slate-200", className)}>
      {value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl text-navy-950 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 font-serif text-3xl text-navy-950">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Spinner() {
  return <div className="py-10 text-center text-sm text-slate-500">Loading…</div>;
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="card my-8 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl text-navy-950">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
