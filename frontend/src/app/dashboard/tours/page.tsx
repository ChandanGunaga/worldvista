"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { useSession } from "@/components/session";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";
import type { TourPackage } from "@/lib/types";

type Enquiry = { id: string; reference: string; type: string; status: string; createdAt: string; preferredDate: string | null; travellers: number | null; package: { name: string } | null; course: { title: string } | null };

export default function MemberTours() {
  const { user } = useSession();
  const pk = useApi<{ packages: TourPackage[] }>("/public/packages");
  const enq = useApi<{ enquiries: Enquiry[] }>("/member/enquiries");
  const pays = useApi<{ payments: { id: string; reference: string; publicToken: string; description: string; amount: string; currency: string; status: string; paidAt: string | null; createdAt: string }[] }>("/member/payments");
  const [sel, setSel] = useState<TourPackage | null>(null);
  const [f, setF] = useState({ phone: "", travellers: "2", preferredDate: "", message: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!sel || !user) return;
    try {
      const r = await api<{ reference: string }>("/public/enquiries", {
        method: "POST",
        json: { type: "TOUR", packageId: sel.id, name: user.fullName, email: user.email, phone: f.phone || undefined, travellers: Number(f.travellers), preferredDate: f.preferredDate || undefined, message: f.message },
      });
      setMsg({ kind: "success", text: `Enquiry sent. Reference ${r.reference}.` });
      enq.reload();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader title="Tour Packages" subtitle="Six curated destinations. Prices exclude service charges." />
      {pk.loading ? <Spinner /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {pk.data?.packages.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="relative aspect-[16/9] bg-navy-900">{p.imageUrl && <Image src={p.imageUrl} unoptimized={p.imageUrl.startsWith("/uploads/")} alt={p.name} fill className="object-cover" sizes="33vw" />}</div>
              <div className="p-5">
                <div className="flex justify-between gap-2"><h3 className="text-xl text-navy-950">{p.name}</h3><div className="text-right font-bold">{money(p.price, p.currency)}<div className="text-[11px] font-normal text-slate-500">{p.chargeNote}</div></div></div>
                <div className="text-sm text-slate-600">{p.nights}N / {p.days}D · {p.tag ?? p.hotelCategory}</div>
                <div className="mt-4 flex gap-2">
                  <button className="btn-gold btn-sm" onClick={() => { setSel(p); setMsg(null); }}>Enquire</button>
                  <Link href={`/tours/${p.slug}`} target="_blank" className="btn-outline btn-sm">Details</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card mt-8 overflow-x-auto p-6">
        <h2 className="mb-4 text-lg text-navy-950">My enquiries & bookings</h2>
        {enq.data?.enquiries.length ? (
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Item</th><th>Travellers</th><th>Departure</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {enq.data.enquiries.map((e) => (
                <tr key={e.id}><td className="font-mono text-xs">{e.reference}</td><td>{e.package?.name ?? e.course?.title ?? "General"}</td><td>{e.travellers ?? "—"}</td><td>{fmtDate(e.preferredDate)}</td><td><Badge value={e.status} /></td><td>{fmtDate(e.createdAt)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No enquiries yet.</Empty>}
      </section>

      {!!pays.data?.payments.length && (
        <section className="card mt-8 overflow-x-auto p-6">
          <h2 className="mb-4 text-lg text-navy-950">My payments</h2>
          <table className="table-x">
            <thead><tr><th>Reference</th><th>For</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {pays.data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.reference}</td><td>{p.description}</td><td>{money(p.amount, p.currency)}</td>
                  <td><Badge value={p.status} /></td><td>{fmtDate(p.paidAt ?? p.createdAt)}</td>
                  <td>{(p.status === "CREATED" || p.status === "FAILED") && <Link href={`/pay/${p.publicToken}`} className="btn-gold btn-sm">Pay now</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} title={`Enquire: ${sel?.name ?? ""}`}>
        <form onSubmit={send} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Travellers"><input className="input" type="number" min={1} max={50} value={f.travellers} onChange={(e) => setF({ ...f, travellers: e.target.value })} /></Field>
            <Field label="Departure"><input className="input" type="date" value={f.preferredDate} onChange={(e) => setF({ ...f, preferredDate: e.target.value })} /></Field>
          </div>
          <Field label="Message"><textarea className="input min-h-24" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <button className="btn-gold">Send enquiry</button>
        </form>
      </Modal>
    </>
  );
}
