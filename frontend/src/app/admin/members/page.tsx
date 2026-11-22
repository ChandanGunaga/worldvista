"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, PageHeader, Spinner } from "@/components/ui";
import { fmtDate } from "@/lib/api";

type Row = { id: string; memberId: string; fullName: string; email: string; mobile: string | null; country: string | null; status: string; createdAt: string; sponsor: { memberId: string } | null };
const PAGE_SIZE = 25;

export default function MembersPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  const { data, error, loading } = useApi<{ total: number; members: Row[] }>(`/admin/members?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader title="Members" subtitle={data ? `${data.total} members` : undefined} />
      <form
        className="card mb-5 flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <input className="input max-w-xs" placeholder="Member ID, name, email or mobile" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        <select className="input max-w-[200px]" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_VERIFICATION">Pending verification</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button className="btn-navy">Search</button>
      </form>
      {error && <Alert>{error}</Alert>}
      {loading ? <Spinner /> : !data?.members.length ? <Empty>No members match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Member</th><th>Contact</th><th>Country</th><th>Sponsor</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="hover:bg-cream">
                  <td>
                    <Link href={`/admin/members/${m.id}`} className="font-medium text-navy-800 hover:underline">{m.fullName}</Link>
                    <div className="font-mono text-xs text-slate-500">{m.memberId}</div>
                  </td>
                  <td>{m.email}<div className="text-xs text-slate-500">{m.mobile ?? "—"}</div></td>
                  <td>{m.country ?? "—"}</td>
                  <td className="font-mono text-xs">{m.sponsor?.memberId ?? "—"}</td>
                  <td><Badge value={m.status} /></td>
                  <td className="whitespace-nowrap">{fmtDate(m.createdAt)}</td>
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
    </>
  );
}
