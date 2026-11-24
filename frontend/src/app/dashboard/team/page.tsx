"use client";
import { useApi } from "@/components/useApi";
import { GenealogyChart } from "@/components/GenealogyChart";
import { useSession } from "@/components/session";
import { Badge, Empty, PageHeader, SecNo, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/api";

type Direct = { memberId: string; fullName: string; status: string; placementSide: string | null; createdAt: string };

export default function Team() {
  const { user } = useSession();
  const legs = useApi<{ legs: { LEFT: number; RIGHT: number } }>("/member/genealogy/binary?depth=1");
  const directs = useApi<{ directs: Direct[] }>("/member/team/direct");

  return (
    <>
      <PageHeader title="My Genealogy" subtitle="Your sponsor tree (who you referred) and binary placement tree (left / right legs)." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Direct referrals" value={directs.data?.directs.length ?? "—"} />
        <StatCard label="Left team" value={legs.data?.legs.LEFT ?? "—"} />
        <StatCard label="Right team" value={legs.data?.legs.RIGHT ?? "—"} />
      </div>

      <div className="mt-10"><SecNo n={1}>Team chart</SecNo></div>
      <GenealogyChart base="/member/genealogy" me={user?.memberId} />
      <p className="mt-3 text-xs text-white/40">For privacy, other members’ names are shortened and their contact details are hidden.</p>

      <div className="mt-10"><SecNo n={2}>Direct referrals</SecNo></div>
      <section className="card overflow-x-auto p-6">
        {directs.data?.directs.length ? (
          <table className="table-x">
            <thead><tr><th>Member</th><th>Side</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {directs.data.directs.map((d) => (
                <tr key={d.memberId}><td><div className="font-medium text-white">{d.fullName}</div><div className="font-mono text-xs text-gold-300">{d.memberId}</div></td><td>{d.placementSide?.toLowerCase() ?? "—"}</td><td><Badge value={d.status} /></td><td>{fmtDate(d.createdAt)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No direct referrals yet. Share your referral link to invite friends and family.</Empty>}
      </section>
    </>
  );
}
