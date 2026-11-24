"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Alert, Field } from "./ui";

type Option = { id: string; name: string };

export function EnquiryForm({
  type,
  packages = [],
  defaultPackageId,
  courseId,
  title = "Send an enquiry",
}: {
  type: "TOUR" | "COURSE" | "GENERAL";
  packages?: Option[];
  defaultPackageId?: string;
  courseId?: string;
  title?: string;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", packageId: defaultPackageId ?? "", travellers: "2", preferredDate: "", message: "", website: "" });
  const [status, setStatus] = useState<{ kind: "error" | "success"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const r = await api<{ reference: string }>("/public/enquiries", {
        method: "POST",
        json: {
          type,
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          message: form.message,
          website: form.website || undefined,
          ...(type === "TOUR" ? { packageId: form.packageId, travellers: Number(form.travellers), preferredDate: form.preferredDate || undefined } : {}),
          ...(type === "COURSE" ? { courseId } : {}),
        },
      });
      setStatus({ kind: "success", msg: `Thank you! Your reference is ${r.reference}. We'll be in touch within 1–2 business days.` });
      setForm({ ...form, message: "" });
    } catch (err) {
      setStatus({ kind: "error", msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="lux-card-gold space-y-5 p-7 sm:p-10">
      <div>
        <span className="chip">Enquiry</span>
        <h3 className="mt-4 font-serif text-3xl text-white">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="input" required value={form.name} onChange={set("name")} autoComplete="name" /></Field>
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></Field>
        <Field label="Phone / WhatsApp"><input className="input" value={form.phone} onChange={set("phone")} autoComplete="tel" /></Field>
        {type === "TOUR" && (
          <>
            <Field label="Package">
              <select className="input" required value={form.packageId} onChange={set("packageId")}>
                <option value="">Select a package</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Travellers"><input className="input" type="number" min={1} max={50} value={form.travellers} onChange={set("travellers")} /></Field>
            <Field label="Preferred departure"><input className="input" type="date" value={form.preferredDate} onChange={set("preferredDate")} /></Field>
          </>
        )}
      </div>
      <Field label="Message"><textarea className="input min-h-24" value={form.message} onChange={set("message")} placeholder="Tell us about your plans…" /></Field>
      {/* Honeypot: hidden from humans */}
      <input type="text" name="website" value={form.website} onChange={set("website")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      {status && <Alert kind={status.kind}>{status.msg}</Alert>}
      <button className="btn-lux w-full sm:w-auto" disabled={busy}>{busy ? "Sending…" : "Send enquiry"}</button>
      <p className="text-xs text-slate-500">Prices exclude service charges. Availability, hotels and itinerary are confirmed in writing before booking.</p>
    </form>
  );
}
