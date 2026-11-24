"use client";
import { useState } from "react";
import { GenealogyChart } from "@/components/GenealogyChart";
import { useSession } from "@/components/session";
import { Alert, Field, Modal, PageHeader } from "@/components/ui";
import { useApi } from "@/components/useApi";
import { api } from "@/lib/api";

export default function AdminGenealogy() {
  const { user } = useSession();
  const isSuper = user?.role === "SUPER_ADMIN";
  const [key, setKey] = useState(0);
  const [move, setMove] = useState<string | null>(null);
  const [f, setF] = useState({ newParent: "", side: "LEFT", reason: "", password: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const roots = useApi<{ roots: { memberId: string; fullName: string }[] }>("/admin/genealogy/roots");
  const [top, setTop] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!move) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ path: { memberId: string }[] | null }>("/admin/genealogy/move", { method: "POST", json: { memberId: move, ...f } });
      setMsg({ kind: "success", text: `Moved. New path: ${r.path?.map((p) => p.memberId).join(" › ") ?? "updated"}. The change is recorded in the audit log.` });
      setKey((k) => k + 1);
      setF({ newParent: "", side: "LEFT", reason: "", password: "" });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Genealogy" subtitle="Full sponsor and binary placement trees, member drill-down and audited placement corrections." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="text-sm text-white/55" htmlFor="top">Top-level member</label>
        <select id="top" className="input max-w-xs" value={top} onChange={(e) => { setTop(e.target.value); setKey((k) => k + 1); }}>
          {roots.data?.roots.map((r) => <option key={r.memberId} value={r.memberId}>{r.memberId} · {r.fullName}</option>)}
        </select>
        <span className="text-xs text-white/40">{roots.data?.roots.length ?? 0} independent trees (members registered without a sponsor)</span>
      </div>
      <GenealogyChart
        key={key}
        initialRoot={top || undefined}
        base="/admin/genealogy"
        extraActions={isSuper ? (m) => <button type="button" className="btn-outline btn-sm" onClick={() => { setMove(m); setMsg(null); }}>Correct placement</button> : undefined}
      />
      <Modal open={!!move} onClose={() => setMove(null)} title={`Correct placement: ${move ?? ""}`}>
        <form onSubmit={submit} className="space-y-4">
          <Alert kind="warning">
            The member moves together with their whole downline into an empty slot. Sponsor (referral) relationships do not change.
            The correction is audited with your reason.
          </Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New placement parent (Member ID)"><input className="input font-mono uppercase" required value={f.newParent} onChange={(e) => setF({ ...f, newParent: e.target.value })} /></Field>
            <Field label="Side">
              <select className="input" value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })}><option value="LEFT">Left</option><option value="RIGHT">Right</option></select>
            </Field>
          </div>
          <Field label="Reason (min 10 characters)"><textarea className="input" rows={3} required minLength={10} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <Field label="Your password"><input className="input" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></Field>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setMove(null)}>Close</button>
            <button className="btn-lux" disabled={busy}>{busy ? "Moving…" : "Move member"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
