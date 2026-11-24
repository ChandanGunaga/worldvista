"use client";
import Image from "next/image";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, PageHeader, SecNo, Spinner } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Booking = {
  id: string; reference: string; status: string; travellers: number | null; preferredDate: string | null; createdAt: string; message: string;
  package: { name: string; slug: string; imageUrl: string | null; nights: number; days: number } | null;
  activation: { id: string; receiptNo: string; status: string; total: string } | null;
  payments: { reference: string; publicToken: string; status: string; amount: string; currency: string }[];
};
type Payment = { id: string; reference: string; publicToken: string; description: string; amount: string; currency: string; status: string; paidAt: string | null; createdAt: string };

const STEPS = ["NEW", "CONTACTED", "CONFIRMED"];
const STEP_LABEL: Record<string, string> = { NEW: "Requested", CONTACTED: "In review", CONFIRMED: "Confirmed" };

export default function Bookings() {
  const { data, error, loading } = useApi<{ bookings: Booking[] }>("/member/bookings");
  const pays = useApi<{ payments: Payment[] }>("/member/payments");
  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  return (
    <>
      <PageHeader title="My Bookings" subtitle="Track your tour bookings, booking references, payments and receipts." action={<Link href="/dashboard/tours" className="btn-lux">Book a trip</Link>} />
      <SecNo n={1}>Tour bookings</SecNo>
      {!data?.bookings.length ? <Empty>No bookings yet. Explore our tour packages to plan your first journey.</Empty> : (
        <div className="space-y-4">
          {data.bookings.map((b) => {
            const step = STEPS.indexOf(b.status);
            const open = b.payments.find((p) => p.status === "CREATED" || p.status === "FAILED");
            return (
              <div key={b.id} className="lux-card grid gap-5 overflow-hidden p-0 md:grid-cols-[220px_1fr]">
                <div className="relative min-h-[140px] bg-onyx-950">
                  {b.package?.imageUrl && <Image src={b.package.imageUrl} alt="" fill className="object-cover opacity-80" sizes="220px" unoptimized={b.package.imageUrl.startsWith("/uploads/")} />}
                </div>
                <div className="p-5 pr-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs tracking-wider text-gold-300">{b.reference}</div>
                      <h3 className="font-serif text-2xl text-white">{b.package?.name ?? "Tour"}</h3>
                      <div className="text-sm text-white/50">{b.travellers ?? "—"} traveller(s) · Departure {fmtDate(b.preferredDate)} · Requested {fmtDate(b.createdAt)}</div>
                    </div>
                    <Badge value={b.status} />
                  </div>
                  {step >= 0 && (
                    <div className="mt-4 flex items-center gap-2">
                      {STEPS.map((s, i) => (
                        <div key={s} className="flex flex-1 items-center gap-2">
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i <= step ? "bg-gold-grad text-onyx-950" : "border border-white/15 text-white/35"}`}>{i + 1}</span>
                          <span className={`text-xs ${i <= step ? "text-white/80" : "text-white/35"}`}>{STEP_LABEL[s]}</span>
                          {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-gold-400/60" : "bg-white/10"}`} />}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {b.activation && <Link href={`/dashboard/receipts/${b.activation.id}`} className="btn-outline btn-sm">Receipt {b.activation.receiptNo} · {money(b.activation.total, "USD")}</Link>}
                    {open && <Link href={`/pay/${open.publicToken}`} className="btn-lux !px-4 !py-2 text-xs">Pay {money(open.amount, open.currency)}</Link>}
                    {b.package && <Link href={`/tours/${b.package.slug}`} target="_blank" className="btn-outline btn-sm">View itinerary</Link>}
                    <Link href="/dashboard/support" className="btn-outline btn-sm">Contact support</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!!pays.data?.payments.length && (
        <>
          <div className="mt-10"><SecNo n={2}>Payments</SecNo></div>
          <section className="card overflow-x-auto p-6">
            <table className="table-x">
              <thead><tr><th>Reference</th><th>For</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead>
              <tbody>
                {pays.data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.reference}</td><td>{p.description}</td><td>{money(p.amount, p.currency)}</td>
                    <td><Badge value={p.status} /></td><td>{fmtDate(p.paidAt ?? p.createdAt)}</td>
                    <td>{(p.status === "CREATED" || p.status === "FAILED") && <Link href={`/pay/${p.publicToken}`} className="btn-lux !px-4 !py-1.5 text-xs">Pay now</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
