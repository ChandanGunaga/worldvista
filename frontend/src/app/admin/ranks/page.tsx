"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Empty, Field, Modal, PageHeader, SecNo, Spinner, StatCard } from "@/components/ui";
import { CsvExport, StatusPill, num, useIsSuper } from "@/components/admin/AdminBits";
import { api, fmtDate, money } from "@/lib/api";

type Rank = { id: string; name: string; sortOrder: number; leftVolume: string; rightVolume: string; reward: string; active: boolean; _count: { achievements: number } };
type RewardStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type Achievement = {
  id: string; qualifiedAt: string; leftVolume: string; rightVolume: string; reward: string; rewardStatus: RewardStatus; reviewedAt: string | null; reviewNote: string | null;
  rank: { name: string }; user: { memberId: string; fullName: string };
};
type Resp = { ranks: Rank[]; achievements: Achievement[]; warnings: string[] };
type RankForm = { name: string; sortOrder: string; leftVolume: string; rightVolume: string; reward: string; active: boolean };

const STATUSES: { v: RewardStatus; l: string }[] = [
  { v: "PENDING_REVIEW", l: "Pending review" },
  { v: "APPROVED", l: "Approved" },
  { v: "REJECTED", l: "Rejected" },
];

export default function RanksPage() {
  const superAdmin = useIsSuper();
  const { data, error, loading, reload } = useApi<Resp>("/admin/ranks");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [filter, setFilter] = useState<RewardStatus | "">("PENDING_REVIEW");

  // rank edit
  const [editing, setEditing] = useState<Rank | "new" | null>(null);
  const [form, setForm] = useState<RankForm>({ name: "", sortOrder: "", leftVolume: "", rightVolume: "", reward: "", active: true });
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  // review
  const [review, setReview] = useState<{ a: Achievement; approve: boolean } | null>(null);
  const [rv, setRv] = useState({ note: "", password: "" });
  const [rvErr, setRvErr] = useState("");

  const openEdit = (r: Rank | "new") => {
    setFormErr("");
    if (r === "new") {
      const nextOrder = (data?.ranks.reduce((m, x) => Math.max(m, x.sortOrder), 0) ?? 0) + 1;
      setForm({ name: "", sortOrder: String(nextOrder), leftVolume: "", rightVolume: "", reward: "", active: true });
    } else {
      setForm({ name: r.name, sortOrder: String(r.sortOrder), leftVolume: String(Number(r.leftVolume)), rightVolume: String(Number(r.rightVolume)), reward: String(Number(r.reward)), active: r.active });
    }
    setEditing(r);
  };

  const saveRank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormErr("");
    const json = { name: form.name, sortOrder: Number(form.sortOrder), leftVolume: Number(form.leftVolume), rightVolume: Number(form.rightVolume), reward: Number(form.reward), active: form.active };
    try {
      if (editing === "new") await api("/admin/ranks", { method: "POST", json });
      else await api(`/admin/ranks/${editing.id}`, { method: "PUT", json });
      setMsg({ kind: "success", text: `Rank ${form.name} saved.` });
      setEditing(null);
      reload();
    } catch (err) {
      setFormErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review) return;
    setBusy(true);
    setRvErr("");
    try {
      await api(`/admin/rank-achievements/${review.a.id}/review`, { method: "POST", json: { approve: review.approve, note: rv.note.trim() || undefined, password: rv.password } });
      setMsg({
        kind: "success",
        text: review.approve
          ? `${review.a.rank.name} reward of ${money(review.a.reward)} approved and credited to ${review.a.user.memberId}.`
          : `${review.a.rank.name} reward for ${review.a.user.memberId} rejected.`,
      });
      setReview(null);
      reload();
    } catch (err) {
      const ae = err as Error & { status?: number };
      setRvErr(ae.status === 409 ? `Already reviewed: ${ae.message}` : ae.message);
      if (ae.status === 409) reload();
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner />;
  const achievements = (data?.achievements ?? []).filter((a) => !filter || a.rewardStatus === filter);
  const pending = data?.achievements.filter((a) => a.rewardStatus === "PENDING_REVIEW") ?? [];

  return (
    <>
      <PageHeader
        title="Rank management"
        subtitle="Rank thresholds (lifetime left / right volume) and one-time rank rewards."
        action={superAdmin ? <button className="btn-lux" onClick={() => openEdit("new")}>Add rank</button> : undefined}
      />

      {data?.warnings.length ? (
        <div className="mb-4">
          <Alert kind="warning">
            <div className="font-semibold">Check rank thresholds</div>
            <ul className="mt-1 list-disc pl-5">{data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </Alert>
        </div>
      ) : null}
      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ranks" value={data?.ranks.length ?? 0} hint={`${data?.ranks.filter((r) => r.active).length ?? 0} active`} />
        <StatCard label="Pending rewards" value={pending.length} hint={money(pending.reduce((s, a) => s + Number(a.reward), 0)) + " awaiting review"} />
        <StatCard label="Achievements" value={data?.achievements.length ?? 0} hint="Latest 300 shown" />
      </div>

      <SecNo n={1}>Ranks</SecNo>
      {!superAdmin && <p className="mb-3 text-xs text-white/50">Only a Super Admin can add or edit ranks.</p>}
      {!data?.ranks.length ? <Empty>No ranks configured.</Empty> : (
        <div className="card mb-8 overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>#</th><th>Rank</th><th>Left volume</th><th>Right volume</th><th>Reward</th><th>Status</th><th>Achieved by</th><th /></tr></thead>
            <tbody>
              {data.ranks.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.sortOrder}</td>
                  <td className="font-medium text-white">{r.name}</td>
                  <td className="font-mono text-xs">{num(r.leftVolume)}</td>
                  <td className="font-mono text-xs">{num(r.rightVolume)}</td>
                  <td className="whitespace-nowrap">{money(r.reward)}</td>
                  <td><StatusPill value={r.active ? "ACTIVE" : "INACTIVE"} /></td>
                  <td>{r._count.achievements}</td>
                  <td>{superAdmin && <button className="btn-outline btn-sm" onClick={() => openEdit(r)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SecNo n={2}>Rank achievements &amp; rewards</SecNo>
      <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <select className="input max-w-[200px]" value={filter} onChange={(e) => setFilter(e.target.value as RewardStatus | "")} aria-label="Reward status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <div className="ml-auto"><CsvExport href="/api/admin/reports/rank-rewards.csv" /></div>
      </div>
      {!achievements.length ? <Empty>No achievements match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Member</th><th>Rank</th><th>Qualified</th><th>Volume L / R</th><th>Reward</th><th>Status</th><th /></tr></thead>
            <tbody>
              {achievements.map((a) => (
                <tr key={a.id}>
                  <td>{a.user.fullName}<div className="font-mono text-xs text-gold-300">{a.user.memberId}</div></td>
                  <td className="text-white">{a.rank.name}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(a.qualifiedAt, true)}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{num(a.leftVolume)} / {num(a.rightVolume)}</td>
                  <td className="whitespace-nowrap font-medium text-white">{money(a.reward)}</td>
                  <td>
                    <StatusPill value={a.rewardStatus} />
                    {a.reviewedAt && <div className="mt-1 text-[11px] text-white/45">{a.rewardStatus === "REJECTED" ? "Rejected" : "Reviewed"} {fmtDate(a.reviewedAt)}</div>}
                    {a.reviewNote && <div className="mt-1 max-w-[220px] whitespace-normal text-[11px] text-white/50">{a.reviewNote}</div>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    {a.rewardStatus === "PENDING_REVIEW" && (
                      <>
                        <button className="btn-lux btn-sm" onClick={() => { setRv({ note: "", password: "" }); setRvErr(""); setReview({ a, approve: true }); }}>Approve</button>
                        <button className="btn-outline btn-sm" onClick={() => { setRv({ note: "", password: "" }); setRvErr(""); setReview({ a, approve: false }); }}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add rank" : `Edit ${editing ? (editing as Rank).name : ""}`}>
        <form onSubmit={saveRank} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className="input" required minLength={2} maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Order" hint="Lower ranks first."><input className="input" type="number" step={1} required value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
            <Field label="Left volume (lifetime)"><input className="input" type="number" min={0} step="0.01" required value={form.leftVolume} onChange={(e) => setForm({ ...form, leftVolume: e.target.value })} /></Field>
            <Field label="Right volume (lifetime)"><input className="input" type="number" min={0} step="0.01" required value={form.rightVolume} onChange={(e) => setForm({ ...form, rightVolume: e.target.value })} /></Field>
            <Field label="Reward (USD)"><input className="input" type="number" min={0} step="0.01" required value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} /></Field>
            <label className="flex items-center gap-3 self-end pb-3 text-sm text-white/75">
              <input type="checkbox" className="h-4 w-4 accent-[#e2b04a]" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
          </div>
          <p className="text-xs text-white/50">Changes apply to future qualifications only. Rewards already recorded keep their original amount. Only Super Admins can save.</p>
          {formErr && <Alert>{formErr}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-lux" disabled={busy}>{busy ? "Saving…" : "Save rank"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!review} onClose={() => setReview(null)} title={review ? `${review.approve ? "Approve" : "Reject"} ${review.a.rank.name} reward` : ""}>
        {review && (
          <form onSubmit={doReview} className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="text-white">{review.a.user.fullName} <span className="font-mono text-xs text-gold-300">{review.a.user.memberId}</span></div>
              <div className="mt-1 font-serif text-2xl text-gold-grad">{money(review.a.reward)}</div>
              <div className="mt-1 text-xs text-white/50">Qualified {fmtDate(review.a.qualifiedAt, true)} · volume {num(review.a.leftVolume)} L / {num(review.a.rightVolume)} R</div>
            </div>
            {review.approve
              ? <Alert kind="info">Approving credits {money(review.a.reward)} to the member&apos;s income balance and notifies them.</Alert>
              : <Alert kind="warning">Rejecting means no reward is credited. The member is notified with your note.</Alert>}
            <Field label={review.approve ? "Note (optional)" : "Reason"}>
              <textarea className="input" rows={3} maxLength={500} required={!review.approve} value={rv.note} onChange={(e) => setRv({ ...rv, note: e.target.value })} />
            </Field>
            <Field label="Your password"><input className="input" type="password" autoComplete="current-password" required value={rv.password} onChange={(e) => setRv({ ...rv, password: e.target.value })} /></Field>
            {rvErr && <Alert>{rvErr}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setReview(null)}>Cancel</button>
              <button className={review.approve ? "btn-lux" : "btn-navy"} disabled={busy}>{busy ? "Saving…" : review.approve ? "Approve reward" : "Reject reward"}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
