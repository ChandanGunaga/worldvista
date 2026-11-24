"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, CopyButton, Empty, Field, Modal, PageHeader, Spinner, StatCard } from "@/components/ui";
import { CsvExport, StatusPill } from "@/components/admin/AdminBits";
import { api, fmtDate, money } from "@/lib/api";

type Status = "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";
type Withdrawal = {
  id: string; reference: string; amount: string; fee: string; net: string; network: string; address: string; status: Status;
  txHash: string | null; rejectReason: string | null; reviewedBy: string | null; reviewedAt: string | null; completedAt: string | null; createdAt: string;
  user: { memberId: string; fullName: string; email: string; walletChangedAt: string | null };
};
type Resp = { withdrawals: Withdrawal[]; totals: Partial<Record<Status, { count: number; amount: string; net: string }>> };

const STATUSES: { v: Status; l: string; hint: string }[] = [
  { v: "PENDING", l: "Pending", hint: "Awaiting review" },
  { v: "PROCESSING", l: "Processing", hint: "Internal — member sees Pending" },
  { v: "COMPLETED", l: "Completed", hint: "Paid on-chain" },
  { v: "REJECTED", l: "Rejected", hint: "Returned to balance" },
];
const NETWORK = "USDT – BNB Smart Chain (BEP20)";
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const RECENT_MS = 7 * 864e5;

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export default function WithdrawalsPage() {
  const [status, setStatus] = useState<Status | "">("PENDING");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("q", search);
  const { data, error, loading, reload } = useApi<Resp>(`/admin/withdrawals?${params}`);

  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [complete, setComplete] = useState<Withdrawal | null>(null);
  const [reject, setReject] = useState<Withdrawal | null>(null);
  const [form, setForm] = useState({ txHash: "", confirmPaid: false, reason: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  const open = (w: Withdrawal, kind: "complete" | "reject") => {
    setForm({ txHash: "", confirmPaid: false, reason: "", password: "" });
    setErr("");
    if (kind === "complete") setComplete(w); else setReject(w);
  };

  const markProcessing = async (w: Withdrawal) => {
    if (!window.confirm(`Mark ${w.reference} as processing? The member will continue to see it as Pending.`)) return;
    setMsg(null);
    try {
      await api(`/admin/withdrawals/${w.id}/review`, { method: "POST", json: { action: "processing" } });
      setMsg({ kind: "success", text: `${w.reference} marked processing.` });
      reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const doComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    const txHash = form.txHash.trim();
    if (!TX_RE.test(txHash)) { setErr("Enter a valid BEP20 transaction hash: 0x followed by 64 hex characters."); return; }
    if (!form.confirmPaid) { setErr("Confirm that the USDT transfer has been broadcast and paid."); return; }
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/withdrawals/${complete.id}/review`, { method: "POST", json: { action: "complete", txHash, confirmPaid: true, password: form.password } });
      setMsg({ kind: "success", text: `${complete.reference} completed — ${money(complete.net)} USDT to ${complete.address}. The member has been notified.` });
      setComplete(null);
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reject) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/withdrawals/${reject.id}/review`, { method: "POST", json: { action: "reject", reason: form.reason.trim(), password: form.password } });
      setMsg({ kind: "success", text: `${reject.reference} rejected. ${money(reject.amount)} returned to ${reject.user.memberId}'s available balance.` });
      setReject(null);
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const t = data?.totals ?? {};
  const txOk = TX_RE.test(form.txHash.trim());

  return (
    <>
      <PageHeader title="Withdrawals" subtitle="Member USDT (BEP20) withdrawal requests. Pay on-chain first, then record the transaction hash." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((s) => (
          <button key={s.v} type="button" className="text-left" onClick={() => setStatus(s.v)}>
            <StatCard label={`${s.l} · ${t[s.v]?.count ?? 0}`} value={money(t[s.v]?.amount ?? 0)} hint={`${s.hint}${t[s.v] ? ` · net ${money(t[s.v]!.net)} USDT` : ""}`} />
          </button>
        ))}
      </div>

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className="input max-w-xs" placeholder="Reference, Member ID or tx hash" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input max-w-[170px]" value={status} onChange={(e) => setStatus(e.target.value as Status | "")} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <button className="btn-navy">Search</button>
        <div className="ml-auto"><CsvExport href="/api/admin/reports/withdrawals.csv" /></div>
      </form>

      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {loading && !data ? <Spinner /> : !data?.withdrawals.length ? <Empty>No withdrawals match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Member</th><th>Amount</th><th>Fee</th><th>Net USDT</th><th>Destination</th><th>Status</th><th>Requested</th><th /></tr></thead>
            <tbody>
              {data.withdrawals.map((w) => {
                const recent = !!w.user.walletChangedAt && now - new Date(w.user.walletChangedAt).getTime() < RECENT_MS;
                return (
                  <tr key={w.id}>
                    <td className="font-mono text-xs text-white">{w.reference}</td>
                    <td>{w.user.fullName}<div className="text-xs text-white/50"><span className="font-mono text-gold-300">{w.user.memberId}</span> · {w.user.email}</div></td>
                    <td className="whitespace-nowrap">{money(w.amount)}</td>
                    <td className="whitespace-nowrap text-white/60">{money(w.fee)}</td>
                    <td className="whitespace-nowrap font-medium text-white">{Number(w.net).toFixed(2)}</td>
                    <td>
                      <div className="text-[11px] text-white/45">{NETWORK}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="break-all font-mono text-xs text-white/85">{w.address}</span>
                        <CopyButton text={w.address} />
                      </div>
                      {recent && <div className="mt-1 text-[11px] font-semibold text-amber-300">⚠ Address recently changed ({fmtDate(w.user.walletChangedAt, true)})</div>}
                    </td>
                    <td>
                      <StatusPill value={w.status} />
                      {w.reviewedBy && <div className="text-[11px] text-white/45">by {w.reviewedBy}</div>}
                      {w.rejectReason && <div className="mt-1 max-w-[200px] whitespace-normal text-[11px] text-red-300/80">{w.rejectReason}</div>}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {fmtDate(w.createdAt, true)}
                      {w.completedAt && <div className="text-white/50">Paid {fmtDate(w.completedAt, true)}</div>}
                      {w.txHash && (
                        <a className="mt-1 block font-mono text-gold-300 underline-offset-2 hover:underline" href={`https://bscscan.com/tx/${w.txHash}`} target="_blank" rel="noopener noreferrer" title={w.txHash}>
                          {short(w.txHash)} ↗
                        </a>
                      )}
                    </td>
                    <td className="space-y-2 whitespace-nowrap">
                      {w.status === "PENDING" && <div><button className="btn-outline btn-sm" onClick={() => markProcessing(w)}>Mark processing</button></div>}
                      {(w.status === "PENDING" || w.status === "PROCESSING") && (
                        <>
                          <div><button className="btn-lux btn-sm" onClick={() => open(w, "complete")}>Complete payout</button></div>
                          <div><button className="btn-outline btn-sm" onClick={() => open(w, "reject")}>Reject</button></div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!complete} onClose={() => setComplete(null)} title={`Complete payout ${complete?.reference ?? ""}`}>
        {complete && (
          <form onSubmit={doComplete} className="space-y-4">
            <div className="rounded-xl border border-gold-400/40 bg-gold-400/[0.06] p-4 text-sm">
              <div className="text-white">{complete.user.fullName} <span className="font-mono text-xs text-gold-300">{complete.user.memberId}</span></div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div><div className="text-[11px] uppercase tracking-wider text-white/45">Requested</div><div className="text-white">{money(complete.amount)}</div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-white/45">Fee</div><div className="text-white/70">{money(complete.fee)}</div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-white/45">Send exactly</div><div className="font-serif text-2xl text-gold-grad">{Number(complete.net).toFixed(2)} USDT</div></div>
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-wider text-white/45">To ({NETWORK})</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="break-all font-mono text-base text-white">{complete.address}</span>
                <CopyButton text={complete.address} />
              </div>
              {complete.user.walletChangedAt && now - new Date(complete.user.walletChangedAt).getTime() < RECENT_MS && (
                <div className="mt-2 text-xs font-semibold text-amber-300">⚠ Address recently changed ({fmtDate(complete.user.walletChangedAt, true)}). Verify with the member before paying.</div>
              )}
            </div>
            <Alert kind="warning">Only complete this after the USDT transfer has actually been sent. Do not mark it completed in advance.</Alert>
            <Field label="BEP20 transaction hash" hint="0x followed by 64 hex characters.">
              <input className="input font-mono" required placeholder="0x…" value={form.txHash} onChange={(e) => setForm({ ...form, txHash: e.target.value })} />
              {form.txHash.trim() && !txOk && <span className="mt-1 block text-xs text-red-300">Not a valid transaction hash.</span>}
              {txOk && <a className="mt-1 block text-xs text-gold-300 hover:underline" href={`https://bscscan.com/tx/${form.txHash.trim()}`} target="_blank" rel="noopener noreferrer">Check on BscScan ↗</a>}
            </Field>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-white/80">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#e2b04a]" checked={form.confirmPaid} onChange={(e) => setForm({ ...form, confirmPaid: e.target.checked })} />
              <span>I confirm the USDT transfer has been broadcast and paid.</span>
            </label>
            <Field label="Your password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            {err && <Alert>{err}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setComplete(null)}>Cancel</button>
              <button className="btn-lux" disabled={busy || !txOk || !form.confirmPaid}>{busy ? "Saving…" : "Mark completed"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!reject} onClose={() => setReject(null)} title={`Reject ${reject?.reference ?? ""}`}>
        {reject && (
          <form onSubmit={doReject} className="space-y-4">
            <Alert kind="warning">
              Rejecting returns the reserved {money(reject.amount)} to {reject.user.fullName}&apos;s available income balance. The member is notified by email and in-app with your reason.
            </Alert>
            <Field label="Reason" hint="Minimum 5 characters. Shown to the member.">
              <textarea className="input" rows={3} required minLength={5} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <Field label="Your password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            {err && <Alert>{err}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setReject(null)}>Cancel</button>
              <button className="btn-navy" disabled={busy}>{busy ? "Rejecting…" : "Reject withdrawal"}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
