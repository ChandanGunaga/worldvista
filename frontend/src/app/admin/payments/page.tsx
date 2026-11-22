"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, CopyButton, Empty, PageHeader, Spinner, StatCard } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";

type Payment = {
  id: string; reference: string; purpose: string; payerName: string; payerEmail: string; description: string;
  amount: string; currency: string; status: string; providerPaymentId: string | null; paidAt: string | null; createdAt: string;
  expiresAt: string | null; url: string; enquiry: { reference: string } | null;
};
const STATUSES = ["CREATED", "PAID", "FAILED", "CANCELLED", "REFUNDED"];
const PAGE_SIZE = 25;

export default function PaymentsPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) params.set("status", status);
  if (search) params.set("q", search);
  const { data, error, loading, reload } = useApi<{ total: number; payments: Payment[]; totals: { currency: string; _sum: { amount: string | null }; _count: number }[] }>(`/admin/payments?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const [err, setErr] = useState("");

  async function cancel(p: Payment) {
    const reason = window.prompt(`Cancel unpaid link ${p.reference}? Enter a reason:`);
    if (!reason) return;
    setErr("");
    try {
      await api(`/admin/payments/${p.id}/cancel`, { method: "POST", json: { reason } });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle="Customer payments for tour bookings and course fees, processed by Razorpay." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {data?.totals.length ? data.totals.map((t) => (
          <StatCard key={t.currency} label={`Collected (${t.currency})`} value={money(t._sum.amount ?? 0, t.currency)} hint={`${t._count} paid`} />
        )) : <StatCard label="Collected" value="—" hint="No paid payments yet" />}
      </div>
      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
        <input className="input max-w-xs" placeholder="Reference, name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input max-w-[170px]" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <button className="btn-navy">Search</button>
      </form>
      {(error || err) && <div className="mb-4"><Alert>{error || err}</Alert></div>}
      {loading && !data ? <Spinner /> : !data?.payments.length ? <Empty>No payments yet. Create a payment link from an enquiry.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Payer</th><th>For</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.reference}{p.enquiry && <div className="text-slate-500">{p.enquiry.reference}</div>}{p.providerPaymentId && <div className="text-slate-500">{p.providerPaymentId}</div>}</td>
                  <td>{p.payerName}<div className="text-xs text-slate-500">{p.payerEmail}</div></td>
                  <td className="max-w-xs">{p.description}<div className="text-xs text-slate-500">{p.purpose.replace("_", " ").toLowerCase()}</div></td>
                  <td className="whitespace-nowrap font-medium">{money(p.amount, p.currency)}</td>
                  <td><Badge value={p.status} /></td>
                  <td className="whitespace-nowrap text-xs">{p.paidAt ? `Paid ${fmtDate(p.paidAt, true)}` : `Created ${fmtDate(p.createdAt)}`}{!p.paidAt && p.expiresAt && <div className="text-slate-500">Expires {fmtDate(p.expiresAt)}</div>}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    {(p.status === "CREATED" || p.status === "FAILED") && <><CopyButton text={p.url} /><button className="btn-outline btn-sm" onClick={() => cancel(p)}>Cancel</button></>}
                  </td>
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
      <p className="mt-6 text-xs text-slate-500">Refunds are issued from the Razorpay dashboard. Paid status is confirmed by signature verification and the Razorpay webhook.</p>
    </>
  );
}
