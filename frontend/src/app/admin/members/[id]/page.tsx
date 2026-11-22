"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { useSession } from "@/components/session";
import { BinaryTree } from "@/components/BinaryTree";
import { Alert, Badge, Field, Modal, PageHeader, Spinner, StatCard } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";
import type { TreeNode } from "@/lib/types";

type Detail = {
  member: {
    id: string; memberId: string; fullName: string; email: string; mobile: string | null; country: string | null; address: string | null;
    role: string; status: string; emailVerifiedAt: string | null; createdAt: string; lastLoginAt: string | null; placementSide: string | null;
    sponsor: { memberId: string; fullName: string } | null;
    placementParent: { memberId: string; fullName: string } | null;
    _count: { referrals: number; enquiries: number; tickets: number };
    enrollments: { id: string; status: string; createdAt: string; course: { title: string } }[];
    acceptances: { id: string; acceptedAt: string; ip: string | null; policyVersion: { version: number; page: { title: string } } }[];
  };
  tree: TreeNode | null;
  legs: { LEFT: number; RIGHT: number };
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium text-navy-950">{v}</span>
    </div>
  );
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { data, error, loading, reload } = useApi<Detail>(`/admin/members/${id}`);
  const [modal, setModal] = useState(false);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (loading && !data) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const m = data.member;
  const target = m.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/members/${m.id}/status`, { method: "POST", json: { status: target, reason, password } });
      setModal(false);
      setReason("");
      setPassword("");
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/admin/members" className="text-sm text-navy-700 hover:underline">← All members</Link>
      <PageHeader
        title={m.fullName}
        subtitle={`${m.memberId} · ${m.role.replace(/_/g, " ").toLowerCase()}`}
        action={
          user?.role === "SUPER_ADMIN" && m.status !== "PENDING_VERIFICATION" ? (
            <button className={target === "SUSPENDED" ? "btn bg-red-600 text-white hover:bg-red-700" : "btn-navy"} onClick={() => setModal(true)}>
              {target === "SUSPENDED" ? "Suspend member" : "Reactivate member"}
            </button>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Direct referrals" value={m._count.referrals} />
        <StatCard label="Left team" value={data.legs.LEFT} />
        <StatCard label="Right team" value={data.legs.RIGHT} />
        <StatCard label="Enquiries" value={m._count.enquiries} />
        <StatCard label="Tickets" value={m._count.tickets} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 text-lg text-navy-950">Profile</h2>
          <Row k="Status" v={<Badge value={m.status} />} />
          <Row k="Email" v={m.email} />
          <Row k="Email verified" v={fmtDate(m.emailVerifiedAt, true)} />
          <Row k="Mobile" v={m.mobile ?? "—"} />
          <Row k="Country" v={m.country ?? "—"} />
          <Row k="Address" v={m.address || "—"} />
          <Row k="Joined" v={fmtDate(m.createdAt, true)} />
          <Row k="Last login" v={fmtDate(m.lastLoginAt, true)} />
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg text-navy-950">Genealogy</h2>
          <Row k="Sponsor" v={m.sponsor ? `${m.sponsor.fullName} (${m.sponsor.memberId})` : "—"} />
          <Row k="Placement parent" v={m.placementParent ? `${m.placementParent.fullName} (${m.placementParent.memberId})` : "—"} />
          <Row k="Placement side" v={m.placementSide ?? "—"} />
          <h3 className="mb-2 mt-6 font-sans text-sm font-semibold text-navy-950">Enrolments</h3>
          {m.enrollments.length === 0 ? <p className="text-sm text-slate-500">None</p> : m.enrollments.map((e) => (
            <Row key={e.id} k={e.course.title} v={<Badge value={e.status} />} />
          ))}
          <h3 className="mb-2 mt-6 font-sans text-sm font-semibold text-navy-950">Policy acceptances</h3>
          {m.acceptances.length === 0 ? <p className="text-sm text-slate-500">None recorded</p> : m.acceptances.map((a) => (
            <Row key={a.id} k={`${a.policyVersion.page.title} v${a.policyVersion.version}`} v={<span className="text-xs font-normal">{fmtDate(a.acceptedAt, true)}{a.ip ? ` · ${a.ip}` : ""}</span>} />
          ))}
        </div>
      </div>
      {data.tree && (
        <div className="card mt-6 p-6">
          <h2 className="mb-4 text-lg text-navy-950">Binary placement (2 levels)</h2>
          <BinaryTree tree={data.tree} onSelect={(mid) => mid !== m.memberId && router.push(`/admin/members/${mid}`)} />
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={target === "SUSPENDED" ? "Suspend member" : "Reactivate member"}>
        <form onSubmit={submit} className="space-y-4">
          {target === "SUSPENDED" && <Alert kind="warning">Suspending signs the member out immediately and blocks sign-in.</Alert>}
          <Field label="Reason (recorded in audit log)">
            <textarea className="input" rows={3} required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label="Your password" hint="Re-authentication is required for this action.">
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {err && <Alert>{err}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Confirm"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
