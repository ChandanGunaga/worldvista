"use client";
import Link from "next/link";
import { useApi } from "@/components/useApi";
import { Alert, Badge, SecNo, Spinner, StatCard } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Overview = {
  memberId: string; fullName: string; status: string; joinedAt: string; sponsor: { memberId: string; fullName: string } | null;
  stats: { directs: number; leftTeam: number; rightTeam: number; enquiries: number; enrollments: number; openTickets: number };
  notifications: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[];
};
type Classes = { courses: { title: string; status: string; sessions: { id: string; title: string; startsAt: string; liveUrl: string | null }[] }[] };

const ACTIONS = [
  { href: "/dashboard/tours", t: "Plan a trip", d: "Book or activate a tour package", i: "✈" },
  { href: "/dashboard/education", t: "Academy", d: "Timetable, live classes & progress", i: "✦" },
  { href: "/dashboard/referral", t: "Invite", d: "Referral link and QR code", i: "⌘" },
  { href: "/dashboard/support", t: "Support", d: "Raise or track a ticket", i: "?" },
];

export default function Overview() {
  const { data, error, loading } = useApi<Overview>("/member/overview");
  const credits = useApi<{ summary: { available: string; pending: string } }>("/member/credits");
  const acts = useApi<{ activations: { status: string }[] }>("/member/activations");
  const classes = useApi<Classes>("/member/classes");
  const income = useApi<{ summary: { available: string; pendingWithdrawals: string; totalEarned: string } }>("/member/income");
  const rank = useApi<{ current: { name: string } | null; next: { name: string } | null }>("/member/ranks");
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;

  const next = classes.data?.courses
    .filter((c) => c.status === "ENROLLED")
    .flatMap((c) => c.sessions.map((s) => ({ ...s, course: c.title })))
    .filter((s) => new Date(s.startsAt).getTime() > Date.now() - 2 * 3600e3)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  const activePkgs = acts.data?.activations.filter((a) => a.status !== "CANCELLED").length ?? 0;

  return (
    <>
      <div className="lux-card-gold relative mb-8 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip">Member dashboard</span>
            <h1 className="mt-4 font-serif text-4xl text-white sm:text-5xl">Welcome, <span className="text-gold-grad">{data.fullName.split(" ")[0]}</span></h1>
            <p className="mt-2 text-sm text-white/50">Member ID <span className="font-mono text-gold-300">{data.memberId}</span> · Joined {fmtDate(data.joinedAt)}{data.sponsor && <> · Sponsor {data.sponsor.fullName} ({data.sponsor.memberId})</>}</p>
          </div>
          <Badge value={data.status} />
        </div>
      </div>

      <SecNo n={1}>At a glance</SecNo>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total income" value={income.data ? money(income.data.summary.totalEarned, "USD") : "—"} hint="Commissions & rank rewards" />
        <StatCard label="Available balance" value={income.data ? money(income.data.summary.available, "USD") : "—"} hint="Withdrawable income" />
        <StatCard label="Pending withdrawals" value={income.data ? money(income.data.summary.pendingWithdrawals, "USD") : "—"} />
        <StatCard label="Current rank" value={rank.data?.current?.name ?? "Member"} hint={rank.data?.next ? `Next: ${rank.data.next.name}` : undefined} />
        <StatCard label="USD package credit" value={credits.data ? money(credits.data.summary.available, "USD") : "—"} hint={credits.data && Number(credits.data.summary.pending) ? `${money(credits.data.summary.pending, "USD")} pending` : "Available to use"} />
        <StatCard label="Active packages" value={activePkgs} />
        <StatCard label="Trip bookings" value={data.stats.enquiries} />
        <StatCard label="Course enrolments" value={data.stats.enrollments} />
        <StatCard label="Direct referrals" value={data.stats.directs} />
        <StatCard label="Left team" value={data.stats.leftTeam} />
        <StatCard label="Right team" value={data.stats.rightTeam} />
        <StatCard label="Open tickets" value={data.stats.openTickets} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SecNo n={2}>Quick actions</SecNo>
          <div className="grid gap-4 sm:grid-cols-2">
            {ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="lux-card lux-hover group flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-grad text-lg text-onyx-950 transition group-hover:scale-110">{a.i}</span>
                <span><span className="block font-semibold text-white">{a.t}</span><span className="text-xs text-white/50">{a.d}</span></span>
              </Link>
            ))}
          </div>
          {next && (
            <div className="lux-card mt-4 flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-[0.2em] text-gold-300">Next class</div>
                <div className="truncate font-semibold text-white">{next.title}</div>
                <div className="text-xs text-white/50">{next.course} · {fmtDate(next.startsAt, true)}</div>
              </div>
              {next.liveUrl ? <a href={next.liveUrl} target="_blank" rel="noreferrer" className="btn-lux !px-4 !py-2 text-xs">Join link</a> : <Link href="/dashboard/education" className="btn-outline btn-sm">Timetable</Link>}
            </div>
          )}
        </div>
        <div>
          <SecNo n={3}>Notices</SecNo>
          <div className="lux-card p-5">
            <ul className="space-y-3">
              {data.notifications.map((n) => (
                <li key={n.id} className="border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">{!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />}{n.title}</div>
                  <div className="text-sm text-white/55">{n.body}</div>
                  <div className="text-xs text-white/30">{fmtDate(n.createdAt, true)}</div>
                </li>
              ))}
              {!data.notifications.length && <li className="text-sm text-white/45">No notices yet.</li>}
            </ul>
            <Link href="/dashboard/notifications" className="mt-4 inline-block text-sm text-gold-300 underline">All notifications</Link>
          </div>
        </div>
      </div>
    </>
  );
}
