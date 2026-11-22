"use client";
import { useApi } from "@/components/useApi";
import { Badge, PageHeader, Spinner } from "@/components/ui";

type Mod = { key: string; name: string; category: string; status: string };

export default function Programs() {
  const { data, loading } = useApi<{ modules: Mod[] }>("/member/modules");
  if (loading) return <Spinner />;
  return (
    <>
      <PageHeader title="Wallet & Programs" subtitle="Wallet, withdrawals, transfers and reward programmes." />
      <div className="card border-l-4 border-l-gold-500 p-6">
        <h2 className="text-lg text-navy-950">Not yet available</h2>
        <p className="mt-2 text-sm text-slate-600">
          These features are under review and are not active. No balances, rewards or payouts are being calculated or credited,
          and World Vista is not accepting deposits or investments through this portal. We&apos;ll notify you here if anything changes.
        </p>
        <p className="mt-3 text-sm text-slate-600">If anyone offers you returns, rewards or income in World Vista&apos;s name, please contact support.</p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.modules.map((m) => (
          <div key={m.key} className="card p-5 opacity-80">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{m.category}</div>
            <div className="mt-1 font-semibold text-navy-950">{m.name}</div>
            <div className="mt-3"><Badge value="Not available" className="!bg-slate-100 !text-slate-600" /></div>
          </div>
        ))}
      </div>
    </>
  );
}
