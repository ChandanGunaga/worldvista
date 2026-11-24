"use client";
import { useApi } from "@/components/useApi";
import { Alert, PageHeader, SecNo, Spinner } from "@/components/ui";
import { money } from "@/lib/api";

type Plan = {
  enabled: boolean; directRate: number; binaryRate: number; weeklyCap: number; carryForwardVolume: boolean; timezone: string; weekStartDay: number; commissionBase: string;
  withdrawal: { feePct: number; min: number; max: number; holdHours: number };
  ranks: { name: string; leftVolume: string; rightVolume: string; reward: string }[];
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const n = (v: string | number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function PlanPage() {
  const { data, error, loading } = useApi<Plan>("/member/plan");
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const base = data.commissionBase === "PRICE_EXCL_SERVICE" ? "the package price, excluding service charges and taxes" : "the total package amount";
  return (
    <>
      <PageHeader title="Business Plan" subtitle="How commissions, volume and ranks are calculated on World Vista package sales." />
      <Alert kind="warning">
        Commissions are earned only on completed sales of World Vista tour and education packages. No income is earned for registering or recruiting members,
        and earnings are not guaranteed: they depend entirely on actual package sales. Cancelled or refunded packages reverse any related commission.
      </Alert>
      {!data.enabled && <div className="mt-4"><Alert kind="info">The commission plan has not been activated yet.</Alert></div>}

      <div className="mt-10"><SecNo n={1}>Commissions</SecNo></div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="lux-card p-6">
          <span className="chip">Direct sponsor</span>
          <div className="mt-4 font-serif text-5xl text-gold-grad">{data.directRate}%</div>
          <p className="mt-3 text-sm text-white/60">When someone you personally referred activates a package, you receive {data.directRate}% of {base}.</p>
          <table className="table-x mt-4"><thead><tr><th>Package base</th><th className="text-right">Commission</th></tr></thead>
            <tbody>{[100, 300, 500, 1000].map((b) => <tr key={b}><td>{money(b, "USD")}</td><td className="text-right">{money((b * data.directRate) / 100, "USD")}</td></tr>)}</tbody></table>
        </div>
        <div className="lux-card p-6">
          <span className="chip">Binary (team)</span>
          <div className="mt-4 font-serif text-5xl text-gold-grad">{data.binaryRate}%</div>
          <p className="mt-3 text-sm text-white/60">
            Package sales in your left and right teams add business volume to each leg. Each week, the smaller (weaker) leg is matched and you receive {data.binaryRate}% of the matched volume,
            up to <b className="text-white">{money(data.weeklyCap, "USD")} per week</b>. Anything above the weekly cap is not paid and not carried forward.
            {data.carryForwardVolume ? " Unmatched volume on the stronger leg carries into the next week." : ""}
          </p>
          <p className="mt-3 text-xs text-white/45">Weeks run {DAYS[data.weekStartDay]} 00:00 to {DAYS[(data.weekStartDay + 6) % 7]} 23:59, {data.timezone}.</p>
        </div>
      </div>

      <div className="mt-10"><SecNo n={2}>Rank rewards</SecNo></div>
      <div className="card overflow-x-auto p-4 sm:p-6">
        <table className="table-x">
          <thead><tr><th>#</th><th>Rank</th><th className="text-right">Left volume</th><th className="text-right">Right volume</th><th className="text-right">One-time reward</th></tr></thead>
          <tbody>{data.ranks.map((r, i) => <tr key={r.name}><td className="font-mono text-xs text-white/40">{String(i + 1).padStart(2, "0")}</td><td className="text-white">{r.name}</td><td className="text-right">{n(r.leftVolume)}</td><td className="text-right">{n(r.rightVolume)}</td><td className="text-right text-gold-300">{money(r.reward, "USD")}</td></tr>)}</tbody>
        </table>
        <p className="mt-3 text-xs text-white/40">Rank volume is lifetime team package volume. Rewards are reviewed by World Vista before being credited.</p>
      </div>

      <div className="mt-10"><SecNo n={3}>Withdrawals</SecNo></div>
      <div className="lux-card p-6 text-sm text-white/65">
        Income can be withdrawn in USDT on BNB Smart Chain (BEP20). Fee {data.withdrawal.feePct}% · minimum {money(data.withdrawal.min, "USD")} · maximum {money(data.withdrawal.max, "USD")} per request.
        After changing your withdrawal address, withdrawals pause for {data.withdrawal.holdHours} hours for security.
      </div>
      <p className="mt-6 text-xs text-white/35">USD Package Credit is separate: it can only be used to activate packages and cannot be withdrawn.</p>
    </>
  );
}
