"use client";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, PageHeader, Spinner, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/api";

type Stats = {
  stats: { members: number; active: number; pendingVerification: number; newEnquiries: number; openTickets: number; enrollments: number; packages: number };
  recentEnquiries: { id: string; reference: string; type: string; name: string; email: string; status: string; createdAt: string; package: { name: string } | null }[];
};

export default function AdminOverview() {
  const { data, error, loading } = useApi<Stats>("/admin/stats");
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
      <div className="card mt-8 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl text-navy-950">Recent enquiries</h2>
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
                    <td>{e.name}<div className="text-xs text-slate-500">{e.email}</div></td>
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
