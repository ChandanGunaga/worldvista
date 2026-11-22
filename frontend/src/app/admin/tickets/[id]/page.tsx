"use client";
import Link from "next/link";
import clsx from "clsx";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Field, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type Ticket = {
  id: string; reference: string; subject: string; category: string; status: string; createdAt: string;
  user: { memberId: string; fullName: string; email: string };
  messages: { id: string; body: string; attachmentUrl: string | null; isStaff: boolean; createdAt: string; author: { fullName: string } }[];
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<{ ticket: Ticket }>(`/admin/tickets/${id}`);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("IN_PROGRESS");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (data) setStatus(data.ticket.status === "OPEN" ? "IN_PROGRESS" : data.ticket.status);
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const t = data.ticket;

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/tickets/${t.id}/reply`, { method: "POST", json: { body, status } });
      setBody("");
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/admin/tickets" className="text-sm text-navy-700 hover:underline">← All tickets</Link>
      <PageHeader title={t.subject} subtitle={`${t.reference} · ${t.category} · ${t.user.fullName} (${t.user.memberId}) · ${t.user.email}`} action={<Badge value={t.status} />} />
      <div className="space-y-3">
        {t.messages.map((m) => (
          <div key={m.id} className={clsx("card max-w-3xl p-4", m.isStaff ? "ml-auto border-gold-300 bg-gold-50" : "")}>
            <div className="mb-1 flex justify-between gap-4 text-xs text-slate-500">
              <span className="font-semibold text-navy-900">{m.author.fullName}{m.isStaff ? " · Staff" : ""}</span>
              <span>{fmtDate(m.createdAt, true)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{m.body}</p>
            {m.attachmentUrl && (
              <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-xs text-navy-700 underline">Attachment ↗</a>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={reply} className="card mt-6 max-w-3xl space-y-4 p-5">
        <Field label="Reply to member">
          <textarea className="input" rows={5} required value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="Set status">
            <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
              {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
            </select>
          </Field>
          <button className="btn-navy" disabled={busy}>{busy ? "Sending…" : "Send reply"}</button>
        </div>
        {err && <Alert>{err}</Alert>}
      </form>
    </>
  );
}
