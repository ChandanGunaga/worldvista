"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, PageHeader, Spinner } from "@/components/ui";
import { fmtDate } from "@/lib/api";

type T = { id: string; reference: string; subject: string; category: string; status: string; updatedAt: string; user: { memberId: string; fullName: string } };

export default function TicketsPage() {
  const [status, setStatus] = useState("");
  const { data, error, loading } = useApi<{ tickets: T[] }>(`/admin/tickets${status ? `?status=${status}` : ""}`);
  return (
    <>
      <PageHeader
        title="Support tickets"
        action={
          <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
            <option value="">All statuses</option>
            {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
          </select>
        }
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : !data?.tickets.length ? <Empty>No tickets.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Subject</th><th>Member</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {data.tickets.map((t) => (
                <tr key={t.id} className="hover:bg-cream">
                  <td className="font-mono text-xs">{t.reference}</td>
                  <td><Link className="font-medium text-navy-800 hover:underline" href={`/admin/tickets/${t.id}`}>{t.subject}</Link></td>
                  <td>{t.user.fullName}<div className="font-mono text-xs text-slate-500">{t.user.memberId}</div></td>
                  <td>{t.category}</td>
                  <td><Badge value={t.status} /></td>
                  <td className="whitespace-nowrap">{fmtDate(t.updatedAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
