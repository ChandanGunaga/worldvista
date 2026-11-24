"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Field, Modal, Spinner } from "@/components/ui";
import { api, money } from "@/lib/api";

type Quote = { itemName: string; travellers: number; unitPrice: string; serviceCharge: string; total: string; available: string; sufficient: boolean; needsReview: boolean; currency: string };
export type ActivateTarget = { kind: "TOUR" | "COURSE"; id: string; name: string };

/**
 * Activate Package with USD Package Credit (spec §25 member workflow):
 * shows price, service charges, available credit and amount to deduct, then
 * requires explicit confirmation. A per-dialog idempotency key makes retries safe.
 */
export function ActivateModal({ target, onClose, onDone }: { target: ActivateTarget | null; onClose: () => void; onDone?: () => void }) {
  const [travellers, setTravellers] = useState(1);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; receiptNo: string; status: string } | null>(null);

  useEffect(() => {
    if (!target) return;
    setTravellers(1); setDate(""); setNote(""); setAgree(false); setReceipt(null); setErr("");
    setKey(crypto.randomUUID());
  }, [target]);

  useEffect(() => {
    if (!target) return;
    setQ(null);
    api<Quote>("/member/activations/quote", { method: "POST", json: { kind: target.kind, itemId: target.id, travellers } })
      .then(setQ)
      .catch((e) => setErr((e as Error).message));
  }, [target, travellers]);

  async function confirm() {
    if (!target || !q) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ activation: { id: string; receiptNo: string; status: string } }>("/member/activations", {
        method: "POST",
        json: { kind: target.kind, itemId: target.id, travellers, preferredDate: date || undefined, message: note || undefined, expectedTotal: q.total, idempotencyKey: key, confirm: true },
      });
      setReceipt(r.activation);
      onDone?.();
    } catch (e) {
      setErr((e as Error).message);
      // Price changed: refresh the quote so the member can review and confirm again
      if ((e as Error).message.includes("price changed")) {
        api<Quote>("/member/activations/quote", { method: "POST", json: { kind: target.kind, itemId: target.id, travellers } }).then(setQ).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div className={`flex justify-between py-2 text-sm ${strong ? "border-t border-gold-400/30 pt-3 text-base font-semibold text-white" : "text-white/70"}`}><span>{k}</span><span>{v}</span></div>
  );

  return (
    <Modal open={!!target} onClose={onClose} title={receipt ? "Package activated" : `Activate: ${target?.name ?? ""}`}>
      {receipt ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-grad text-2xl text-onyx-950">✓</div>
          <p className="text-white/80">Receipt <span className="font-mono text-gold-300">{receipt.receiptNo}</span></p>
          <p className="text-sm text-white/55">
            {receipt.status === "ACTIVE" ? "Your package is active." : "Paid in full. Our travel team will confirm your dates and hotels, then mark the booking confirmed."}
          </p>
          <div className="flex justify-center gap-2">
            <Link href={`/dashboard/receipts/${receipt.id}`} className="btn-lux">View receipt</Link>
            <button type="button" className="btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {target?.kind === "TOUR" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Travellers"><input className="input" type="number" min={1} max={20} value={travellers} onChange={(e) => setTravellers(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></Field>
              <Field label="Preferred departure" className="sm:col-span-2"><input className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Notes for our travel team" className="sm:col-span-3"><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
          )}
          {!q && !err ? <Spinner /> : q && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
              <Line k={`Package price${q.travellers > 1 ? ` × ${q.travellers}` : ""}`} v={money(Number(q.unitPrice) * q.travellers, "USD")} />
              <Line k={`Service charges${q.travellers > 1 ? ` × ${q.travellers}` : ""}`} v={money(Number(q.serviceCharge) * q.travellers, "USD")} />
              <Line k="Amount to be deducted" v={money(q.total, "USD")} strong />
              <Line k="Your available USD credit" v={money(q.available, "USD")} />
              <Line k="Balance after activation" v={money(Math.max(0, Number(q.available) - Number(q.total)), "USD")} />
            </div>
          )}
          {q && !q.sufficient && <Alert kind="warning">Your USD Package Credit balance is not enough for this package. You can still send a booking request and pay by payment link instead.</Alert>}
          {q?.needsReview && <p className="text-xs text-white/45">Tour bookings show as “Pending approval” until our team confirms dates, hotels and availability. If we can’t confirm, the credit is returned to your balance.</p>}
          <label className="flex items-start gap-3 text-sm text-white/70">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-gold-400" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I confirm this package and all charges shown. I understand USD Package Credit is not cash and cannot be withdrawn, and that cancellations follow the <Link href="/legal/refund-policy" target="_blank" className="text-gold-300 underline">refund policy</Link>.</span>
          </label>
          {err && <Alert>{err}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-lux" disabled={!q || !q.sufficient || !agree || busy} onClick={confirm}>{busy ? "Activating…" : `Confirm & pay ${q ? money(q.total, "USD") : ""}`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
