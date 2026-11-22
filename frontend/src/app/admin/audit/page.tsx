"use client";
import { Fragment, useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Empty, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type Log = {
  id: string; seq: number; action: string; entity: string; entityId: string | null; reason: string | null; ip: string | null;
  before: unknown; after: unknown; createdAt: string; hash: string; actor: { memberId: string; fullName: string } | null;
};
const PAGE_SIZE = 50;

export default function AuditPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [verify, setVerify] = useState<{ valid: boolean; checked: number; brokenAtSeq?: number } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [vErr, setVErr] = useState("");
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (search) params.set("q", search);
  const { data, error, loading } = useApi<{ total: number; logs: Log[] }>(`/admin/audit?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const runVerify = async () => {
    setVerifying(true);
    setVErr("");
    try {
      setVerify(await api("/admin/audit/verify"));
    } catch (e) {
      setVErr((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only and hash-chained: editing or deleting any entry breaks the chain."
        action={<button className="btn-navy" onClick={runVerify} disabled={verifying}>{verifying ? "Verifying…" : "Verify chain integrity"}</button>}
      />
      {verify && (
        <div className="mb-4">
          <Alert kind={verify.valid ? "success" : "error"}>
            {verify.valid ? `Chain intact. ${verify.checked} entries verified.` : `Chain broken at entry #${verify.brokenAtSeq} (${verify.checked} entries). Investigate immediately.`}
          </Alert>
        </div>
      )}
      {vErr && <div className="mb-4"><Alert>{vErr}</Alert></div>}
      <form className="card mb-5 flex flex-wrap gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
        <input className="input max-w-sm" placeholder="Action (e.g. admin.) or entity ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" />
        <button className="btn-navy">Search</button>
      </form>
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : !data?.logs.length ? <Empty>No entries.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>#</th><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th><th>Hash</th><th /></tr></thead>
            <tbody>
              {data.logs.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="text-xs text-slate-500">{l.seq}</td>
                    <td className="whitespace-nowrap text-xs">{fmtDate(l.createdAt, true)}</td>
                    <td>{l.actor ? <>{l.actor.fullName}<div className="font-mono text-xs text-slate-500">{l.actor.memberId}</div></> : "System"}</td>
                    <td className="font-mono text-xs">{l.action}</td>
                    <td className="text-xs">{l.entity}<div className="font-mono text-slate-400">{l.entityId ?? ""}</div></td>
                    <td className="max-w-xs text-xs">{l.reason ?? "—"}</td>
                    <td className="font-mono text-xs text-slate-500" title={l.hash}>{l.hash.slice(0, 10)}…</td>
                    <td>
                      {(l.before != null || l.after != null) && (
                        <button className="btn-outline btn-sm" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Diff"}</button>
                      )}
                    </td>
                  </tr>
                  {open === l.id && (
                    <tr>
                      <td colSpan={8} className="bg-cream">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div><div className="mb-1 text-xs font-semibold text-slate-500">Before</div><pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(l.before, null, 2)}</pre></div>
                          <div><div className="mb-1 text-xs font-semibold text-slate-500">After</div><pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(l.after, null, 2)}</pre></div>
                        </div>
                        {l.ip && <div className="mt-2 text-xs text-slate-500">IP {l.ip}</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
