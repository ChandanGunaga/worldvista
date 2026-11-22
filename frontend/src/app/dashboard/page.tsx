"use client";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Alert, Badge, PageHeader, Spinner, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/api";

type Overview = {
  memberId: string; fullName: string; status: string; joinedAt: string; sponsor: { memberId: string; fullName: string } | null;
  stats: { directs: number; leftTeam: number; rightTeam: number; enquiries: number; enrollments: number; openTickets: number };
  notifications: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[];
};

export default function Overview() {
  const { data, error, loading } = useApi<Overview>("/member/overview");
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  return (
    <>
      <PageHeader title={`Welcome, ${data.fullName.split(" ")[0]}`} subtitle={`Member ID ${data.memberId} · Joined ${fmtDate(data.joinedAt)}`} action={<Badge value={data.status} />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Direct referrals" value={data.stats.directs} />
        <StatCard label="Left team" value={data.stats.leftTeam} />
        <StatCard label="Right team" value={data.stats.rightTeam} />
        <StatCard label="Trip enquiries" value={data.stats.enquiries} />
        <StatCard label="Course enrolments" value={data.stats.enrollments} />
        <StatCard label="Open support tickets" value={data.stats.openTickets} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg text-navy-950">Quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard/tours" className="btn-gold btn-sm">Plan a trip</Link>
            <Link href="/dashboard/education" className="btn-outline btn-sm">Enrol in a course</Link>
            <Link href="/dashboard/referral" className="btn-outline btn-sm">Share referral link</Link>
            <Link href="/dashboard/support" className="btn-outline btn-sm">Get support</Link>
          </div>
          {data.sponsor && <p className="mt-6 text-sm text-slate-500">Your sponsor: <span className="font-medium text-slate-700">{data.sponsor.fullName} ({data.sponsor.memberId})</span></p>}
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg text-navy-950">Notices</h2><Link href="/dashboard/notifications" className="text-sm text-navy-700 underline">All</Link></div>
          <ul className="mt-4 space-y-3">
            {data.notifications.map((n) => (
              <li key={n.id} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="text-sm font-medium text-navy-950">{n.title}</div>
                <div className="text-sm text-slate-600">{n.body}</div>
                <div className="text-xs text-slate-400">{fmtDate(n.createdAt, true)}</div>
              </li>
            ))}
            {!data.notifications.length && <li className="text-sm text-slate-500">No notices yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
