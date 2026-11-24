"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Empty, PageHeader, Spinner, StatCard } from "@/components/ui";
import { CsvExport, StatusPill, num } from "@/components/admin/AdminBits";
import { fmtDate, money } from "@/lib/api";

type Row = {
  id: string; weekKey: string; leftCarryIn: string; rightCarryIn: string; leftVolume: string; rightVolume: string; matched: string; rate: string | number;
  calculated: string; payable: string; capped: string; cap: string; leftCarryOut: string; rightCarryOut: string; eligible: boolean; closedAt: string | null;
  user: { memberId: string; fullName: string };
};
type Resp = {
  weeks: string[]; week: string | null; rows: Row[];
  totals: { _sum: { calculated: string | null; payable: string | null; capped: string | null; matched: string | null }; _count: number } | null;
  cappedCount: number;
};

export default function BinaryWeeksPage() {
  const [week, setWeek] = useState("");
  const [capped, setCapped] = useState(false);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  if (capped) params.set("capped", "1");
  if (search) params.set("q", search);
  const { data, error, loading } = useApi<Resp>(`/admin/compensation/weeks?${params}`);
  const t = data?.totals?._sum;

  return (
    <>
      <PageHeader title="Binary weeks & cap report" subtitle="Closed weekly binary calculations per member: carry-in, volume, matched, cap and carry-out." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Members" value={data?.totals?._count ?? 0} hint={data?.week ? `Week of ${data.week}` : "No closed week"} />
        <StatCard label="Matched volume" value={num(t?.matched)} hint="Weaker-leg volume" />
        <StatCard label="Calculated" value={money(t?.calculated ?? 0)} hint="Before weekly cap" />
        <StatCard label="Payable" value={money(t?.payable ?? 0)} hint="Credited to members" />
        <StatCard label="Capped / excess" value={money(t?.capped ?? 0)} hint={`${data?.cappedCount ?? 0} member(s) reached the cap · forfeited`} />
      </div>

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <select className="input max-w-[200px]" value={week || data?.week || ""} onChange={(e) => setWeek(e.target.value)} aria-label="Week">
          {!data?.weeks.length && <option value="">No closed weeks</option>}
          {data?.weeks.map((w) => <option key={w} value={w}>Week of {w}</option>)}
        </select>
        <input className="input max-w-xs" placeholder="Member ID or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <button className="btn-navy">Search</button>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" className="h-4 w-4 accent-[#e2b04a]" checked={capped} onChange={(e) => setCapped(e.target.checked)} />
          Only members who reached the cap
        </label>
        <div className="ml-auto"><CsvExport href="/api/admin/reports/binary-weeks.csv" /></div>
      </form>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {loading && !data ? <Spinner /> : !data?.rows.length ? <Empty>{data?.week ? "No rows match for this week." : "No binary weeks have been closed yet."}</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead>
              <tr>
                <th>Member</th><th>Carry-in L / R</th><th>Volume L / R</th><th>Matched</th><th>Rate</th><th>Calculated</th><th>Payable</th><th>Capped excess</th><th>Carry-out L / R</th><th>Eligible</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.user.fullName}<div className="font-mono text-xs text-gold-300">{r.user.memberId}</div></td>
                  <td className="whitespace-nowrap font-mono text-xs">{num(r.leftCarryIn)} / {num(r.rightCarryIn)}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{num(r.leftVolume)} / {num(r.rightVolume)}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-white">{num(r.matched)}</td>
                  <td className="whitespace-nowrap text-xs">{num(r.rate)}%</td>
                  <td className="whitespace-nowrap">{money(r.calculated)}</td>
                  <td className="whitespace-nowrap font-medium text-white">{money(r.payable)}</td>
                  <td className="whitespace-nowrap">
                    {Number(r.capped) > 0 ? <span className="text-amber-300">{money(r.capped)}</span> : <span className="text-white/40">—</span>}
                    <div className="text-[11px] text-white/40">cap {money(r.cap)}</div>
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">{num(r.leftCarryOut)} / {num(r.rightCarryOut)}</td>
                  <td>
                    <StatusPill value={r.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE"} />
                    {r.closedAt && <div className="mt-1 text-[11px] text-white/40">Closed {fmtDate(r.closedAt)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-white/45">Excess above the weekly cap is forfeited and not carried forward (spec §5). Unmatched volume carries forward when enabled in Commission settings.</p>
    </>
  );
}
