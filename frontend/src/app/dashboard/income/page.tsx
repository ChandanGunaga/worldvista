"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Empty, PageHeader, SecNo, Spinner, StatCard } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Income = {
  engineEnabled: boolean;
  summary: {
    available: string; pendingWithdrawals: string; pendingCount: number; paid: string; totalEarned: string; walletAddress: string | null; securityHoldUntil: string | null;
    earned: { direct: string; binary: string; rank: string; level: string; reversals: string };
  };
  week: { weekKey: string; end: string; timezone: string; calculated: string; payable: string; capped: string; cap: string; capRemaining: string; matched: string; rate: number };
  ledger: { id: string; txId: string; type: string; amount: string; balanceAfter: string; memo: string; createdAt: string; calc: Record<string, unknown> | null; activation: { receiptNo: string } | null; withdrawal: { reference: string } | null }[];
};

const TYPES: Record<string, string> = {
  DIRECT: "Direct commission", BINARY: "Binary commission", RANK: "Rank reward", REVERSAL: "Reversal",
  WITHDRAWAL_HOLD: "Withdrawal (reserved)", WITHDRAWAL_RELEASE: "Withdrawal released",
};

export default function IncomePage() {
  const [type, setType] = useState("");
  const { data, error, loading } = useApi<Income>(`/member/income${type ? `?type=${type}` : ""}`);
  const [open, setOpen] = useState<string | null>(null);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const s = data.summary;
  const w = data.week;
  const capPct = Math.min(100, Math.round((Number(w.payable) / Math.max(1, Number(w.cap))) * 100));

  return (
    <>
      <PageHeader title="Income & Wallet" subtitle="Commission ledger, balances and withdrawals. Separate from your USD Package Credit." action={<Link href="/dashboard/withdrawals" className="btn-lux">Withdraw</Link>} />
      {!data.engineEnabled && <div className="mb-6"><Alert kind="info">Commission calculation has not been switched on yet. Balances appear here once it is active.</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available balance" value={money(s.available, "USD")} hint="Can be withdrawn" />
        <StatCard label="Pending withdrawals" value={money(s.pendingWithdrawals, "USD")} hint={`${s.pendingCount} request(s) on hold`} />
        <StatCard label="Paid out" value={money(s.paid, "USD")} hint="Completed withdrawals" />
        <StatCard label="Total earned" value={money(s.totalEarned, "USD")} hint="Net of reversals" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <SecNo n={1}>Income breakdown</SecNo>
          <div className="lux-card divide-y divide-white/[0.06] px-5">
            {[["Direct commission", s.earned.direct], ["Binary commission", s.earned.binary], ["Rank rewards", s.earned.rank], ["Level income", s.earned.level], ["Reversals", s.earned.reversals]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-3 text-sm"><span className="text-white/60">{k}</span><span className={Number(v) < 0 ? "text-red-300" : "text-white"}>{money(v, "USD")}</span></div>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/35">Level income is not active: it applies only to shareholder rewards, which are not offered.</p>
        </div>
        <div>
          <SecNo n={2}>Binary weekly cap · this week</SecNo>
          <div className="lux-card-gold p-5">
            <div className="flex items-end justify-between">
              <div><div className="text-xs uppercase tracking-widest text-white/45">Projected binary</div><div className="font-serif text-3xl text-gold-grad">{money(w.payable, "USD")}</div></div>
              <div className="text-right text-xs text-white/50">Cap {money(w.cap, "USD")} / week<br />Remaining {money(w.capRemaining, "USD")}</div>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold-grad transition-all duration-700" style={{ width: `${capPct}%` }} /></div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-xl bg-white/[0.04] p-2"><div className="text-white/45">Matched</div><div className="text-white">{money(w.matched, "USD")}</div></div>
              <div className="rounded-xl bg-white/[0.04] p-2"><div className="text-white/45">Calculated ({w.rate}%)</div><div className="text-white">{money(w.calculated, "USD")}</div></div>
              <div className="rounded-xl bg-white/[0.04] p-2"><div className="text-white/45">Over cap (not payable)</div><div className="text-white">{money(w.capped, "USD")}</div></div>
            </div>
            <p className="mt-3 text-[11px] text-white/40">Week of {w.weekKey}, closes {fmtDate(w.end, true)} ({w.timezone}). Credited when the week closes. Amounts above the cap are not carried forward.</p>
          </div>
        </div>
      </div>

      <div className="mt-10"><SecNo n={3}>Ledger</SecNo></div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {["", "DIRECT", "BINARY", "RANK", "REVERSAL", "WITHDRAWAL_HOLD", "WITHDRAWAL_RELEASE"].map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full border px-3 py-1.5 transition ${type === t ? "border-gold-400 bg-gold-400/15 text-gold-200" : "border-white/10 text-white/55 hover:text-white"}`}>{t ? TYPES[t] : "All"}</button>
        ))}
      </div>
      <section className="card overflow-x-auto p-4 sm:p-6">
        {data.ledger.length ? (
          <table className="table-x">
            <thead><tr><th>Transaction</th><th>Type</th><th>Details</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th>Date</th></tr></thead>
            <tbody>
              {data.ledger.map((l) => (
                <tr key={l.id} className="cursor-pointer" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <td className="font-mono text-xs">{l.txId}</td>
                  <td>{TYPES[l.type] ?? l.type}</td>
                  <td className="max-w-sm text-xs text-white/55">
                    {l.memo}
                    {open === l.id && l.calc && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg bg-white/[0.04] p-2 font-mono text-[11px]">
                        {Object.entries(l.calc).map(([k, v]) => (<div key={k} className="contents"><dt className="text-white/40">{k}</dt><dd className="text-white/75">{String(v)}</dd></div>))}
                      </dl>
                    )}
                  </td>
                  <td className={`text-right font-mono ${Number(l.amount) < 0 ? "text-red-300" : "text-emerald-300"}`}>{Number(l.amount) > 0 ? "+" : ""}{Number(l.amount).toFixed(2)}</td>
                  <td className="text-right font-mono">{Number(l.balanceAfter).toFixed(2)}</td>
                  <td className="whitespace-nowrap">{fmtDate(l.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No ledger entries yet.</Empty>}
        <p className="mt-3 text-xs text-white/35">Click a row to see its calculation details.</p>
      </section>
    </>
  );
}
