"use client";
import { useState } from "react";
import { useSession } from "@/components/session";

/** Format a volume / plain number (Decimal strings welcome) with up to 2 decimals. */
export const num = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** True when the signed-in staff member is a Super Admin. */
export function useIsSuper() {
  const { user } = useSession();
  return user?.role === "SUPER_ADMIN";
}

/** CSV download link with optional from/to date range (YYYY-MM-DD). */
export function CsvExport({ href, label = "Download CSV" }: { href: string; label?: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const url = qs.toString() ? `${href}?${qs}` : href;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" className="input !w-auto !py-1.5 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="CSV from date" />
      <span className="text-xs text-white/40">to</span>
      <input type="date" className="input !w-auto !py-1.5 text-xs" value={to} onChange={(e) => setTo(e.target.value)} aria-label="CSV to date" />
      <a className="btn-outline btn-sm" href={url}>{label}</a>
    </div>
  );
}

const humanKey = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Renders a JSON calculation log as a readable key/value list (recurses into nested objects). */
export function CalcLog({ calc }: { calc: unknown }) {
  if (calc === null || calc === undefined) return <p className="text-sm text-white/50">No calculation log recorded for this entry.</p>;
  if (typeof calc !== "object") return <p className="font-mono text-sm text-white/80">{String(calc)}</p>;
  const entries = Array.isArray(calc) ? calc.map((v, i) => [String(i), v] as const) : Object.entries(calc as Record<string, unknown>);
  return (
    <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-white/[0.02]">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(120px,40%)_1fr] gap-3 px-4 py-2 text-sm">
          <dt className="text-white/50">{humanKey(k)}</dt>
          <dd className="break-all font-mono text-white/85">
            {v !== null && typeof v === "object" ? <CalcLog calc={v} /> : typeof v === "boolean" ? (v ? "yes" : "no") : v === null ? "—" : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const tone = {
  green: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  amber: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  indigo: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/30",
  red: "bg-red-400/10 text-red-300 ring-red-400/30",
  grey: "bg-white/5 text-white/50 ring-white/15",
};
const statusTone: Record<string, keyof typeof tone> = {
  PENDING: "amber", PENDING_REVIEW: "amber", PROCESSING: "indigo", COMPLETED: "green", APPROVED: "green", ELIGIBLE: "green", ACTIVE: "green",
  REJECTED: "red", NOT_ELIGIBLE: "grey", INACTIVE: "grey",
};

/** Status pill for compensation / withdrawal states not covered by the shared Badge palette. */
export function StatusPill({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[statusTone[value] ?? "grey"]}`}>
      {value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}
