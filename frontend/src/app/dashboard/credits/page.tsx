"use client";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, PageHeader, SecNo, Spinner, StatCard } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Data = {
  summary: { available: string; pending: string; received: string; spent: string; refunded: string; reversed: string };
  credits: { id: string; reference: string; amount: string; status: string; createdAt: string; approvedAt: string | null; voidedAt: string | null }[];
  ledger: { id: string; txId: string; type: string; amount: string; balanceAfter: string; memo: string; createdAt: string; credit: { reference: string } | null; activation: { receiptNo: string; itemName: string } | null }[];
};
type Act = { id: string; receiptNo: string; itemName: string; total: string; status: string; createdAt: string; kind: string };

const TYPE_LABEL: Record<string, string> = {
  CREDIT_APPROVED: "Credit received",
  ACTIVATION_DEBIT: "Package activation",
  ACTIVATION_REFUND: "Refund",
  CREDIT_REVERSAL: "Credit reversed",
};

export default function Credits() {
  const { data, error, loading } = useApi<Data>("/member/credits");
  const acts = useApi<{ activations: Act[] }>("/member/activations");
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const s = data.summary;
  return (
    <>
      <PageHeader title="USD Package Credit" subtitle="Credit issued to you by World Vista for activating tour and course packages." action={<Link href="/dashboard/tours" className="btn-lux">Activate a package</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available" value={money(s.available, "USD")} hint="Ready to use" />
        <StatCard label="Pending" value={money(s.pending, "USD")} hint="Awaiting approval" />
        <StatCard label="Spent" value={money(s.spent, "USD")} hint={Number(s.refunded) ? `Net of ${money(s.refunded, "USD")} refunded` : "On packages"} />
        <StatCard label="Reversed" value={money(s.reversed, "USD")} hint="Voided or cancelled credit" />
      </div>
      <div className="mt-5 rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] px-5 py-4 text-sm text-gold-100/80">
        USD Package Credit can only be used to activate eligible World Vista tour and education packages. It is not cash, not an investment and not income:
        it can’t be withdrawn, transferred to another member or exchanged for USDT.
      </div>

      <div className="mt-10"><SecNo n={1}>Packages & receipts</SecNo></div>
      <section className="card overflow-x-auto p-6">
        {acts.data?.activations.length ? (
          <table className="table-x">
            <thead><tr><th>Receipt</th><th>Package</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead>
            <tbody>
              {acts.data.activations.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs text-gold-300">{a.receiptNo}</td><td>{a.itemName}<div className="text-xs text-white/40">{a.kind === "TOUR" ? "Tour" : "Course"}</div></td>
                  <td>{money(a.total, "USD")}</td><td><Badge value={a.status} /></td><td>{fmtDate(a.createdAt)}</td>
                  <td><Link href={`/dashboard/receipts/${a.id}`} className="btn-outline btn-sm">Receipt</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No packages activated with credit yet.</Empty>}
      </section>

      <div className="mt-10"><SecNo n={2}>Credit history</SecNo></div>
      <section className="card overflow-x-auto p-6">
        {data.credits.length ? (
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Issued</th><th>Approved / voided</th></tr></thead>
            <tbody>
              {data.credits.map((c) => (
                <tr key={c.id}><td className="font-mono text-xs">{c.reference}</td><td>{money(c.amount, "USD")}</td><td><Badge value={c.status} /></td><td>{fmtDate(c.createdAt)}</td><td>{fmtDate(c.approvedAt ?? c.voidedAt)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No credit has been issued to your account.</Empty>}
      </section>

      <div className="mt-10"><SecNo n={3}>Transactions</SecNo></div>
      <section className="card overflow-x-auto p-6">
        {data.ledger.length ? (
          <table className="table-x">
            <thead><tr><th>Transaction ID</th><th>Type</th><th>Details</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th>Date</th></tr></thead>
            <tbody>
              {data.ledger.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs">{l.txId}</td><td>{TYPE_LABEL[l.type] ?? l.type}</td>
                  <td className="text-xs text-white/55">{l.activation ? `${l.activation.itemName} · ${l.activation.receiptNo}` : l.credit?.reference ?? ""}</td>
                  <td className={`text-right font-mono ${Number(l.amount) < 0 ? "text-red-300" : "text-emerald-300"}`}>{Number(l.amount) > 0 ? "+" : ""}{Number(l.amount).toFixed(2)}</td>
                  <td className="text-right font-mono">{Number(l.balanceAfter).toFixed(2)}</td><td className="whitespace-nowrap">{fmtDate(l.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No transactions yet.</Empty>}
      </section>
    </>
  );
}
