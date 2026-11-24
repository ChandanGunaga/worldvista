"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner, StatCard } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";

type Credit = {
  id: string; reference: string; amount: string; status: "PENDING" | "APPROVED" | "VOIDED"; internalNote: string; fundingRef: string | null;
  createdAt: string; approvedAt: string | null; voidedAt: string | null; voidReason: string | null; sentAt: string | null;
  user: { memberId: string; fullName: string; email: string }; createdBy?: string | null; approvedBy: string | null; voidedBy: string | null;
};
type Totals = Partial<Record<"PENDING" | "APPROVED" | "VOIDED", { amount: string; count: number }>>;
type CreditsResp = { total: number; credits: Credit[]; totals: Totals; outstandingBalance: string };
type MemberHit = { id: string; memberId: string; fullName: string; email: string; status: string };

const STATUSES = ["PENDING", "APPROVED", "VOIDED"] as const;
const PAGE_SIZE = 25;

/** Debounced member search picker using /admin/lookup/members. */
function MemberPicker({ value, onChange }: { value: MemberHit | null; onChange: (m: MemberHit | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setErr(""); return; }
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await api<{ members: MemberHit[] }>(`/admin/lookup/members?q=${encodeURIComponent(term)}`);
        if (live) { setHits(r.members); setErr(""); }
      } catch (e) {
        if (live) setErr((e as Error).message);
      } finally {
        if (live) setBusy(false);
      }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gold-400/30 bg-gold-400/[0.06] px-4 py-3">
        <div>
          <div className="text-sm font-medium text-white">{value.fullName} <span className="font-mono text-xs text-gold-300">{value.memberId}</span></div>
          <div className="text-xs text-white/50">{value.email} · {value.status.toLowerCase().replace(/_/g, " ")}</div>
        </div>
        <button type="button" className="btn-outline btn-sm" onClick={() => { onChange(null); setQ(""); }}>Change</button>
      </div>
    );
  }
  return (
    <div>
      <input className="input" placeholder="Search by Member ID, name or email (min 2 chars)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search member" />
      {busy && <div className="mt-2 text-xs text-white/45">Searching…</div>}
      {err && <div className="mt-2"><Alert>{err}</Alert></div>}
      {hits.length > 0 && (
        <ul className="mt-2 max-h-56 divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03]">
          {hits.map((m) => (
            <li key={m.id}>
              <button type="button" className="w-full px-4 py-2.5 text-left hover:bg-white/[0.06]" onClick={() => onChange(m)}>
                <div className="text-sm text-white">{m.fullName} <span className="font-mono text-xs text-gold-300">{m.memberId}</span></div>
                <div className="text-xs text-white/50">{m.email} · {m.status.toLowerCase().replace(/_/g, " ")}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!busy && q.trim().length >= 2 && hits.length === 0 && !err && <div className="mt-2 text-xs text-white/45">No members match.</div>}
    </div>
  );
}

export default function CreditsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  const { data, error, loading, reload } = useApi<CreditsResp>(`/admin/credits?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  // Generate
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ amount: "", internalNote: "", password: "" });
  const [member, setMember] = useState<MemberHit | null>(null);
  const [genErr, setGenErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Approve / void
  const [approve, setApprove] = useState<Credit | null>(null);
  const [voiding, setVoiding] = useState<Credit | null>(null);
  const [act, setAct] = useState({ fundingRef: "", reason: "", password: "" });
  const [actErr, setActErr] = useState("");

  const openGen = () => { setGen({ amount: "", internalNote: "", password: "" }); setMember(null); setGenErr(""); setGenOpen(true); };
  const openAct = (c: Credit, kind: "approve" | "void") => {
    setAct({ fundingRef: "", reason: "", password: "" });
    setActErr("");
    if (kind === "approve") setApprove(c); else setVoiding(c);
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) { setGenErr("Select a member first."); return; }
    setBusy(true);
    setGenErr("");
    try {
      const r = await api<{ credit: { reference: string } }>("/admin/credits", { method: "POST", json: { member: member.memberId, amount: Number(gen.amount), internalNote: gen.internalNote, password: gen.password } });
      setGenOpen(false);
      setMsg({ kind: "success", text: `Credit ${r.credit.reference} (${money(gen.amount)}) created for ${member.memberId}. It stays pending until a second authorised admin approves it.` });
      reload();
    } catch (e) {
      setGenErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async (c: Credit) => {
    if (!window.confirm(`Send an in-app and email notification about ${c.reference} to ${c.user.fullName}?`)) return;
    setMsg(null);
    try {
      await api(`/admin/credits/${c.id}/send`, { method: "POST", json: {} });
      setMsg({ kind: "success", text: `Notification for ${c.reference} sent to ${c.user.email}.` });
      reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const doApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approve) return;
    setBusy(true);
    setActErr("");
    try {
      await api(`/admin/credits/${approve.id}/approve`, { method: "POST", json: { fundingRef: act.fundingRef, password: act.password } });
      setMsg({ kind: "success", text: `${approve.reference} approved. ${money(approve.amount)} is now available to ${approve.user.memberId}.` });
      setApprove(null);
      reload();
    } catch (err) {
      const ae = err as Error & { status?: number };
      setActErr(ae.status === 403 && !/password/i.test(ae.message) ? `${ae.message} — a different admin must approve credits they did not create.` : ae.message);
    } finally {
      setBusy(false);
    }
  };

  const doVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiding) return;
    setBusy(true);
    setActErr("");
    try {
      await api(`/admin/credits/${voiding.id}/void`, { method: "POST", json: { reason: act.reason, password: act.password } });
      setMsg({ kind: "success", text: `${voiding.reference} voided.` });
      setVoiding(null);
      reload();
    } catch (err) {
      const ae = err as Error & { status?: number };
      setActErr(ae.status === 409 ? `Cannot void: ${ae.message}` : ae.message);
    } finally {
      setBusy(false);
    }
  };

  const t = data?.totals ?? {};
  return (
    <>
      <PageHeader
        title="USD Credits"
        subtitle="Issue, approve and audit USD Package Credit balances."
        action={<button className="btn-lux" onClick={openGen}>Generate USD Credit</button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding balance" value={data ? money(data.outstandingBalance) : "—"} hint="Liability: unspent member credit" />
        <StatCard label="Pending approval" value={money(t.PENDING?.amount ?? 0)} hint={`${t.PENDING?.count ?? 0} credit(s) awaiting approval`} />
        <StatCard label="Approved" value={money(t.APPROVED?.amount ?? 0)} hint={`${t.APPROVED?.count ?? 0} credit(s) all time`} />
        <StatCard label="Voided" value={money(t.VOIDED?.amount ?? 0)} hint={`${t.VOIDED?.count ?? 0} credit(s)`} />
      </div>

      <div className="lux-card mb-6 p-5 text-sm text-white/70">
        <span className="chip mr-2">Policy</span>
        USD Package Credit is a <strong className="text-gold-300">closed-loop</strong> balance. It is not cash, cannot be withdrawn, cannot be transferred between members, and can only be used to activate eligible tour or course packages. Every credit needs a funding / payment reference and approval by an admin other than its creator; all actions are recorded in the ledger and audit log.
      </div>

      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
        <input className="input max-w-xs" placeholder="Reference, Member ID or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input max-w-[170px]" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <button className="btn-navy">Search</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn-outline btn-sm" href="/api/admin/reports/credits.csv">Credits CSV</a>
          <a className="btn-outline btn-sm" href="/api/admin/reports/ledger.csv">Ledger CSV</a>
        </div>
      </form>

      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {loading && !data ? <Spinner /> : !data?.credits.length ? <Empty>No credits match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Reference</th><th>Member</th><th>Amount</th><th>Status</th><th>Created / approved by</th><th>Dates</th><th /></tr></thead>
            <tbody>
              {data.credits.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs text-white">
                    {c.reference}
                    <div className="mt-1 max-w-[220px] whitespace-normal font-sans text-white/50" title={c.internalNote}>{c.internalNote}</div>
                  </td>
                  <td>{c.user.fullName}<div className="text-xs text-white/50"><span className="font-mono text-gold-300">{c.user.memberId}</span> · {c.user.email}</div></td>
                  <td className="whitespace-nowrap font-medium text-white">{money(c.amount)}</td>
                  <td><Badge value={c.status} />{c.sentAt && <div className="mt-1 text-[11px] text-white/45">Sent {fmtDate(c.sentAt)}</div>}</td>
                  <td className="text-xs">
                    <div>By {c.createdBy ?? "—"}</div>
                    {c.approvedBy && <div className="text-emerald-300/80">Approved: {c.approvedBy}</div>}
                    {c.fundingRef && <div className="text-white/50">Ref: {c.fundingRef}</div>}
                    {c.voidedBy && <div className="text-white/50">Voided: {c.voidedBy}{c.voidReason ? ` — ${c.voidReason}` : ""}</div>}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    <div>Created {fmtDate(c.createdAt, true)}</div>
                    {c.approvedAt && <div className="text-white/50">Approved {fmtDate(c.approvedAt, true)}</div>}
                    {c.voidedAt && <div className="text-white/50">Voided {fmtDate(c.voidedAt, true)}</div>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    {c.status !== "VOIDED" && <button className="btn-outline btn-sm" onClick={() => send(c)}>{c.sentAt ? "Resend" : "Send"}</button>}
                    {c.status === "PENDING" && <button className="btn-lux btn-sm" onClick={() => openAct(c, "approve")}>Approve</button>}
                    {c.status !== "VOIDED" && <button className="btn-outline btn-sm" onClick={() => openAct(c, "void")}>Void</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm text-white/70">
          <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate USD Credit">
        <form onSubmit={generate} className="space-y-4">
          <Field label="Member"><MemberPicker value={member} onChange={setMember} /></Field>
          <Field label="Amount (USD)"><input className="input" type="number" min="0.01" max="100000" step="0.01" required value={gen.amount} onChange={(e) => setGen({ ...gen, amount: e.target.value })} /></Field>
          <Field label="Internal reason / reference" hint="Why this credit is being issued (min 3 characters). Visible to admins only.">
            <textarea className="input" rows={3} required minLength={3} maxLength={500} value={gen.internalNote} onChange={(e) => setGen({ ...gen, internalNote: e.target.value })} />
          </Field>
          <Field label="Your password" hint="Re-enter your password to confirm."><input className="input" type="password" autoComplete="current-password" required value={gen.password} onChange={(e) => setGen({ ...gen, password: e.target.value })} /></Field>
          <p className="text-xs text-white/50">The credit is created as <strong className="text-gold-300">pending</strong>. It becomes spendable only after another authorised admin approves it against a confirmed funding / payment reference.</p>
          {genErr && <Alert>{genErr}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setGenOpen(false)}>Cancel</button>
            <button className="btn-lux" disabled={busy || !member}>{busy ? "Creating…" : "Create pending credit"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!approve} onClose={() => setApprove(null)} title={`Approve ${approve?.reference ?? ""}`}>
        {approve && (
          <form onSubmit={doApprove} className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="text-white">{approve.user.fullName} <span className="font-mono text-xs text-gold-300">{approve.user.memberId}</span></div>
              <div className="mt-1 font-serif text-2xl text-gold-grad">{money(approve.amount)}</div>
              <div className="mt-1 text-xs text-white/50">Created by {approve.createdBy ?? "—"} on {fmtDate(approve.createdAt, true)} · {approve.internalNote}</div>
            </div>
            <Field label="Funding / payment reference" hint="Confirm the underlying funds were received, e.g. a payment reference, bank transaction ID or invoice number.">
              <input className="input" required minLength={3} maxLength={200} value={act.fundingRef} onChange={(e) => setAct({ ...act, fundingRef: e.target.value })} />
            </Field>
            <Field label="Your password"><input className="input" type="password" autoComplete="current-password" required value={act.password} onChange={(e) => setAct({ ...act, password: e.target.value })} /></Field>
            {actErr && <Alert>{actErr}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setApprove(null)}>Cancel</button>
              <button className="btn-lux" disabled={busy}>{busy ? "Approving…" : "Approve credit"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!voiding} onClose={() => setVoiding(null)} title={`Void ${voiding?.reference ?? ""}`}>
        {voiding && (
          <form onSubmit={doVoid} className="space-y-4">
            <Alert kind="warning">
              Voiding removes {money(voiding.amount)} from {voiding.user.fullName}&apos;s balance{voiding.status === "APPROVED" ? " with a reversing ledger entry" : ""}. It cannot be undone, and is refused if any of the credit has already been spent.
            </Alert>
            <Field label="Reason" hint="Minimum 5 characters. The member is notified that the credit was cancelled.">
              <textarea className="input" rows={3} required minLength={5} maxLength={500} value={act.reason} onChange={(e) => setAct({ ...act, reason: e.target.value })} />
            </Field>
            <Field label="Your password"><input className="input" type="password" autoComplete="current-password" required value={act.password} onChange={(e) => setAct({ ...act, password: e.target.value })} /></Field>
            {actErr && <Alert>{actErr}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setVoiding(null)}>Keep credit</button>
              <button className="btn-navy" disabled={busy}>{busy ? "Voiding…" : "Void credit"}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
