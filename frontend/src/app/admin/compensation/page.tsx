"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Field, PageHeader, SecNo, Spinner } from "@/components/ui";
import { useIsSuper } from "@/components/admin/AdminBits";
import { api, fmtDate } from "@/lib/api";

type CommissionBase = "PRICE_EXCL_SERVICE" | "TOTAL_INCL_SERVICE";
type Withdrawal = { feePct: number; min: number; max: number; holdHours: number; enabled: boolean };
type Settings = {
  enabled: boolean; approvedById: string | null; approvedByName?: string | null; approvedAt: string | null; directRate: number; binaryRate: number; weeklyCap: number;
  binaryBasis: "WEAKER_LEG"; carryForwardVolume: boolean; capExcessCarryForward: false; weekStartDay: number; tzOffsetMinutes: number;
  timezoneLabel: string; commissionBase: CommissionBase; autoCloseWeeks: boolean; withdrawal: Withdrawal;
};
type Resp = { settings: Settings; defaults: Settings; currentWeek: string; currentWeekRange: { start: string; end: string } };

type Form = {
  enabled: boolean; directRate: string; binaryRate: string; weeklyCap: string; carryForwardVolume: boolean; weekStartDay: string;
  tzOffsetMinutes: string; timezoneLabel: string; commissionBase: CommissionBase; autoCloseWeeks: boolean;
  feePct: string; min: string; max: string; holdHours: string; wdEnabled: boolean;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toForm = (s: Settings): Form => ({
  enabled: s.enabled, directRate: String(s.directRate), binaryRate: String(s.binaryRate), weeklyCap: String(s.weeklyCap),
  carryForwardVolume: s.carryForwardVolume, weekStartDay: String(s.weekStartDay), tzOffsetMinutes: String(s.tzOffsetMinutes),
  timezoneLabel: s.timezoneLabel, commissionBase: s.commissionBase, autoCloseWeeks: s.autoCloseWeeks,
  feePct: String(s.withdrawal.feePct), min: String(s.withdrawal.min), max: String(s.withdrawal.max), holdHours: String(s.withdrawal.holdHours), wdEnabled: s.withdrawal.enabled,
});

const fmtOffset = (m: number) => {
  if (Number.isNaN(m)) return "";
  const sign = m < 0 ? "-" : "+";
  const a = Math.abs(m);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
};

function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-white/75">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#e2b04a]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export default function CompensationSettingsPage() {
  const superAdmin = useIsSuper();
  const { data, error, loading, reload } = useApi<Resp>("/admin/compensation/settings");
  const [form, setForm] = useState<Form | null>(null);
  const [ownerApproval, setOwnerApproval] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeMsg, setCloseMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (data) setForm(toForm(data.settings));
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <Alert>{error}</Alert>;
  if (!data || !form) return null;

  const s = data.settings;
  const enabling = form.enabled && !s.enabled;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabling && !ownerApproval) { setMsg({ kind: "error", text: "Tick the owner approval confirmation to switch the engine on." }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ settings: Settings; backfilled: number }>("/admin/compensation/settings", {
        method: "PUT",
        json: {
          enabled: form.enabled, directRate: Number(form.directRate), binaryRate: Number(form.binaryRate), weeklyCap: Number(form.weeklyCap),
          carryForwardVolume: form.carryForwardVolume, weekStartDay: Number(form.weekStartDay), tzOffsetMinutes: Number(form.tzOffsetMinutes),
          timezoneLabel: form.timezoneLabel, commissionBase: form.commissionBase, autoCloseWeeks: form.autoCloseWeeks,
          withdrawal: { feePct: Number(form.feePct), min: Number(form.min), max: Number(form.max), holdHours: Number(form.holdHours), enabled: form.wdEnabled },
          ownerApproval: enabling ? ownerApproval : undefined,
          password,
        },
      });
      setPassword("");
      setOwnerApproval(false);
      setMsg({
        kind: "success",
        text: enabling
          ? `Commission engine switched ON. ${r.backfilled} existing active package sale(s) were processed for direct commission and volume.`
          : "Commission settings saved. The change is recorded in the audit log.",
      });
      reload();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const closeWeeks = async () => {
    setCloseBusy(true);
    setCloseMsg(null);
    try {
      const r = await api<{ closed: string[] }>("/admin/compensation/close-weeks", { method: "POST", json: {} });
      setCloseMsg(r.closed.length
        ? { kind: "success", text: `Closed ${r.closed.length} week(s): ${r.closed.join(", ")}. Binary commission for those weeks has been credited.` }
        : { kind: "info", text: "No finished weeks were waiting to be closed." });
    } catch (err) {
      setCloseMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setCloseBusy(false);
    }
  };

  const ro = !superAdmin;
  const weekEnd = new Date(new Date(data.currentWeekRange.end).getTime() - 1);

  return (
    <>
      <PageHeader
        title="Commission settings"
        subtitle="Direct and binary commission rules, weekly cycle and withdrawal limits."
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-outline btn-sm" href="/admin/compensation/weeks">Binary weeks</Link>
            <Link className="btn-outline btn-sm" href="/admin/compensation/ledger">Reward audit</Link>
          </div>
        }
      />

      <div className={s.enabled ? "lux-card-gold mb-6 p-5" : "lux-card mb-6 p-5"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Commission engine</div>
            <div className={s.enabled ? "mt-1 font-serif text-3xl text-gold-grad" : "mt-1 font-serif text-3xl text-white/60"}>{s.enabled ? "ON" : "OFF"}</div>
            <div className="mt-1 text-xs text-white/50">
              {s.enabled
                ? <>Approved {s.approvedAt ? fmtDate(s.approvedAt, true) : "—"}{s.approvedById ? <> by {s.approvedByName ?? "admin"}</> : null}</>
                : "No commissions are calculated or credited while the engine is off."}
            </div>
          </div>
          <div className="text-right text-sm text-white/70">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Current week</div>
            <div className="mt-1 font-mono text-gold-300">{data.currentWeek}</div>
            <div className="text-xs text-white/50">{fmtDate(data.currentWeekRange.start, true)} → {fmtDate(weekEnd, true)} (shown in your browser time)</div>
          </div>
        </div>
      </div>

      {ro && <div className="mb-4"><Alert kind="info">You can view these settings. Only a Super Admin can change them.</Alert></div>}

      <form onSubmit={save} className="space-y-6">
        <div className="card p-6">
          <SecNo n={1}>Commission rules</SecNo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Direct commission (%)" hint="Paid to the sponsor on each package sale.">
              <input className="input" type="number" min={0} max={50} step="0.01" required disabled={ro} value={form.directRate} onChange={(e) => set("directRate", e.target.value)} />
            </Field>
            <Field label="Binary commission (%)" hint="Applied to matched weaker-leg volume.">
              <input className="input" type="number" min={0} max={50} step="0.01" required disabled={ro} value={form.binaryRate} onChange={(e) => set("binaryRate", e.target.value)} />
            </Field>
            <Field label="Weekly cap (USD)" hint="Max binary commission per member per week.">
              <input className="input" type="number" min={0} max={1000000} step="0.01" required disabled={ro} value={form.weeklyCap} onChange={(e) => set("weeklyCap", e.target.value)} />
            </Field>
            <Field label="Commission base" className="sm:col-span-2">
              <select className="input" disabled={ro} value={form.commissionBase} onChange={(e) => set("commissionBase", e.target.value as CommissionBase)}>
                <option value="PRICE_EXCL_SERVICE">Package price, excluding service charge</option>
                <option value="TOTAL_INCL_SERVICE">Total paid, including service charge</option>
              </select>
            </Field>
          </div>
          <div className="mt-5 space-y-3">
            <Check checked={form.carryForwardVolume} disabled={ro} onChange={(v) => set("carryForwardVolume", v)}>Carry forward unmatched volume to the next week</Check>
          </div>
          <ul className="mt-5 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60">
            <li><span className="text-gold-300">Binary basis:</span> weaker-leg (matched) volume</li>
            <li><span className="text-gold-300">Cap excess:</span> excess above the weekly cap is forfeited — not carried forward (spec §5)</li>
            <li><span className="text-gold-300">Level income:</span> not active — applies only to shareholder rewards, which are not enabled</li>
          </ul>
        </div>

        <div className="card p-6">
          <SecNo n={2}>Weekly cycle</SecNo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Week starts on">
              <select className="input" disabled={ro} value={form.weekStartDay} onChange={(e) => set("weekStartDay", e.target.value)}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </Field>
            <Field label="Timezone label" hint="Shown to members, e.g. Asia/Kolkata (IST).">
              <input className="input" required minLength={2} maxLength={60} disabled={ro} value={form.timezoneLabel} onChange={(e) => set("timezoneLabel", e.target.value)} />
            </Field>
            <Field label="UTC offset (minutes)" hint={fmtOffset(Number(form.tzOffsetMinutes)) || "e.g. 330 for IST, 240 for Dubai"}>
              <input className="input" type="number" min={-720} max={840} step={1} required disabled={ro} value={form.tzOffsetMinutes} onChange={(e) => set("tzOffsetMinutes", e.target.value)} />
            </Field>
          </div>
          <div className="mt-5">
            <Check checked={form.autoCloseWeeks} disabled={ro} onChange={(v) => set("autoCloseWeeks", v)}>Close finished weeks automatically (credits binary commission after each week ends)</Check>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <button type="button" className="btn-outline btn-sm" onClick={closeWeeks} disabled={closeBusy}>{closeBusy ? "Closing…" : "Close finished weeks now"}</button>
            <span className="text-xs text-white/45">Safe to repeat — weeks already closed are skipped.</span>
          </div>
          {closeMsg && <div className="mt-3"><Alert kind={closeMsg.kind}>{closeMsg.text}</Alert></div>}
        </div>

        <div className="card p-6">
          <SecNo n={3}>Withdrawals (USDT · BEP20)</SecNo>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Fee (%)">
              <input className="input" type="number" min={0} max={50} step="0.01" required disabled={ro} value={form.feePct} onChange={(e) => set("feePct", e.target.value)} />
            </Field>
            <Field label="Minimum (USD)">
              <input className="input" type="number" min={0} step="0.01" required disabled={ro} value={form.min} onChange={(e) => set("min", e.target.value)} />
            </Field>
            <Field label="Maximum (USD)">
              <input className="input" type="number" min={1} step="0.01" required disabled={ro} value={form.max} onChange={(e) => set("max", e.target.value)} />
            </Field>
            <Field label="Security hold (hours)" hint="After a wallet address change.">
              <input className="input" type="number" min={0} max={720} step={1} required disabled={ro} value={form.holdHours} onChange={(e) => set("holdHours", e.target.value)} />
            </Field>
          </div>
          <div className="mt-5">
            <Check checked={form.wdEnabled} disabled={ro} onChange={(v) => set("wdEnabled", v)}>Members can request withdrawals</Check>
          </div>
        </div>

        <div className="card p-6">
          <SecNo n={4}>Engine status &amp; confirmation</SecNo>
          <Check checked={form.enabled} disabled={ro} onChange={(v) => set("enabled", v)}>
            Commission engine enabled {s.enabled && !form.enabled && <span className="text-amber-300">— saving will switch the engine OFF; no further commissions will be credited.</span>}
          </Check>
          {enabling && (
            <div className="mt-4 rounded-xl border border-gold-400/40 bg-gold-400/[0.06] p-4">
              <Alert kind="warning">Switching the engine on also processes every existing active package sale (direct commission and binary volume) once.</Alert>
              <div className="mt-3">
                <Check checked={ownerApproval} onChange={setOwnerApproval}>
                  I am the business owner / authorised and approve these commission rules (requirements §21/§23). I confirm they comply with applicable law.
                </Check>
              </div>
            </div>
          )}
          {!ro && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Your password" hint="Re-enter your password to confirm.">
                <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </div>
          )}
          {msg && <div className="mt-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
          {!ro && (
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => { setForm(toForm(s)); setOwnerApproval(false); setMsg(null); }}>Reset</button>
              <button className="btn-lux" disabled={busy || (enabling && !ownerApproval)}>{busy ? "Saving…" : enabling ? "Approve & switch ON" : "Save settings"}</button>
            </div>
          )}
        </div>
      </form>
    </>
  );
}
