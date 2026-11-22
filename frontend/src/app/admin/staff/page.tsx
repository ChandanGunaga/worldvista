"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { useSession } from "@/components/session";
import { Alert, Badge, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type Staff = { id: string; memberId: string; fullName: string; email: string; role: string; status: string; lastLoginAt: string | null };
const ADMIN_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"];
const ROLE_DESC: Record<string, string> = {
  SUPER_ADMIN: "Full access",
  FINANCE_ADMIN: "Reports (finance modules pending approval)",
  SUPPORT_ADMIN: "Members, enquiries, tickets, enrolments, reports",
  CONTENT_ADMIN: "Packages, courses, pages, FAQs, settings, enquiries",
};

export default function StaffPage() {
  const { user } = useSession();
  const { data, error, loading, reload } = useApi<{ staff: Staff[] }>("/admin/staff");
  const [create, setCreate] = useState(false);
  const [cForm, setCForm] = useState({ fullName: "", email: "", role: "SUPPORT_ADMIN", tempPassword: "", password: "" });
  const [roleFor, setRoleFor] = useState<Staff | null>(null);
  const [rForm, setRForm] = useState({ role: "SUPPORT_ADMIN", reason: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (fn: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      done();
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Staff & roles"
        subtitle="Admin accounts sign in with password plus an emailed one-time code."
        action={<button className="btn-gold" onClick={() => { setCForm({ fullName: "", email: "", role: "SUPPORT_ADMIN", tempPassword: "", password: "" }); setErr(""); setCreate(true); }}>Add staff</button>}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_ROLES.map((r) => (
          <div key={r} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-navy-800">{r.replace(/_/g, " ")}</div>
            <div className="mt-1 text-xs text-slate-500">{ROLE_DESC[r]}</div>
          </div>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {data?.staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-navy-950">{s.fullName}<div className="font-mono text-xs font-normal text-slate-500">{s.memberId}</div></td>
                  <td>{s.email}</td>
                  <td>{s.role.replace(/_/g, " ")}</td>
                  <td><Badge value={s.status} /></td>
                  <td className="whitespace-nowrap">{fmtDate(s.lastLoginAt, true)}</td>
                  <td>
                    {s.id !== user?.id && (
                      <button className="btn-outline btn-sm" onClick={() => { setRoleFor(s); setRForm({ role: s.role, reason: "", password: "" }); setErr(""); }}>Change role</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="Add staff member">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); submit(() => api("/admin/staff", { method: "POST", json: cForm }), () => setCreate(false)); }}
        >
          <Field label="Full name"><input className="input" required minLength={2} value={cForm.fullName} onChange={(e) => setCForm({ ...cForm, fullName: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" required value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} /></Field>
          <Field label="Role">
            <select className="input" value={cForm.role} onChange={(e) => setCForm({ ...cForm, role: e.target.value })}>
              {ADMIN_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="Temporary password" hint="Min. 10 characters. Share it separately and securely.">
            <input className="input" type="text" required minLength={10} autoComplete="off" value={cForm.tempPassword} onChange={(e) => setCForm({ ...cForm, tempPassword: e.target.value })} />
          </Field>
          <Field label="Your password (re-authentication)" className="sm:col-span-2">
            <input className="input" type="password" required autoComplete="current-password" value={cForm.password} onChange={(e) => setCForm({ ...cForm, password: e.target.value })} />
          </Field>
          {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-outline" onClick={() => setCreate(false)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!roleFor} onClose={() => setRoleFor(null)} title={`Change role · ${roleFor?.fullName ?? ""}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (roleFor) submit(() => api(`/admin/staff/${roleFor.id}/role`, { method: "POST", json: rForm }), () => setRoleFor(null)); }}
        >
          <Field label="New role" hint="Choosing Member removes admin access.">
            <select className="input" value={rForm.role} onChange={(e) => setRForm({ ...rForm, role: e.target.value })}>
              {[...ADMIN_ROLES, "MEMBER"].map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <Field label="Reason (recorded in audit log)"><textarea className="input" rows={3} required minLength={5} value={rForm.reason} onChange={(e) => setRForm({ ...rForm, reason: e.target.value })} /></Field>
          <Field label="Your password"><input className="input" type="password" required autoComplete="current-password" value={rForm.password} onChange={(e) => setRForm({ ...rForm, password: e.target.value })} /></Field>
          {err && <Alert>{err}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setRoleFor(null)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Change role"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
