"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { ActivateModal, type ActivateTarget } from "@/components/ActivateModal";
import { Alert, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, money } from "@/lib/api";
import type { TourPackage } from "@/lib/types";

type Pkg = TourPackage & { serviceCharge: string; creditEligible: boolean; itinerary: { day: number; title: string; details: string }[] };

export default function MemberTours() {
  const pk = useApi<{ packages: Pkg[] }>("/public/packages");
  const cat = useApi<{ balance: string; packages: { id: string; creditEligible: boolean }[] }>("/member/catalogue");
  const [book, setBook] = useState<Pkg | null>(null);
  const [itin, setItin] = useState<Pkg | null>(null);
  const [act, setAct] = useState<ActivateTarget | null>(null);
  const [f, setF] = useState({ travellers: "2", preferredDate: "", message: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const eligible = new Set(cat.data?.packages.filter((p) => p.creditEligible).map((p) => p.id));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!book) return;
    setBusy(true);
    try {
      const r = await api<{ booking: { reference: string } }>("/member/bookings", {
        method: "POST",
        json: { packageId: book.id, travellers: Number(f.travellers), preferredDate: f.preferredDate || undefined, message: f.message },
      });
      setMsg({ kind: "success", text: `Booking request ${r.booking.reference} sent. Track it under My Bookings.` });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tour Packages"
        subtitle="Curated destinations. Prices are per traveller; service charges are shown separately."
        action={cat.data && <div className="chip">USD credit {money(cat.data.balance, "USD")}</div>}
      />
      {pk.loading ? <Spinner /> : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {pk.data?.packages.map((p) => (
            <div key={p.id} className="lux-card lux-hover group overflow-hidden">
              <div className="relative aspect-[16/10] overflow-hidden rounded-t-3xl bg-onyx-950">
                {p.imageUrl && <Image src={p.imageUrl} unoptimized={p.imageUrl.startsWith("/uploads/")} alt={p.name} fill className="object-cover transition duration-700 group-hover:scale-110" sizes="33vw" />}
                <div className="absolute inset-0 bg-gradient-to-t from-onyx-900 via-transparent" />
                <span className="absolute left-4 top-4 chip !bg-onyx-950/70 backdrop-blur">{p.nights}N / {p.days}D</span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-2xl text-white">{p.name}</h3>
                  <div className="text-right">
                    <div className="font-serif text-2xl text-gold-grad">{money(p.price, p.currency)}</div>
                    <div className="text-[11px] text-white/45">{Number(p.serviceCharge) > 0 ? `+ ${money(p.serviceCharge, p.currency)} service charge` : p.chargeNote}</div>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-white/55">{p.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-lux !px-4 !py-2 text-xs" onClick={() => { setBook(p); setMsg(null); }}>Book Now</button>
                  {eligible.has(p.id) && <button className="btn-lux-outline !px-4 !py-2 text-xs" onClick={() => setAct({ kind: "TOUR", id: p.id, name: p.name })}>Pay with credit</button>}
                  <button className="btn-outline btn-sm" onClick={() => setItin(p)}>Itinerary</button>
                  <Link href={`/tours/${p.slug}`} target="_blank" className="btn-outline btn-sm">View package</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/bookings" className="btn-outline">My Bookings →</Link>
        <Link href="/dashboard/support" className="btn-outline">Contact Support</Link>
      </div>

      <Modal open={!!book} onClose={() => setBook(null)} title={`Book: ${book?.name ?? ""}`}>
        <form onSubmit={send} className="space-y-4">
          <p className="text-sm text-white/55">Send a booking request. Our travel team confirms availability, hotels and the final quote, then sends you a secure payment link.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Travellers"><input className="input" type="number" min={1} max={20} value={f.travellers} onChange={(e) => setF({ ...f, travellers: e.target.value })} /></Field>
            <Field label="Preferred departure"><input className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={f.preferredDate} onChange={(e) => setF({ ...f, preferredDate: e.target.value })} /></Field>
          </div>
          <Field label="Message (optional)"><textarea className="input min-h-24" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <div className="flex justify-end gap-2">
            {msg?.kind === "success" ? <Link href="/dashboard/bookings" className="btn-lux">Go to My Bookings</Link> : <button className="btn-lux" disabled={busy}>{busy ? "Sending…" : "Send booking request"}</button>}
          </div>
        </form>
      </Modal>

      <Modal open={!!itin} onClose={() => setItin(null)} title={`${itin?.name ?? ""} itinerary`}>
        {itin?.itinerary?.length ? (
          <ol className="relative space-y-5 border-l border-gold-400/30 pl-6">
            {itin.itinerary.map((d) => (
              <li key={d.day} className="relative">
                <span className="absolute -left-[37px] grid h-6 w-6 place-items-center rounded-full bg-gold-grad text-[11px] font-bold text-onyx-950">{d.day}</span>
                <div className="font-semibold text-white">Day {d.day}: {d.title}</div>
                {d.details && <p className="mt-1 text-sm text-white/60">{d.details}</p>}
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-white/50">The day-by-day itinerary will be shared with your booking confirmation.</p>}
        <p className="mt-6 text-xs text-white/40">Itineraries may change with flight times, weather and local conditions. Final plans are confirmed in writing.</p>
      </Modal>

      <ActivateModal target={act} onClose={() => setAct(null)} onDone={() => cat.reload()} />
    </>
  );
}
