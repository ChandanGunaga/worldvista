"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, CopyButton, Empty, Field, Modal, PageHeader, SecNo, Spinner, StatCard } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";

type Summary = { available: string; pendingWithdrawals: string; paid: string; walletAddress: string | null; securityHoldUntil: string | null; withdrawal: { feePct: number; min: number; max: number; holdHours: number; enabled: boolean } };
type W = { id: string; reference: string; amount: string; fee: string; net: string; address: string; status: string; txHash: string | null; rejectReason: string | null; createdAt: string; completedAt: string | null };
const BEP20 = /^0x[a-fA-F0-9]{40}$/;
const NETWORK = "USDT – BNB Smart Chain (BEP20)";

export default function Withdrawals() {
  const inc = useApi<{ summary: Summary; engineEnabled: boolean }>("/member/income");
  const list = useApi<{ withdrawals: W[] }>("/member/withdrawals");
  const [amount, setAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAddr, setConfirmAddr] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // address change
  const [addrOpen, setAddrOpen] = useState(false);
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [addr, setAddr] = useState("");
  const [addrPw, setAddrPw] = useState("");
  const [code, setCode] = useState("");
  const [addrMsg, setAddrMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);

  if (inc.loading && !inc.data) return <Spinner />;
  if (inc.error || !inc.data) return <Alert>{inc.error}</Alert>;
  const s = inc.data.summary;
  const cfg = s.withdrawal;
  const amt = Number(amount) || 0;
  const fee = Math.round(amt * cfg.feePct) / 100;
  const net = Math.max(0, amt - fee);
  const canWithdraw = inc.data.engineEnabled && cfg.enabled && !!s.walletAddress && !s.securityHoldUntil;
  const amountOk = amt >= cfg.min && amt <= cfg.max && amt <= Number(s.available);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ withdrawal: { reference: string } }>("/member/withdrawals", { method: "POST", json: { amount: amt, confirmAddress: confirmAddr, password: pw } });
      setMsg({ kind: "success", text: `Request ${r.withdrawal.reference} submitted. Status: Pending until our team sends the payout.` });
      setConfirmOpen(false); setAmount(""); setPw(""); setConfirmAddr("");
      inc.reload(); list.reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    setAddrMsg(null);
    try {
      const r = await api<{ message: string }>("/member/wallet/request", { method: "POST", json: { address: addr.trim(), password: addrPw } });
      setStep("code");
      setAddrMsg({ kind: "info", text: r.message });
    } catch (e) { setAddrMsg({ kind: "error", text: (e as Error).message }); }
  }
  async function confirmCode() {
    setAddrMsg(null);
    try {
      await api("/member/wallet/confirm", { method: "POST", json: { address: addr.trim(), code } });
      setAddrMsg({ kind: "success", text: `Address saved. Withdrawals are paused for ${cfg.holdHours} hours for your security.` });
      inc.reload();
      setTimeout(() => { setAddrOpen(false); setStep("enter"); setAddr(""); setAddrPw(""); setCode(""); setAddrMsg(null); }, 1800);
    } catch (e) { setAddrMsg({ kind: "error", text: (e as Error).message }); }
  }

  return (
    <>
      <PageHeader title="Withdrawals" subtitle="Withdraw your available income balance in USDT on BNB Smart Chain (BEP20)." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Available balance" value={money(s.available, "USD")} hint="USD / USDT equivalent" />
        <StatCard label="Pending" value={money(s.pendingWithdrawals, "USD")} hint="Reserved for open requests" />
        <StatCard label="Paid" value={money(s.paid, "USD")} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SecNo n={1}>New withdrawal</SecNo>
          <div className="lux-card-gold space-y-4 p-6">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              <span className="text-white/50">Network</span><span className="font-semibold text-gold-200">{NETWORK}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between text-xs text-white/50"><span>Saved address</span><button className="text-gold-300 underline" onClick={() => setAddrOpen(true)}>{s.walletAddress ? "Change" : "Add address"}</button></div>
              <div className="mt-1 break-all font-mono text-sm text-white">{s.walletAddress ?? "No address saved yet"}</div>
            </div>
            {s.securityHoldUntil && <Alert kind="warning">Security hold after address change: withdrawals open again at {fmtDate(s.securityHoldUntil, true)}.</Alert>}
            {!inc.data.engineEnabled || !cfg.enabled ? <Alert kind="info">Withdrawals are not open yet.</Alert> : null}
            <Field label={`Amount (USD) · min ${cfg.min}, max ${cfg.max}`}>
              <input className="input text-lg" type="number" min={cfg.min} max={cfg.max} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-white/60"><span>Fee ({cfg.feePct}%)</span><span>{money(fee, "USD")}</span></div>
              <div className="flex justify-between border-t border-gold-400/30 pt-2 text-base font-semibold text-white"><span>Estimated net (USDT)</span><span>{net.toFixed(2)}</span></div>
            </div>
            {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
            <button className="btn-lux w-full" disabled={!canWithdraw || !amountOk} onClick={() => { setConfirmOpen(true); setMsg(null); }}>Submit withdrawal</button>
            {amt > Number(s.available) && <p className="text-xs text-red-300">Amount is more than your available balance.</p>}
          </div>
        </div>
        <div>
          <SecNo n={2}>How it works</SecNo>
          <ol className="lux-card space-y-3 p-6 text-sm text-white/65">
            {["Enter the amount and confirm your saved BEP20 address.", "Your request shows as Pending and the amount is reserved.", "Our finance team sends the USDT payout and records the blockchain transaction hash.", "Status changes to Completed and you get a notification. If rejected, the amount returns to your balance."].map((t, i) => (
              <li key={t} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-grad text-[11px] font-bold text-onyx-950">{i + 1}</span>{t}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-white/40">Only send to a BNB Smart Chain (BEP20) address. Payouts sent to an address on another network may be lost.</p>
        </div>
      </div>

      <div className="mt-10"><SecNo n={3}>Withdrawal history</SecNo></div>
      <section className="card overflow-x-auto p-4 sm:p-6">
        {list.data?.withdrawals.length ? (
          <table className="table-x">
            <thead><tr><th>Reference</th><th className="text-right">Amount</th><th className="text-right">Fee</th><th className="text-right">Net USDT</th><th>Address</th><th>Status</th><th>Requested</th><th>Transaction</th></tr></thead>
            <tbody>
              {list.data.withdrawals.map((w) => (
                <tr key={w.id}>
                  <td className="font-mono text-xs">{w.reference}</td>
                  <td className="text-right">{money(w.amount, "USD")}</td><td className="text-right">{money(w.fee, "USD")}</td><td className="text-right text-gold-300">{Number(w.net).toFixed(2)}</td>
                  <td className="font-mono text-[11px]">{w.address.slice(0, 8)}…{w.address.slice(-6)}</td>
                  <td><Badge value={w.status} />{w.rejectReason && <div className="mt-1 max-w-[180px] text-xs text-red-300">{w.rejectReason}</div>}</td>
                  <td className="whitespace-nowrap">{fmtDate(w.createdAt, true)}</td>
                  <td>{w.txHash ? <a className="font-mono text-xs text-gold-300 underline" href={`https://bscscan.com/tx/${w.txHash}`} target="_blank" rel="noreferrer">{w.txHash.slice(0, 10)}…</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No withdrawals yet.</Empty>}
      </section>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm withdrawal">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="flex justify-between"><span className="text-white/50">Amount</span><span>{money(amt, "USD")}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Fee</span><span>{money(fee, "USD")}</span></div>
            <div className="flex justify-between font-semibold text-white"><span>You receive</span><span>{net.toFixed(2)} USDT</span></div>
            <div className="mt-2 text-white/50">Network: {NETWORK}</div>
            <div className="mt-1 break-all font-mono text-xs text-gold-200">{s.walletAddress}</div>
          </div>
          <Field label="Re-type or paste your saved address to confirm the destination">
            <input className="input font-mono text-xs" value={confirmAddr} onChange={(e) => setConfirmAddr(e.target.value)} placeholder="0x…" />
          </Field>
          <Field label="Your password"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
          {msg?.kind === "error" && <Alert>{msg.text}</Alert>}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="btn-lux" disabled={busy || confirmAddr.trim().toLowerCase() !== (s.walletAddress ?? "").toLowerCase() || !pw} onClick={submit}>{busy ? "Submitting…" : "Confirm & submit"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={addrOpen} onClose={() => setAddrOpen(false)} title={s.walletAddress ? "Change withdrawal address" : "Add withdrawal address"}>
        <div className="space-y-4">
          <Alert kind="warning">For your security, withdrawals are paused for {cfg.holdHours} hours after the address changes. We never ask for your private keys.</Alert>
          {step === "enter" ? (
            <>
              <Field label={`New address · ${NETWORK}`}>
                <input className="input font-mono text-xs" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x followed by 40 characters" />
              </Field>
              {addr && !BEP20.test(addr.trim()) && <p className="text-xs text-red-300">That doesn’t look like a BEP20 address (0x + 40 hex characters).</p>}
              <Field label="Your password"><input className="input" type="password" value={addrPw} onChange={(e) => setAddrPw(e.target.value)} autoComplete="current-password" /></Field>
              {addrMsg && <Alert kind={addrMsg.kind}>{addrMsg.text}</Alert>}
              <div className="flex justify-end"><button className="btn-lux" disabled={!BEP20.test(addr.trim()) || !addrPw} onClick={requestCode}>Email me a code</button></div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 break-all font-mono text-xs text-gold-200">{addr}<CopyButton text={addr} /></div>
              <Field label="6-digit code from your email"><input className="input text-center font-mono text-2xl tracking-[0.5em]" maxLength={6} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
              {addrMsg && <Alert kind={addrMsg.kind}>{addrMsg.text}</Alert>}
              <div className="flex justify-between">
                <button className="btn-outline btn-sm" onClick={() => { setStep("enter"); setAddrMsg(null); }}>← Back</button>
                <button className="btn-lux" disabled={code.length !== 6} onClick={confirmCode}>Confirm address</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
