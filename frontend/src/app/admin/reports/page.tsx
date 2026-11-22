"use client";
import { useState } from "react";
import { useSession } from "@/components/session";
import { Field, PageHeader } from "@/components/ui";

const REPORTS = [
  { kind: "members", title: "Members & genealogy", desc: "Member ID, contact, status, sponsor, placement parent and side." },
  { kind: "enquiries", title: "Enquiries", desc: "Tour, course and general enquiries with status." },
  { kind: "payments", title: "Payments", desc: "Tour and course payments with Razorpay order/payment IDs.", financeOnly: true },
  { kind: "audit", title: "Audit log", desc: "Hash-chained admin and security events.", superOnly: true },
];

export default function ReportsPage() {
  const { user } = useSession();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", `${to}T23:59:59.999Z`);
  const suffix = qs.toString() ? `?${qs}` : "";

  return (
    <>
      <PageHeader title="Reports" subtitle="CSV exports filtered by creation date." />
      <div className="card mb-6 flex flex-wrap items-end gap-4 p-5">
        <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        {(from || to) && <button className="btn-outline btn-sm mb-1" onClick={() => { setFrom(""); setTo(""); }}>Clear</button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {REPORTS.filter((r) => (!r.superOnly || user?.role === "SUPER_ADMIN") && (!r.financeOnly || user?.role === "SUPER_ADMIN" || user?.role === "FINANCE_ADMIN")).map((r) => (
          <div key={r.kind} className="card flex flex-col p-5">
            <h2 className="text-lg text-navy-950">{r.title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-500">{r.desc}</p>
            <a className="btn-navy mt-4 self-start" href={`/api/admin/reports/${r.kind}.csv${suffix}`}>Download CSV</a>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-500">Wallet, binary volume, reward, shareholder and withdrawal reports will be added only if those modules are approved and built.</p>
    </>
  );
}
