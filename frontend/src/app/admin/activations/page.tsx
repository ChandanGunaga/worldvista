"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";

type Activation = {
  id: string; receiptNo: string; kind: "TOUR" | "COURSE"; itemName: string; travellers: number; unitPrice: string; serviceCharge: string; total: string;
  status: "PENDING_APPROVAL" | "ACTIVE" | "CANCELLED"; cancelReason: string | null; createdAt: string;
  user: { memberId: string; fullName: string; email: string };
  enquiry: { reference: string; preferredDate: string | null; message: string } | null;
};
const STATUSES = [
  { v: "PENDING_APPROVAL", l: "Pending approval" },
  { v: "ACTIVE", l: "Active" },
  { v: "CANCELLED", l: "Cancelled" },
];

export default function ActivationsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("PENDING_APPROVAL");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("q", search);
  const { data, error, loading, reload } = useApi<{ activations: Activation[] }>(`/admin/activations?${params}`);

  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [cancel, setCancel] = useState<Activation | null>(null);
  const [form, setForm] = useState({ reason: "", refund: true, password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const approve = async (a: Activation) => {
    const prompt = a.kind === "TOUR"
      ? `Approve ${a.receiptNo}? Confirm the travel dates${a.enquiry?.preferredDate ? ` (preferred ${fmtDate(a.enquiry.preferredDate)})` : ""} and availability with the supplier first.`
      : `Approve ${a.receiptNo} and activate ${a.itemName} for ${a.user.fullName}?`;
    if (!window.confirm(prompt)) return;
    setMsg(null);
    try {
      await api(`/admin/activations/${a.id}/review`, { method: "POST", json: { action: "approve" } });
      setMsg({ kind: "success", text: `${a.receiptNo} approved. ${a.user.fullName} has been notified.` });
      reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const doCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancel) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/activations/${cancel.id}/review`, { method: "POST", json: { action: "cancel", reason: form.reason, refund: form.refund, password: form.password } });
      setMsg({ kind: "success", text: `${cancel.receiptNo} cancelled${form.refund ? ` and ${money(cancel.total)} returned to the member's USD credit balance` : ""}.` });
      setCancel(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Package Activations"
        subtitle="Tour and course packages members activated with USD Package Credit."
        action={<a className="btn-outline btn-sm" href="/api/admin/reports/activations.csv">Download CSV</a>}
      />
      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className="input max-w-xs" placeholder="Receipt no, Member ID or item" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input max-w-[190px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <button className="btn-navy">Search</button>
      </form>

      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {loading && !data ? <Spinner /> : !data?.activations.length ? <Empty>No activations match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Receipt</th><th>Member</th><th>Item</th><th>Travellers</th><th>Total</th><th>Status</th><th>Preferred date</th><th /></tr></thead>
            <tbody>
              {data.activations.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs text-white">{a.receiptNo}<div className="text-white/45">{fmtDate(a.createdAt, true)}</div></td>
                  <td>{a.user.fullName}<div className="text-xs text-white/50"><span className="font-mono text-gold-300">{a.user.memberId}</span> · {a.user.email}</div></td>
                  <td className="max-w-xs">
                    <span className="chip mr-2">{a.kind === "TOUR" ? "Tour" : "Course"}</span>{a.itemName}
                    {a.enquiry && <div className="mt-1 text-xs text-white/45">Enquiry {a.enquiry.reference}{a.enquiry.message ? ` · ${a.enquiry.message}` : ""}</div>}
                    {a.cancelReason && <div className="mt-1 text-xs text-red-300/80">Cancelled: {a.cancelReason}</div>}
                  </td>
                  <td>{a.kind === "TOUR" ? a.travellers : "—"}</td>
                  <td className="whitespace-nowrap">
                    <span className="font-medium text-white">{money(a.total)}</span>
                    <div className="text-xs text-white/45">{Number(a.serviceCharge) ? `(${money(a.unitPrice)} + ${money(a.serviceCharge)} svc)` : money(a.unitPrice)}{a.kind === "TOUR" ? ` × ${a.travellers}` : ""}</div>
                  </td>
                  <td><Badge value={a.status} /></td>
                  <td className="whitespace-nowrap">{a.enquiry?.preferredDate ? fmtDate(a.enquiry.preferredDate) : "—"}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    {a.status === "PENDING_APPROVAL" && <button className="btn-lux btn-sm" onClick={() => approve(a)}>Approve</button>}
                    {a.status !== "CANCELLED" && (
                      <button className="btn-outline btn-sm" onClick={() => { setCancel(a); setForm({ reason: "", refund: true, password: "" }); setErr(""); }}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-6 text-xs text-white/45">Tour bookings should only be approved once travel dates and availability are confirmed with the supplier. Course activations can be approved immediately.</p>

      <Modal open={!!cancel} onClose={() => setCancel(null)} title={`Cancel ${cancel?.receiptNo ?? ""}`}>
        {cancel && (
          <form onSubmit={doCancel} className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="text-white">{cancel.itemName}</div>
              <div className="text-xs text-white/50">{cancel.user.fullName} · {cancel.user.memberId} · {money(cancel.total)}</div>
            </div>
            <Field label="Reason" hint="Minimum 5 characters. Shared with the member.">
              <textarea className="input" rows={3} required minLength={5} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <label className="flex items-start gap-2 text-sm text-white/80">
              <input type="checkbox" className="mt-1" checked={form.refund} onChange={(e) => setForm({ ...form, refund: e.target.checked })} />
              <span>Refund {money(cancel.total)} to the member&apos;s USD Package Credit balance</span>
            </label>
            <Field label="Your password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            {err && <Alert>{err}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setCancel(null)}>Keep activation</button>
              <button className="btn-navy" disabled={busy}>{busy ? "Cancelling…" : "Cancel activation"}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
