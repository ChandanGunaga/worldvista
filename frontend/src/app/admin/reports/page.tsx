"use client";
import { useState } from "react";
import { useSession } from "@/components/session";
import { useApi } from "@/components/useApi";
import { Alert, Empty, Field, PageHeader, SecNo, Spinner } from "@/components/ui";
import { money } from "@/lib/api";

type Role = "SUPER_ADMIN" | "FINANCE_ADMIN" | "SUPPORT_ADMIN" | "CONTENT_ADMIN" | string;
const FINANCE = ["SUPER_ADMIN", "FINANCE_ADMIN"];
const REPORT_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN"];

const REPORTS: { kind: string; title: string; desc: string; roles?: string[] }[] = [
  { kind: "members", title: "Members & genealogy", desc: "Member ID, contact, status, sponsor, placement parent and side." },
  { kind: "enquiries", title: "Enquiries", desc: "Tour, course and general enquiries with status." },
  { kind: "payments", title: "Payments", desc: "Tour and course payments with Razorpay order/payment IDs.", roles: FINANCE },
  { kind: "credits", title: "USD credits", desc: "Every credit issued: amount, status, funding reference, approver and void reason.", roles: FINANCE },
  { kind: "ledger", title: "Credit ledger", desc: "Immutable USD credit ledger: credits, debits, refunds and reversals with running balance.", roles: FINANCE },
  { kind: "activations", title: "Package activations", desc: "Tour and course packages activated with USD credit, with receipt numbers and totals." },
  { kind: "enrollments", title: "Course enrolments", desc: "Enrolments by member and course with classes completed." },
  { kind: "audit", title: "Audit log", desc: "Hash-chained admin and security events.", roles: ["SUPER_ADMIN"] },
];

type SummaryRow = { period: string; newMembers: number; bookingRequests: number; bookingsConfirmed: number; paymentsReceived: number; paymentsReceivedInr: number; creditsApproved: number; creditActivations: number };
const PERIODS = [
  { v: "day", l: "Daily" },
  { v: "month", l: "Monthly" },
  { v: "year", l: "Annual" },
] as const;

export default function ReportsPage() {
  const { user } = useSession();
  const role: Role = user?.role ?? "";
  const canReport = REPORT_ROLES.includes(role);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState<"day" | "month" | "year">("month");

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", `${to}T23:59:59.999Z`);
  const suffix = qs.toString() ? `?${qs}` : "";
  const sq = new URLSearchParams(qs);
  sq.set("period", period);
  const summary = useApi<{ period: string; rows: SummaryRow[] }>(canReport ? `/admin/reports/summary?${sq}` : null);

  const totals = summary.data?.rows.reduce(
    (t, r) => ({
      newMembers: t.newMembers + r.newMembers, bookingRequests: t.bookingRequests + r.bookingRequests, bookingsConfirmed: t.bookingsConfirmed + r.bookingsConfirmed,
      paymentsReceived: t.paymentsReceived + r.paymentsReceived, paymentsReceivedInr: t.paymentsReceivedInr + r.paymentsReceivedInr, creditsApproved: t.creditsApproved + r.creditsApproved, creditActivations: t.creditActivations + r.creditActivations,
    }),
    { newMembers: 0, bookingRequests: 0, bookingsConfirmed: 0, paymentsReceived: 0, paymentsReceivedInr: 0, creditsApproved: 0, creditActivations: 0 },
  );

  return (
    <>
      <PageHeader title="Reports" subtitle="Period summaries and CSV exports, filtered by date." />
      {!canReport && user && <div className="mb-6"><Alert kind="info">Reports are available to Finance, Support and Super Admins.</Alert></div>}

      <div className="card mb-8 flex flex-wrap items-end gap-4 p-5">
        <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        {(from || to) && <button className="btn-outline btn-sm mb-1" onClick={() => { setFrom(""); setTo(""); }}>Clear</button>}
        <p className="mb-2 text-xs text-white/45">Applies to the summary and to every CSV download. Without a range the summary covers the last 30 days / 12 months / 5 years.</p>
      </div>

      {canReport && (
        <section className="mb-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SecNo n={1}>Summary</SecNo>
            <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Period">
              {PERIODS.map((p) => (
                <button
                  key={p.v}
                  role="tab"
                  aria-selected={period === p.v}
                  className={period === p.v ? "rounded-full bg-gold-grad px-4 py-1.5 text-xs font-semibold text-black" : "rounded-full px-4 py-1.5 text-xs text-white/60 hover:text-white"}
                  onClick={() => setPeriod(p.v)}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          {summary.error && <Alert>{summary.error}</Alert>}
          {summary.loading && !summary.data ? <Spinner /> : !summary.data?.rows.length ? <Empty>No activity in this range.</Empty> : (
            <div className="card overflow-x-auto">
              <table className="table-x">
                <thead>
                  <tr><th>Period</th><th className="text-right">New members</th><th className="text-right">Booking requests</th><th className="text-right">Bookings confirmed</th><th className="text-right">Payments (USD)</th><th className="text-right">Payments (INR)</th><th className="text-right">Credits approved (USD)</th><th className="text-right">Credit activations (USD)</th></tr>
                </thead>
                <tbody>
                  {summary.data.rows.map((r) => (
                    <tr key={r.period}>
                      <td className="whitespace-nowrap font-mono text-xs text-white">{r.period}</td>
                      <td className="text-right">{r.newMembers}</td>
                      <td className="text-right">{r.bookingRequests}</td>
                      <td className="text-right">{r.bookingsConfirmed}</td>
                      <td className="text-right">{r.paymentsReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                      <td className="text-right">{r.paymentsReceivedInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="text-right">{money(r.creditsApproved)}</td>
                      <td className="text-right">{money(r.creditActivations)}</td>
                    </tr>
                  ))}
                  {totals && summary.data.rows.length > 1 && (
                    <tr className="font-semibold">
                      <td className="text-gold-300">Total</td>
                      <td className="text-right text-gold-300">{totals.newMembers}</td>
                      <td className="text-right text-gold-300">{totals.bookingRequests}</td>
                      <td className="text-right text-gold-300">{totals.bookingsConfirmed}</td>
                      <td className="text-right text-gold-300">{totals.paymentsReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                      <td className="text-right text-gold-300">{totals.paymentsReceivedInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="text-right text-gold-300">{money(totals.creditsApproved)}</td>
                      <td className="text-right text-gold-300">{money(totals.creditActivations)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-white/45">Periods are UTC. &ldquo;Payments received&rdquo; sums paid Razorpay payments across currencies; see the Payments CSV for a per-currency breakdown.</p>
        </section>
      )}

      {canReport && (
        <section>
          <SecNo n={2}>CSV exports</SecNo>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {REPORTS.filter((r) => !r.roles || r.roles.includes(role)).map((r) => (
              <div key={r.kind} className="card flex flex-col p-5">
                <h2 className="text-lg text-white">{r.title}</h2>
                <p className="mt-1 flex-1 text-sm text-white/50">{r.desc}</p>
                <a className="btn-outline btn-sm mt-4 self-start" href={`/api/admin/reports/${r.kind}.csv${suffix}`}>Download CSV</a>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="mt-6 text-xs text-white/45">Wallet, binary volume, reward, shareholder and withdrawal reports will be added only if those modules are approved and built.</p>
    </>
  );
}
