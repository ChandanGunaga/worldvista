"use client";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/api";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Field, PageHeader, Spinner } from "@/components/ui";

type Profile = { memberId: string; fullName: string; email: string; mobile: string | null; country: string | null; address: string | null; status: string; emailVerifiedAt: string | null; notifyEmail: boolean; createdAt: string; lastLoginAt: string | null };
type Msg = { kind: "error" | "success"; text: string } | null;

export default function ProfilePage() {
  const { data, loading, reload } = useApi<{ profile: Profile }>("/member/profile");
  const [p, setP] = useState({ fullName: "", mobile: "", country: "", address: "", notifyEmail: true });
  const [msg, setMsg] = useState<Msg>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [em, setEm] = useState({ newEmail: "", password: "", code: "", sent: false });
  const [emMsg, setEmMsg] = useState<Msg>(null);

  useEffect(() => {
    if (data) setP({ fullName: data.profile.fullName, mobile: data.profile.mobile ?? "", country: data.profile.country ?? "", address: data.profile.address ?? "", notifyEmail: data.profile.notifyEmail });
  }, [data]);

  if (loading || !data) return <Spinner />;
  const prof = data.profile;

  const run = async (fn: () => Promise<unknown>, setM: (m: Msg) => void, ok: string) => {
    setM(null);
    try { await fn(); setM({ kind: "success", text: ok }); } catch (e) { setM({ kind: "error", text: (e as Error).message }); }
  };

  return (
    <>
      <PageHeader title="Profile & Security" subtitle={`Member since ${fmtDate(prof.createdAt)} · Last login ${fmtDate(prof.lastLoginAt, true)}`} action={<Badge value={prof.status} />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="card space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); run(() => api("/member/profile", { method: "PATCH", json: p }).then(reload), setMsg, "Profile saved"); }}>
          <h2 className="text-lg text-navy-950">Personal details</h2>
          <Field label="Member ID"><input className="input bg-slate-50" value={prof.memberId} disabled /></Field>
          <Field label="Full name"><input className="input" value={p.fullName} onChange={(e) => setP({ ...p, fullName: e.target.value })} /></Field>
          <Field label="Mobile"><input className="input" value={p.mobile} onChange={(e) => setP({ ...p, mobile: e.target.value })} /></Field>
          <Field label="Country"><input className="input" value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })} /></Field>
          <Field label="Address"><input className="input" value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-navy-900" checked={p.notifyEmail} onChange={(e) => setP({ ...p, notifyEmail: e.target.checked })} /> Email me about my enquiries and account</label>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <button className="btn-navy">Save changes</button>
        </form>
        <div className="space-y-6">
          <form className="card space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); run(() => api("/member/change-password", { method: "POST", json: pw }).then(() => setPw({ currentPassword: "", newPassword: "" })), setPwMsg, "Password changed. Other sessions were signed out."); }}>
            <h2 className="text-lg text-navy-950">Change password</h2>
            <Field label="Current password"><input className="input" type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" hint="8+ characters with a letter and a number"><input className="input" type="password" autoComplete="new-password" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            {pwMsg && <Alert kind={pwMsg.kind}>{pwMsg.text}</Alert>}
            <button className="btn-navy">Update password</button>
          </form>
          <form className="card space-y-4 p-6" onSubmit={(e) => {
            e.preventDefault();
            if (!em.sent) run(() => api("/member/change-email/request", { method: "POST", json: { newEmail: em.newEmail, password: em.password } }).then(() => setEm({ ...em, sent: true })), setEmMsg, `Code sent to ${em.newEmail}`);
            else run(() => api("/member/change-email/confirm", { method: "POST", json: { newEmail: em.newEmail, code: em.code } }).then(() => { setEm({ newEmail: "", password: "", code: "", sent: false }); reload(); }), setEmMsg, "Email updated. Your old address has been notified.");
          }}>
            <h2 className="text-lg text-navy-950">Email address</h2>
            <p className="text-sm text-slate-600">Current: <strong>{prof.email}</strong> {prof.emailVerifiedAt && <span className="text-emerald-600">✓ verified</span>}</p>
            <Field label="New email"><input className="input" type="email" required disabled={em.sent} value={em.newEmail} onChange={(e) => setEm({ ...em, newEmail: e.target.value })} /></Field>
            {!em.sent ? (
              <Field label="Confirm with your password"><input className="input" type="password" required value={em.password} onChange={(e) => setEm({ ...em, password: e.target.value })} /></Field>
            ) : (
              <Field label="Code sent to new email"><input className="input tracking-[0.4em]" inputMode="numeric" maxLength={6} required value={em.code} onChange={(e) => setEm({ ...em, code: e.target.value.replace(/\D/g, "") })} /></Field>
            )}
            {emMsg && <Alert kind={emMsg.kind}>{emMsg.text}</Alert>}
            <button className="btn-outline">{em.sent ? "Confirm new email" : "Send verification code"}</button>
          </form>
        </div>
      </div>
    </>
  );
}
