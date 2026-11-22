"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type Ticket = { id: string; reference: string; subject: string; category: string; status: string; updatedAt: string };

export default function Support() {
  const { data, loading, reload } = useApi<{ tickets: Ticket[] }>("/member/tickets");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ subject: "", category: "Account", body: "", attachmentUrl: "" });
  const [err, setErr] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api("/member/tickets", { method: "POST", json: f });
      setOpen(false);
      setF({ subject: "", category: "Account", body: "", attachmentUrl: "" });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Support" subtitle="Raise a ticket and track replies from our team." action={<button className="btn-gold" onClick={() => setOpen(true)}>New ticket</button>} />
      {loading ? <Spinner /> : data?.tickets.length ? (
        <div className="card overflow-x-auto p-2">
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Subject</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {data.tickets.map((t) => (
                <tr key={t.id}><td className="font-mono text-xs"><Link href={`/dashboard/support/${t.id}`} className="text-navy-700 underline">{t.reference}</Link></td><td>{t.subject}</td><td>{t.category}</td><td><Badge value={t.status} /></td><td>{fmtDate(t.updatedAt, true)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No tickets yet.</Empty>}
      <Modal open={open} onClose={() => setOpen(false)} title="New support ticket">
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject"><input className="input" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
            <Field label="Category">
              <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {["Account", "Tourism", "Education", "Technical", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Describe the issue"><textarea className="input min-h-32" required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <Field label="Evidence link (optional)" hint="Link to a screenshot or document (e.g. Google Drive). Never share passwords or OTPs."><input className="input" type="url" value={f.attachmentUrl} onChange={(e) => setF({ ...f, attachmentUrl: e.target.value })} /></Field>
          <Alert>{err}</Alert>
          <button className="btn-navy">Submit ticket</button>
        </form>
      </Modal>
    </>
  );
}
