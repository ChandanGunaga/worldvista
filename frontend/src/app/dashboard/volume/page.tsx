"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Empty, PageHeader, SecNo, Spinner, StatCard } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Week = { id: string; weekKey: string; leftCarryIn: string; rightCarryIn: string; leftVolume: string; rightVolume: string; matched: string; calculated: string; payable: string; capped: string; leftCarryOut: string; rightCarryOut: string };
type Data = {
  current: { weekKey: string; end: string; leftCarryIn: string; rightCarryIn: string; leftVolume: string; rightVolume: string; matched: string; calculated: string; payable: string; capped: string; leftCarryOut: string; rightCarryOut: string };
  weeks: Week[];
  lifetime: { left: string; right: string };
  rules: { binaryRate: number; weeklyCap: number; carryForwardVolume: boolean; timezone: string; weekStartDay: number };
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const n = (v: string) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function Volume() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const { data, error, loading } = useApi<Data>(`/member/volume${qs ? `?${qs}` : ""}`);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const c = data.current;
  const L = Number(c.leftCarryIn) + Number(c.leftVolume);
  const R = Number(c.rightCarryIn) + Number(c.rightVolume);
  const max = Math.max(1, L, R);

  return (
    <>
      <PageHeader title="Business Volume" subtitle={`Left and right team sales volume. Weeks run ${DAYS[data.rules.weekStartDay]} 00:00 – ${DAYS[(data.rules.weekStartDay + 6) % 7]} 23:59 (${data.rules.timezone}).`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lifetime left volume" value={n(data.lifetime.left)} />
        <StatCard label="Lifetime right volume" value={n(data.lifetime.right)} />
        <StatCard label="This week matched" value={n(c.matched)} hint={`Binary ${data.rules.binaryRate}% → ${money(c.calculated, "USD")}`} />
        <StatCard label="Carry-forward (projected)" value={`${n(c.leftCarryOut)} / ${n(c.rightCarryOut)}`} hint={data.rules.carryForwardVolume ? "Left / right unmatched volume" : "Carry-forward is off"} />
      </div>

      <div className="mt-10"><SecNo n={1}>Current week · {c.weekKey}</SecNo></div>
      <div className="lux-card grid gap-6 p-6 md:grid-cols-2">
        {[["Left leg", c.leftCarryIn, c.leftVolume, L], ["Right leg", c.rightCarryIn, c.rightVolume, R]].map(([label, cin, vol, total]) => (
          <div key={label as string}>
            <div className="flex justify-between text-sm"><span className="font-semibold text-white">{label}</span><span className="font-mono text-gold-300">{n(String(total))}</span></div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold-grad transition-all duration-700" style={{ width: `${(Number(total) / max) * 100}%` }} /></div>
            <div className="mt-2 text-xs text-white/45">Carried in {n(cin as string)} + this week {n(vol as string)}</div>
          </div>
        ))}
        <p className="text-xs text-white/40 md:col-span-2">Week closes {fmtDate(c.end, true)}. Matched volume is the smaller (weaker) leg. {data.rules.carryForwardVolume ? "Unmatched volume carries into next week." : ""} Weekly binary is capped at {money(data.rules.weeklyCap, "USD")}.</p>
      </div>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <SecNo n={2}>Closed weeks</SecNo>
        <div className="flex gap-2 text-xs">
          <label className="text-white/50">From <input type="date" className="input !w-auto !py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-white/50">To <input type="date" className="input !w-auto !py-1.5" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>
      <section className="card overflow-x-auto p-4 sm:p-6">
        {data.weeks.length ? (
          <table className="table-x">
            <thead><tr><th>Week</th><th className="text-right">Left (in + new)</th><th className="text-right">Right (in + new)</th><th className="text-right">Matched</th><th className="text-right">Unmatched carry L / R</th><th className="text-right">Calculated</th><th className="text-right">Payable</th><th className="text-right">Over cap</th></tr></thead>
            <tbody>
              {data.weeks.map((w) => (
                <tr key={w.id}>
                  <td className="font-mono text-xs">{w.weekKey}</td>
                  <td className="text-right">{n(w.leftCarryIn)} + {n(w.leftVolume)}</td>
                  <td className="text-right">{n(w.rightCarryIn)} + {n(w.rightVolume)}</td>
                  <td className="text-right">{n(w.matched)}</td>
                  <td className="text-right">{n(w.leftCarryOut)} / {n(w.rightCarryOut)}</td>
                  <td className="text-right">{money(w.calculated, "USD")}</td>
                  <td className="text-right text-gold-300">{money(w.payable, "USD")}</td>
                  <td className="text-right text-white/50">{Number(w.capped) > 0 ? money(w.capped, "USD") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No closed weeks yet.</Empty>}
      </section>
    </>
  );
}
