"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { BinaryTree } from "@/components/BinaryTree";
import { Alert, Badge, Empty, PageHeader, Spinner, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/api";
import type { TreeNode } from "@/lib/types";

type Direct = { memberId: string; fullName: string; status: string; placementSide: string | null; createdAt: string };

export default function Team() {
  const [root, setRoot] = useState<string>("");
  const [search, setSearch] = useState("");
  const tree = useApi<{ tree: TreeNode; legs: { LEFT: number; RIGHT: number } }>(`/member/team/binary?depth=3${root ? `&root=${root}` : ""}`);
  const directs = useApi<{ directs: Direct[] }>("/member/team/direct");

  return (
    <>
      <PageHeader title="My Team" subtitle="Your sponsor tree (direct referrals) and binary placement tree." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Direct referrals" value={directs.data?.directs.length ?? "—"} />
        <StatCard label="Left team" value={tree.data?.legs.LEFT ?? "—"} hint={root ? `Under ${root}` : undefined} />
        <StatCard label="Right team" value={tree.data?.legs.RIGHT ?? "—"} hint={root ? `Under ${root}` : undefined} />
      </div>

      <section className="card mt-6 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg text-navy-950">Binary placement tree</h2>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setRoot(search.trim().toUpperCase()); }}>
            <input className="input w-40" placeholder="Member ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn-outline btn-sm">Find</button>
            {root && <button type="button" className="btn-outline btn-sm" onClick={() => { setRoot(""); setSearch(""); }}>Back to me</button>}
          </form>
        </div>
        {tree.loading ? <Spinner /> : tree.error ? <Alert>{tree.error}</Alert> : tree.data && <BinaryTree tree={tree.data.tree} onSelect={(id) => setRoot(id)} />}
        <p className="mt-3 text-xs text-slate-500">Click a member to view their subtree. Showing 3 levels.</p>
      </section>

      <section className="card mt-6 overflow-x-auto p-6">
        <h2 className="mb-4 text-lg text-navy-950">Direct referrals</h2>
        {directs.data?.directs.length ? (
          <table className="table-x">
            <thead><tr><th>Member</th><th>Side</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {directs.data.directs.map((d) => (
                <tr key={d.memberId}><td><div className="font-medium">{d.fullName}</div><div className="text-xs text-slate-500">{d.memberId}</div></td><td>{d.placementSide ?? "—"}</td><td><Badge value={d.status} /></td><td>{fmtDate(d.createdAt)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No direct referrals yet.</Empty>}
      </section>
    </>
  );
}
