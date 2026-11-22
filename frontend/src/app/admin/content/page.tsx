"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Markdown } from "@/components/Markdown";
import { Alert, Badge, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";
import type { Page } from "@/lib/types";

export default function ContentPage() {
  const { data, error, loading, reload } = useApi<{ pages: Page[] }>("/admin/pages");
  const [slug, setSlug] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", published: true, isPolicy: false });
  const [original, setOriginal] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const open = (p: Page) => {
    setSlug(p.slug);
    setIsNew(false);
    setForm({ title: p.title, body: p.body, published: p.published, isPolicy: p.isPolicy });
    setOriginal(p.body);
    setPreview(false);
    setErr("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/pages/${encodeURIComponent(slug)}`, { method: "PUT", json: form });
      setSlug(null);
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
        title="Content pages"
        subtitle="About, legal and policy pages. Policy pages are versioned and members' acceptance is recorded per version."
        action={<button className="btn-gold" onClick={() => { setSlug(""); setIsNew(true); setForm({ title: "", body: "", published: true, isPolicy: false }); setOriginal(""); setPreview(false); setErr(""); }}>New page</button>}
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Page</th><th>Slug</th><th>Type</th><th>Version</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {data?.pages.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-navy-950">{p.title}</td>
                  <td className="font-mono text-xs">{p.slug}</td>
                  <td>{p.isPolicy ? "Policy" : "Page"}</td>
                  <td>v{p.version}</td>
                  <td><Badge value={p.published ? "ACTIVE" : "CLOSED"} /></td>
                  <td className="whitespace-nowrap">{fmtDate(p.updatedAt, true)}</td>
                  <td><button className="btn-outline btn-sm" onClick={() => open(p)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={slug !== null} onClose={() => setSlug(null)} title={isNew ? "New page" : `Edit ${form.title}`}>
        <form onSubmit={save} className="space-y-4">
          {isNew && (
            <Field label="Slug" hint="lowercase-with-dashes; becomes the page URL">
              <input className="input" required pattern="[a-z0-9-]+" value={slug ?? ""} onChange={(e) => setSlug(e.target.value)} />
            </Field>
          )}
          <Field label="Title"><input className="input" required minLength={2} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Body (Markdown)</span>
              <button type="button" className="btn-outline btn-sm" onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button>
            </div>
            {preview ? (
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 bg-cream p-4"><Markdown>{form.body}</Markdown></div>
            ) : (
              <textarea className="input font-mono text-xs" rows={16} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            )}
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPolicy} onChange={(e) => setForm({ ...form, isPolicy: e.target.checked })} /> Versioned policy</label>
          </div>
          {form.isPolicy && !isNew && form.body !== original && (
            <Alert kind="warning">Saving will publish a new policy version. Members&apos; earlier acceptances remain tied to the previous version.</Alert>
          )}
          {err && <Alert>{err}</Alert>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setSlug(null)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
