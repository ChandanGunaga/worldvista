"use client";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, PageHeader, Spinner, StatCard } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Stats = {
  stats: { members: number; active: number; pendingVerification: number; newEnquiries: number; openTickets: number; enrollments: number; packages: number };
  recentEnquiries: { id: string; reference: string; type: string; name: string; email: string; status: string; createdAt: string; package: { name: string } | null }[];
};

type Extra = {
  creditLiability: string; pendingCredits: { count: number; amount: string }; pendingActivations: number;
  paymentsLast30: Record<string, string>; activationsLast30: { count: number; amount: string };
};

type CompSummary = { engineEnabled: boolean; incomeLiability: string; pendingWithdrawals: { count: number; amount: string }; pendingRankRewards: number };

function LinkTile({ href, label, value, hint }: { href: string; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Link href={href} className="stat-tile block transition hover:border-gold-400/40 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
        <span>{label}</span><span aria-hidden className="text-gold-300/70">→</span>
      </div>
      <div className="mt-2 font-serif text-3xl text-gold-grad">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
    </Link>
  );
}

export default function AdminOverview() {
  const { data, error, loading } = useApi<Stats>("/admin/stats");
  const extra = useApi<Extra>("/admin/stats/extra");
  const comp = useApi<CompSummary>("/admin/compensation/summary");
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const s = data.stats;
  return (
    <>
      <PageHeader title="Overview" subtitle="Operational snapshot of World Vista" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={s.members} hint={`${s.active} active · ${s.pendingVerification} unverified`} />
        <StatCard label="New enquiries" value={s.newEnquiries} hint="Awaiting first contact" />
        <StatCard label="Open tickets" value={s.openTickets} hint="Open or in progress" />
        <StatCard label="Enrolment requests" value={s.enrollments} hint={`${s.packages} active tour packages`} />
      </div>
      {extra.data && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <LinkTile href="/admin/credits" label="Credit liability" value={money(extra.data.creditLiability)} hint="Unspent USD Package Credit" />
          <LinkTile href="/admin/credits" label="Pending credits" value={extra.data.pendingCredits.count} hint={`${money(extra.data.pendingCredits.amount)} awaiting approval`} />
          <LinkTile href="/admin/activations" label="Pending activations" value={extra.data.pendingActivations} hint="Awaiting review" />
          <LinkTile href="/admin/payments" label="Payments · 30d" value={Object.keys(extra.data.paymentsLast30).length ? Object.entries(extra.data.paymentsLast30).map(([c, v]) => `${c} ${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`).join(" · ") : "0"} hint="Paid in last 30 days, per currency" />
          <LinkTile href="/admin/activations" label="Credit activations · 30d" value={money(extra.data.activationsLast30.amount)} hint={`${extra.data.activationsLast30.count} activation(s)`} />
        </div>
      )}
      {comp.data && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <LinkTile href="/admin/compensation" label="Commission engine" value={comp.data.engineEnabled ? "ON" : "OFF"} hint={comp.data.engineEnabled ? "Commissions are being calculated" : "No commissions calculated"} />
          <LinkTile href="/admin/compensation/ledger" label="Income liability" value={money(comp.data.incomeLiability)} hint="Owed to members: available + pending withdrawals" />
          <LinkTile href="/admin/withdrawals" label="Pending withdrawals" value={comp.data.pendingWithdrawals.count} hint={`${money(comp.data.pendingWithdrawals.amount)} pending or processing`} />
          <LinkTile href="/admin/ranks" label="Pending rank rewards" value={comp.data.pendingRankRewards} hint="Awaiting review" />
        </div>
      )}
      <div className="card mt-8 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl text-white">Recent enquiries</h2>
          <Link href="/admin/enquiries" className="btn-outline btn-sm">View all</Link>
        </div>
        {data.recentEnquiries.length === 0 ? (
          <Empty>No enquiries yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead><tr><th>Reference</th><th>Name</th><th>Item</th><th>Status</th><th>Received</th></tr></thead>
              <tbody>
                {data.recentEnquiries.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs">{e.reference}</td>
                    <td>{e.name}<div className="text-xs text-white/50">{e.email}</div></td>
                    <td>{e.package?.name ?? e.type.toLowerCase()}</td>
                    <td><Badge value={e.status} /></td>
                    <td className="whitespace-nowrap">{fmtDate(e.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
