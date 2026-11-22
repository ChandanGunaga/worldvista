"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { ImageUpload } from "@/components/ImageUpload";
import { api, money } from "@/lib/api";
import type { TourPackage } from "@/lib/types";

type Row = TourPackage & { _count: { enquiries: number } };

const blank = {
  slug: "", name: "", destination: "", price: "0", currency: "USD", chargeNote: "+ service charge", nights: "3", days: "4",
  summary: "", description: "", hotelCategory: "", tag: "", validityDays: "90", inclusions: "", exclusions: "", imageUrl: "",
  availableFrom: "", availableTo: "", cancellationPolicy: "", active: true, verified: false, sortOrder: "0",
};
type Form = typeof blank;

const toForm = (p: TourPackage): Form => ({
  slug: p.slug, name: p.name, destination: p.destination, price: String(p.price), currency: p.currency, chargeNote: p.chargeNote,
  nights: String(p.nights), days: String(p.days), summary: p.summary, description: p.description, hotelCategory: p.hotelCategory,
  tag: p.tag ?? "", validityDays: p.validityDays == null ? "" : String(p.validityDays), inclusions: p.inclusions.join("\n"),
  exclusions: p.exclusions.join("\n"), imageUrl: p.imageUrl ?? "", availableFrom: p.availableFrom?.slice(0, 10) ?? "",
  availableTo: p.availableTo?.slice(0, 10) ?? "", cancellationPolicy: p.cancellationPolicy, active: p.active, verified: p.verified, sortOrder: String(p.sortOrder),
});

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export default function PackagesPage() {
  const { data, error, loading, reload } = useApi<{ packages: Row[] }>("/admin/packages");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const payload = {
      ...form,
      tag: form.tag || null,
      validityDays: form.validityDays === "" ? null : form.validityDays,
      inclusions: lines(form.inclusions),
      exclusions: lines(form.exclusions),
      imageUrl: form.imageUrl.trim(),
      availableFrom: form.availableFrom || null,
      availableTo: form.availableTo || null,
    };
    try {
      if (editing === "new") await api("/admin/packages", { method: "POST", json: payload });
      else await api(`/admin/packages/${editing}`, { method: "PUT", json: payload });
      setEditing(null);
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
        title="Tour packages"
        subtitle="Destination cards shown on the public Tourism page"
        action={<button className="btn-gold" onClick={() => { setForm(blank); setErr(""); setEditing("new"); }}>New package</button>}
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : !data?.packages.length ? <Empty>No packages yet.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>#</th><th>Package</th><th>Price</th><th>Duration</th><th>Category</th><th>Enquiries</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.packages.map((p) => (
                <tr key={p.id}>
                  <td>{p.sortOrder}</td>
                  <td className="font-medium text-navy-950">{p.name}<div className="text-xs font-normal text-slate-500">/{p.slug}</div></td>
                  <td className="whitespace-nowrap">{money(p.price, p.currency)} <span className="text-xs text-slate-500">{p.chargeNote}</span></td>
                  <td className="whitespace-nowrap">{p.nights}N / {p.days}D</td>
                  <td>{p.tag ?? p.hotelCategory}</td>
                  <td>{p._count.enquiries}</td>
                  <td className="space-x-1 whitespace-nowrap">
                    <Badge value={p.active ? "ACTIVE" : "CLOSED"} />
                    {!p.verified && <Badge value="PENDING_VERIFICATION" />}
                  </td>
                  <td><button className="btn-outline btn-sm" onClick={() => { setForm(toForm(p)); setErr(""); setEditing(p.id); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New package" : `Edit ${form.name}`}>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Slug" hint="lowercase-with-dashes"><input className="input" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Destination"><input className="input" required value={form.destination} onChange={(e) => set("destination", e.target.value)} /></Field>
          <Field label="Hotel category"><input className="input" required value={form.hotelCategory} onChange={(e) => set("hotelCategory", e.target.value)} /></Field>
          <Field label="Price"><input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Currency"><input className="input" maxLength={3} required value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field>
          <Field label="Charge note"><input className="input" value={form.chargeNote} onChange={(e) => set("chargeNote", e.target.value)} /></Field>
          <Field label="Tag (card label)"><input className="input" value={form.tag} onChange={(e) => set("tag", e.target.value)} /></Field>
          <Field label="Nights"><input className="input" type="number" min="0" required value={form.nights} onChange={(e) => set("nights", e.target.value)} /></Field>
          <Field label="Days"><input className="input" type="number" min="1" required value={form.days} onChange={(e) => set("days", e.target.value)} /></Field>
          <Field label="Validity (days)" hint="Leave empty if not applicable"><input className="input" type="number" min="0" value={form.validityDays} onChange={(e) => set("validityDays", e.target.value)} /></Field>
          <Field label="Sort order"><input className="input" type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></Field>
          <Field label="Available from"><input className="input" type="date" value={form.availableFrom} onChange={(e) => set("availableFrom", e.target.value)} /></Field>
          <Field label="Available to"><input className="input" type="date" value={form.availableTo} onChange={(e) => set("availableTo", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Image" hint="Upload a JPEG/PNG/WebP (max 5 MB, ideally 1600px+ wide), or paste a URL / path like /images/packages/oman.jpg">
              <div className="flex flex-wrap items-center gap-3">
                <input className="input flex-1" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
                <ImageUpload onUploaded={(url) => set("imageUrl", url)} />
              </div>
            </Field>
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="Preview" className="mt-2 h-28 rounded-lg object-cover" />
            )}
          </div>
          <Field label="Summary (card highlights)" className="sm:col-span-2"><textarea className="input" rows={2} required minLength={5} value={form.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
          <Field label="Description / itinerary" className="sm:col-span-2"><textarea className="input" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Inclusions (one per line)"><textarea className="input" rows={5} value={form.inclusions} onChange={(e) => set("inclusions", e.target.value)} /></Field>
          <Field label="Exclusions (one per line)"><textarea className="input" rows={5} value={form.exclusions} onChange={(e) => set("exclusions", e.target.value)} /></Field>
          <Field label="Cancellation / refund policy" className="sm:col-span-2"><textarea className="input" rows={3} value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active (visible publicly)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.verified} onChange={(e) => set("verified", e.target.checked)} /> Details verified with supplier</label>
          {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Save package"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
