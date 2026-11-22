"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type Enquiry = {
  id: string; reference: string; type: string; name: string; email: string; phone: string | null; travellers: number | null;
  preferredDate: string | null; message: string; status: string; adminNotes: string; createdAt: string;
  package: { name: string } | null; course: { title: string } | null; user: { memberId: string } | null;
};
const STATUSES = ["NEW", "CONTACTED", "CONFIRMED", "CANCELLED", "CLOSED"];
const PAGE_SIZE = 25;

export default function EnquiriesPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const { data, error, loading, reload } = useApi<{ total: number; enquiries: Enquiry[] }>(`/admin/enquiries?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const [edit, setEdit] = useState<Enquiry | null>(null);
  const [form, setForm] = useState({ status: "NEW", adminNotes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cfg = useApi<{ payments: boolean }>("/public/config");
  const [pay, setPay] = useState({ amount: "", currency: "USD", description: "", expiresInDays: "7" });
  const [payMsg, setPayMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [link, setLink] = useState("");

  const createLink = async () => {
    if (!edit) return;
    setPayMsg(null);
    try {
      const r = await api<{ reference: string; url: string }>(`/admin/enquiries/${edit.id}/payment`, { method: "POST", json: pay });
      setLink(r.url);
      setPayMsg({ kind: "success", text: `Payment link ${r.reference} created and sent to ${edit.email}.` });
      reload();
    } catch (e) {
      setPayMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const open = (e: Enquiry) => {
    setEdit(e);
    setPay({ amount: "", currency: "USD", description: e.package ? `${e.package.name} tour booking` : e.course ? e.course.title : "World Vista booking", expiresInDays: "7" });
    setPayMsg(null);
    setLink("");
    setForm({ status: e.status, adminNotes: e.adminNotes });
    setErr("");
  };
  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await api(`/admin/enquiries/${edit.id}`, { method: "PATCH", json: form });
      setEdit(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Enquiries" subtitle={data ? `${data.total} enquiries` : undefined} />
      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
        <input className="input max-w-xs" placeholder="Reference, name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input max-w-[170px]" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <select className="input max-w-[150px]" value={type} onChange={(e) => { setPage(1); setType(e.target.value); }} aria-label="Type">
          <option value="">All types</option>
          <option value="TOUR">Tour</option>
          <option value="COURSE">Course</option>
          <option value="GENERAL">General</option>
        </select>
        <button className="btn-navy">Search</button>
      </form>
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : !data?.enquiries.length ? <Empty>No enquiries match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Contact</th><th>Item</th><th>Details</th><th>Status</th><th>Received</th><th /></tr></thead>
            <tbody>
              {data.enquiries.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.reference}<div className="text-slate-500">{e.type.toLowerCase()}</div></td>
                  <td>{e.name}<div className="text-xs text-slate-500">{e.email}{e.phone ? ` · ${e.phone}` : ""}</div>{e.user && <div className="font-mono text-xs text-navy-700">{e.user.memberId}</div>}</td>
                  <td>{e.package?.name ?? e.course?.title ?? "—"}</td>
                  <td className="text-xs text-slate-600">
                    {e.travellers ? `${e.travellers} traveller(s)` : ""}{e.preferredDate ? ` · ${fmtDate(e.preferredDate)}` : ""}
                    {e.message && <div className="mt-1 line-clamp-2 max-w-xs">{e.message}</div>}
                  </td>
                  <td><Badge value={e.status} /></td>
                  <td className="whitespace-nowrap">{fmtDate(e.createdAt, true)}</td>
                  <td><button className="btn-outline btn-sm" onClick={() => open(e)}>Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Enquiry ${edit?.reference ?? ""}`}>
        {edit && (
          <form onSubmit={save} className="space-y-4">
            <div className="rounded-xl bg-cream p-4 text-sm">
              <div className="font-medium">{edit.name} · {edit.email}{edit.phone ? ` · ${edit.phone}` : ""}</div>
              <div className="text-slate-600">{edit.package?.name ?? edit.course?.title ?? "General enquiry"}{edit.travellers ? ` · ${edit.travellers} traveller(s)` : ""}{edit.preferredDate ? ` · preferred ${fmtDate(edit.preferredDate)}` : ""}</div>
              {edit.message && <p className="mt-2 whitespace-pre-wrap text-slate-700">{edit.message}</p>}
            </div>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
              </select>
            </Field>
            <Field label="Internal notes">
              <textarea className="input" rows={5} value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} />
            </Field>
            {err && <Alert>{err}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h3 className="font-sans font-semibold text-navy-950">Send a payment link</h3>
              {!cfg.data?.payments ? (
                <p className="mt-2 text-sm text-slate-500">Online payments are off. Add the Razorpay keys to the backend settings to enable them.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-slate-500">Enter the final confirmed amount (package price + service charges). The customer receives the link by email{edit.phone ? " and WhatsApp" : ""}; the enquiry is confirmed automatically once paid.</p>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="Amount" className="sm:col-span-1"><input className="input" type="number" min="1" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
                    <Field label="Currency"><select className="input" value={pay.currency} onChange={(e) => setPay({ ...pay, currency: e.target.value })}><option>USD</option><option>INR</option></select></Field>
                    <Field label="Valid (days)"><input className="input" type="number" min="1" max="30" value={pay.expiresInDays} onChange={(e) => setPay({ ...pay, expiresInDays: e.target.value })} /></Field>
                  </div>
                  <Field label="Description"><input className="input" value={pay.description} onChange={(e) => setPay({ ...pay, description: e.target.value })} /></Field>
                  {payMsg && <Alert kind={payMsg.kind}>{payMsg.text}</Alert>}
                  {link && <div className="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs">{link}</div>}
                  <button type="button" className="btn-gold btn-sm" disabled={!pay.amount} onClick={createLink}>Create & send link</button>
                </div>
              )}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
