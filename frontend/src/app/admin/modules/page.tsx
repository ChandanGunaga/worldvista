"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type Mod = { key: string; name: string; category: string; status: string; sourceSpec: unknown; openQuestions: string[]; ownerNotes: string; updatedAt: string };
const STATUSES = ["PENDING_OWNER_APPROVAL", "PENDING_LEGAL_REVIEW", "WITHDRAWN"];

const label = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (c) => c.toUpperCase());
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Renders arbitrary spec JSON: arrays of objects as tables, objects as key/value lists. */
function SpecView({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length && value.every(isObj)) {
      const cols = Array.from(new Set(value.flatMap((r) => Object.keys(r as object))));
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table-x">
            <thead><tr>{cols.map((c) => <th key={c}>{label(c)}</th>)}</tr></thead>
            <tbody>
              {value.map((r, i) => (
                <tr key={i}>{cols.map((c) => <td key={c}>{String((r as Record<string, unknown>)[c] ?? "—")}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <span>{value.map(String).join(", ")}</span>;
  }
  if (isObj(value)) {
    return (
      <dl className="space-y-2">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className={isObj(v) || Array.isArray(v) ? "" : "flex flex-wrap gap-x-3"}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label(k)}</dt>
            <dd className="text-sm text-navy-950">
              {isObj(v) || (Array.isArray(v) && v.some(isObj)) ? <div className="mt-1"><SpecView value={v} /></div> : <SpecView value={v} />}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(value ?? "—")}</span>;
}

export default function ModulesPage() {
  const { data, error, loading, reload } = useApi<{ modules: Mod[] }>("/admin/modules");
  const [edit, setEdit] = useState<Mod | null>(null);
  const [form, setForm] = useState({ status: "PENDING_OWNER_APPROVAL", ownerNotes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/modules/${edit.key}`, { method: "PATCH", json: form });
      setEdit(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Compensation modules" subtitle="Register of the shareholder, affiliate-reward and finance modules described in the source deck." />
      <div className="mb-6 rounded-2xl border-2 border-gold-500 bg-gold-50 p-5">
        <div className="eyebrow">Specification only · not active</div>
        <p className="mt-2 text-sm text-navy-950">
          These records capture the owner-supplied rules and the open questions that remain. <strong>No calculation, accrual, payout, wallet or withdrawal engine exists in this build</strong>, and none of these modules can be activated from this screen.
          Per the requirements (§17–§18), each module needs written owner approval of complete rules <em>and</em> qualified Indian legal, tax and regulatory sign-off before any implementation work begins.
        </p>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : (
        <div className="space-y-5">
          {data?.modules.map((m) => (
            <div key={m.key} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{m.category}</div>
                  <h2 className="mt-1 text-xl text-navy-950">{m.name}</h2>
                  <div className="mt-0.5 font-mono text-xs text-slate-400">{m.key} · updated {fmtDate(m.updatedAt, true)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={m.status} />
                  <button className="btn-outline btn-sm" onClick={() => { setEdit(m); setForm({ status: m.status, ownerNotes: m.ownerNotes }); setErr(""); }}>Update</button>
                </div>
              </div>
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-sans text-sm font-semibold text-navy-950">Source specification</h3>
                  <div className="rounded-xl bg-cream p-4"><SpecView value={m.sourceSpec} /></div>
                </div>
                <div>
                  <h3 className="mb-2 font-sans text-sm font-semibold text-navy-950">Open questions</h3>
                  <ul className="space-y-1.5">
                    {m.openQuestions.map((q) => (
                      <li key={q} className="flex gap-2 text-sm text-slate-700">
                        <span aria-hidden className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-slate-300 bg-white" />
                        {q}
                      </li>
                    ))}
                  </ul>
                  {m.ownerNotes && (
                    <>
                      <h3 className="mb-1 mt-4 font-sans text-sm font-semibold text-navy-950">Owner notes</h3>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{m.ownerNotes}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Update ${edit?.name ?? ""}`}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Status" hint="Modules cannot be set active in this build.">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Owner notes / decisions">
            <textarea className="input" rows={8} maxLength={10000} value={form.ownerNotes} onChange={(e) => setForm({ ...form, ownerNotes: e.target.value })} />
          </Field>
          {err && <Alert>{err}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
