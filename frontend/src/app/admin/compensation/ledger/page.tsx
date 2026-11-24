"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Empty, Modal, PageHeader, Spinner, StatCard } from "@/components/ui";
import { CalcLog, CsvExport } from "@/components/admin/AdminBits";
import { fmtDate, money } from "@/lib/api";

const TYPES = ["DIRECT", "BINARY", "RANK", "REVERSAL", "WITHDRAWAL_HOLD", "WITHDRAWAL_RELEASE"] as const;
type IncomeType = (typeof TYPES)[number];
type Entry = {
  id: string; txId: string; type: IncomeType; amount: string; balanceAfter: string; memo: string; calc: unknown; weekKey: string | null;
  reversesId: string | null; createdAt: string; user: { memberId: string; fullName: string }; activation: { receiptNo: string } | null;
};
type Resp = { total: number; entries: Entry[]; totals: Partial<Record<IncomeType, string>> };
const PAGE_SIZE = 50;
const label = (t: string) => t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const typeColor: Record<IncomeType, string> = {
  DIRECT: "text-emerald-300", BINARY: "text-sky-300", RANK: "text-gold-300", REVERSAL: "text-red-300", WITHDRAWAL_HOLD: "text-amber-300", WITHDRAWAL_RELEASE: "text-white/70",
};

export default function IncomeLedgerPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("q", search);
  if (type) params.set("type", type);
  const { data, error, loading } = useApi<Resp>(`/admin/compensation/ledger?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const [open, setOpen] = useState<Entry | null>(null);

  return (
    <>
      <PageHeader title="Reward audit" subtitle="Immutable income ledger with the full calculation log for every commission, reward, reversal and withdrawal hold." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {TYPES.map((t) => <StatCard key={t} label={label(t)} value={money(data?.totals[t] ?? 0)} hint="All-time total" />)}
      </div>

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
        <input className="input max-w-xs" placeholder="Tx ID, Member ID or receipt no" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input max-w-[200px]" value={type} onChange={(e) => { setPage(1); setType(e.target.value); }} aria-label="Type">
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </select>
        <button className="btn-navy">Search</button>
        <div className="ml-auto"><CsvExport href="/api/admin/reports/income.csv" /></div>
      </form>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {loading && !data ? <Spinner /> : !data?.entries.length ? <Empty>No ledger entries match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Tx ID</th><th>Date</th><th>Member</th><th>Type</th><th>Amount</th><th>Balance after</th><th>Source</th><th /></tr></thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs text-white">{e.txId}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(e.createdAt, true)}</td>
                  <td>{e.user.fullName}<div className="font-mono text-xs text-gold-300">{e.user.memberId}</div></td>
                  <td className={`whitespace-nowrap text-xs font-semibold ${typeColor[e.type] ?? ""}`}>{label(e.type)}</td>
                  <td className={`whitespace-nowrap font-medium ${Number(e.amount) < 0 ? "text-red-300" : "text-white"}`}>{money(e.amount)}</td>
                  <td className="whitespace-nowrap">{money(e.balanceAfter)}</td>
                  <td className="text-xs">
                    {e.activation && <div>Receipt <span className="font-mono">{e.activation.receiptNo}</span></div>}
                    {e.weekKey && <div>Week {e.weekKey}</div>}
                    <div className="max-w-[260px] whitespace-normal text-white/50" title={e.memo}>{e.memo}</div>
                  </td>
                  <td><button className="btn-outline btn-sm" onClick={() => setOpen(e)}>Calculation</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm text-white/70">
          <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages} · {data.total} entries</span>
          <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={`Calculation · ${open?.txId ?? ""}`}>
        {open && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="text-white">{open.user.fullName} <span className="font-mono text-xs text-gold-300">{open.user.memberId}</span></div>
              <div className="mt-1 font-serif text-2xl text-gold-grad">{money(open.amount)}</div>
              <div className="mt-1 text-xs text-white/50">{label(open.type)} · {fmtDate(open.createdAt, true)} · balance after {money(open.balanceAfter)}</div>
              {open.memo && <div className="mt-2 text-xs text-white/60">{open.memo}</div>}
              {open.reversesId && <div className="mt-1 text-xs text-red-300/80">Reverses entry <span className="font-mono">{open.reversesId}</span></div>}
            </div>
            <CalcLog calc={open.calc} />
          </div>
        )}
      </Modal>
    </>
  );
}
