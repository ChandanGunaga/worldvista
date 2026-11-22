"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Faq } from "@/lib/types";

const blank = { question: "", answer: "", sortOrder: "0", active: true };

export default function FaqsPage() {
  const { data, error, loading, reload } = useApi<{ faqs: Faq[] }>("/admin/faqs");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (editing === "new") await api("/admin/faqs", { method: "POST", json: form });
      else await api(`/admin/faqs/${editing}`, { method: "PUT", json: form });
      setEditing(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: Faq) => {
    if (!confirm(`Delete "${f.question}"?`)) return;
    try {
      await api(`/admin/faqs/${f.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="FAQs"
        action={<button className="btn-gold" onClick={() => { setForm({ ...blank, sortOrder: String(data?.faqs.length ?? 0) }); setErr(""); setEditing("new"); }}>New FAQ</button>}
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : !data?.faqs.length ? <Empty>No FAQs yet.</Empty> : (
        <div className="space-y-3">
          {data.faqs.map((f) => (
            <div key={f.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">#{f.sortOrder}</span>
                  <h2 className="font-sans text-base font-semibold text-navy-950">{f.question}</h2>
                  {!f.active && <Badge value="CLOSED" />}
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{f.answer}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-outline btn-sm" onClick={() => { setForm({ question: f.question, answer: f.answer, sortOrder: String(f.sortOrder), active: f.active }); setErr(""); setEditing(f.id); }}>Edit</button>
                <button className="btn-sm btn border border-red-200 text-red-700 hover:bg-red-50" onClick={() => remove(f)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New FAQ" : "Edit FAQ"}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Question"><input className="input" required minLength={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></Field>
          <Field label="Answer"><textarea className="input" rows={5} required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></Field>
          <div className="flex items-end gap-6">
            <Field label="Sort order"><input className="input w-28" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          </div>
          {err && <Alert>{err}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
