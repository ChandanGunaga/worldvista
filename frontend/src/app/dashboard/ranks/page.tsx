"use client";
import clsx from "clsx";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, PageHeader, SecNo, Spinner } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Data = {
  volume: { left: string; right: string };
  current: { name: string } | null;
  next: { name: string; leftTarget: string; rightTarget: string; reward: string; leftPct: number; rightPct: number } | null;
  ranks: { id: string; name: string; leftVolume: string; rightVolume: string; reward: string; achieved: boolean }[];
  history: { id: string; rank: string; qualifiedAt: string; reward: string; rewardStatus: string; reviewedAt: string | null }[];
};
const n = (v: string | number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function Ranks() {
  const { data, error, loading } = useApi<Data>("/member/ranks");
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  return (
    <>
      <PageHeader title="My Ranks" subtitle="Rank progress is based on lifetime left and right team volume." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="lux-card-gold relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-400/15 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.2em] text-white/45">Current rank</div>
          <div className="mt-2 font-serif text-5xl text-gold-grad">{data.current?.name ?? "Member"}</div>
          <div className="mt-4 text-sm text-white/55">Lifetime volume · left <span className="text-white">{n(data.volume.left)}</span> · right <span className="text-white">{n(data.volume.right)}</span></div>
        </div>
        <div className="lux-card p-6">
          {data.next ? (
            <>
              <div className="flex items-end justify-between">
                <div><div className="text-xs uppercase tracking-[0.2em] text-white/45">Next rank</div><div className="font-serif text-3xl text-white">{data.next.name}</div></div>
                <div className="text-right text-sm text-white/55">Reward<div className="font-serif text-2xl text-gold-grad">{money(data.next.reward, "USD")}</div></div>
              </div>
              {[["Left", data.volume.left, data.next.leftTarget, data.next.leftPct], ["Right", data.volume.right, data.next.rightTarget, data.next.rightPct]].map(([k, have, need, pct]) => (
                <div key={k as string} className="mt-5">
                  <div className="flex justify-between text-xs text-white/55"><span>{k} leg</span><span>{n(have as string)} / {n(need as string)} ({pct}%)</span></div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold-grad transition-all duration-1000" style={{ width: `${pct}%` }} /></div>
                </div>
              ))}
            </>
          ) : <p className="text-white/60">You have achieved every rank. Congratulations!</p>}
        </div>
      </div>

      <div className="mt-10"><SecNo n={1}>Rank ladder</SecNo></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.ranks.map((r, i) => (
          <div key={r.id} className={clsx("lux-card p-4 transition", r.achieved ? "border-gold-400/50 shadow-glow" : "opacity-70")}>
            <div className="flex items-center justify-between"><span className="font-mono text-xs text-white/35">{String(i + 1).padStart(2, "0")}</span>{r.achieved && <span className="text-gold-300">★</span>}</div>
            <div className="mt-1 font-serif text-xl text-white">{r.name}</div>
            <div className="text-xs text-white/50">{n(r.leftVolume)} / {n(r.rightVolume)} volume</div>
            <div className="mt-2 text-sm text-gold-300">{money(r.reward, "USD")} reward</div>
          </div>
        ))}
      </div>

      <div className="mt-10"><SecNo n={2}>Achievement history</SecNo></div>
      <section className="card overflow-x-auto p-4 sm:p-6">
        {data.history.length ? (
          <table className="table-x">
            <thead><tr><th>Rank</th><th>Qualified</th><th>Reward</th><th>Status</th><th>Reviewed</th></tr></thead>
            <tbody>{data.history.map((h) => <tr key={h.id}><td className="text-white">{h.rank}</td><td>{fmtDate(h.qualifiedAt)}</td><td>{money(h.reward, "USD")}</td><td><Badge value={h.rewardStatus} /></td><td>{fmtDate(h.reviewedAt)}</td></tr>)}</tbody>
          </table>
        ) : <Empty>No ranks achieved yet.</Empty>}
        <p className="mt-3 text-xs text-white/35">Rank rewards are reviewed by our team before they are added to your income balance.</p>
      </section>
    </>
  );
}
