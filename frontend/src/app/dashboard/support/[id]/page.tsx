"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { useApi } from "@/components/useApi";
import { Alert, Badge, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type Ticket = {
  id: string; reference: string; subject: string; category: string; status: string;
  messages: { id: string; body: string; attachmentUrl: string | null; isStaff: boolean; createdAt: string; author: { fullName: string } }[];
};

export default function TicketView() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApi<{ ticket: Ticket }>(`/member/tickets/${id}`);
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");

  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const t = data.ticket;

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api(`/member/tickets/${id}/messages`, { method: "POST", json: { body } });
      setBody("");
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <Link href="/dashboard/support" className="text-sm text-navy-700 underline">← All tickets</Link>
      <div className="mt-3"><PageHeader title={t.subject} subtitle={`${t.reference} · ${t.category}`} action={<Badge value={t.status} />} /></div>
      <div className="space-y-4">
        {t.messages.map((m) => (
          <div key={m.id} className={clsx("card p-5", m.isStaff && "border-l-4 border-l-gold-500")}>
            <div className="mb-2 flex justify-between text-xs text-slate-500"><span className="font-semibold text-navy-950">{m.isStaff ? `World Vista Support (${m.author.fullName})` : "You"}</span><span>{fmtDate(m.createdAt, true)}</span></div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
            {m.attachmentUrl && <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-navy-700 underline">Attachment ↗</a>}
          </div>
        ))}
      </div>
      {t.status !== "CLOSED" && (
        <form onSubmit={reply} className="card mt-6 space-y-3 p-5">
          <textarea className="input min-h-24" required placeholder="Write a reply…" value={body} onChange={(e) => setBody(e.target.value)} />
          <Alert>{err}</Alert>
          <button className="btn-navy">Send reply</button>
        </form>
      )}
    </>
  );
}
