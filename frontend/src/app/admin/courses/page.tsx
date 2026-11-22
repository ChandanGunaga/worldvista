"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { useSession } from "@/components/session";
import { Alert, Badge, Empty, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { ImageUpload } from "@/components/ImageUpload";
import { api, fmtDate, money } from "@/lib/api";
import type { Course } from "@/lib/types";

type CourseRow = Course & { _count: { enrollments: number } };
type Enr = { id: string; status: string; createdAt: string; course: { title: string }; user: { memberId: string; fullName: string; email: string } };

const blank = {
  slug: "", title: "", tuition: "0", currency: "USD", duration: "", schedule: "", topics: "", syllabus: "", trainer: "",
  startDate: "", enrollmentOpen: true, disclaimer: "Financial market trading involves risk. Educational purposes only.", imageUrl: "", active: true,
};
type Form = typeof blank;
const toForm = (c: Course): Form => ({
  slug: c.slug, title: c.title, tuition: String(c.tuition), currency: c.currency, duration: c.duration, schedule: c.schedule,
  topics: c.topics.join("\n"), syllabus: c.syllabus, trainer: c.trainer ?? "", startDate: c.startDate?.slice(0, 10) ?? "",
  enrollmentOpen: c.enrollmentOpen, disclaimer: c.disclaimer, imageUrl: c.imageUrl ?? "", active: c.active,
});
const ENR_STATUSES = ["REQUESTED", "ENROLLED", "COMPLETED", "CANCELLED"];

export default function CoursesPage() {
  const { user } = useSession();
  const canEditCourses = user?.role === "SUPER_ADMIN" || user?.role === "CONTENT_ADMIN";
  const courses = useApi<{ courses: CourseRow[] }>(canEditCourses ? "/admin/courses" : null);
  const enr = useApi<{ enrollments: Enr[] }>("/admin/enrollments");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [enrErr, setEnrErr] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const payload = {
      ...form,
      topics: form.topics.split("\n").map((t) => t.trim()).filter(Boolean),
      trainer: form.trainer || null,
      startDate: form.startDate || null,
      imageUrl: form.imageUrl.trim(),
    };
    try {
      if (editing === "new") await api("/admin/courses", { method: "POST", json: payload });
      else await api(`/admin/courses/${editing}`, { method: "PUT", json: payload });
      setEditing(null);
      courses.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setEnrStatus = async (id: string, status: string) => {
    setEnrErr("");
    try {
      await api(`/admin/enrollments/${id}/status`, { method: "POST", json: { status } });
      enr.reload();
    } catch (e) {
      setEnrErr((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Courses & enrolments"
        action={canEditCourses ? <button className="btn-gold" onClick={() => { setForm(blank); setErr(""); setEditing("new"); }}>New course</button> : undefined}
      />
      {canEditCourses && (
        <section className="mb-8">
          {courses.error && <Alert>{courses.error}</Alert>}
          {courses.loading && !courses.data ? <Spinner /> : !courses.data?.courses.length ? <Empty>No courses yet.</Empty> : (
            <div className="grid gap-4 md:grid-cols-2">
              {courses.data.courses.map((c) => (
                <div key={c.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl text-navy-950">{c.title}</h2>
                      <div className="text-sm text-slate-500">{money(c.tuition, c.currency)} · {c.duration} · {c.schedule}</div>
                    </div>
                    <div className="space-x-1 whitespace-nowrap">
                      <Badge value={c.active ? "ACTIVE" : "CLOSED"} />
                      <Badge value={c.enrollmentOpen ? "OPEN" : "CLOSED"} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{c.syllabus}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.topics.map((t) => <span key={t} className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-slate-700">{t}</span>)}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-slate-500">{c._count.enrollments} enrolment(s){c.startDate ? ` · starts ${fmtDate(c.startDate)}` : ""}</span>
                    <button className="btn-outline btn-sm" onClick={() => { setForm(toForm(c)); setErr(""); setEditing(c.id); }}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-xl text-navy-950">Enrolments</h2>
        {enrErr && <div className="mb-3"><Alert>{enrErr}</Alert></div>}
        {enr.error && <Alert>{enr.error}</Alert>}
        {enr.loading && !enr.data ? <Spinner /> : !enr.data?.enrollments.length ? <Empty>No enrolments yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead><tr><th>Member</th><th>Course</th><th>Requested</th><th>Status</th></tr></thead>
              <tbody>
                {enr.data.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td>{e.user.fullName}<div className="text-xs text-slate-500">{e.user.memberId} · {e.user.email}</div></td>
                    <td>{e.course.title}</td>
                    <td className="whitespace-nowrap">{fmtDate(e.createdAt, true)}</td>
                    <td>
                      <select className="input py-1.5" value={e.status} onChange={(ev) => setEnrStatus(e.id, ev.target.value)} aria-label="Enrolment status">
                        {ENR_STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New course" : `Edit ${form.title}`}>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Title"><input className="input" required value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Slug"><input className="input" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Tuition"><input className="input" type="number" min="0" step="0.01" required value={form.tuition} onChange={(e) => set("tuition", e.target.value)} /></Field>
          <Field label="Currency"><input className="input" maxLength={3} value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field>
          <Field label="Duration"><input className="input" required value={form.duration} onChange={(e) => set("duration", e.target.value)} /></Field>
          <Field label="Schedule"><input className="input" required value={form.schedule} onChange={(e) => set("schedule", e.target.value)} /></Field>
          <Field label="Trainer"><input className="input" value={form.trainer} onChange={(e) => set("trainer", e.target.value)} /></Field>
          <Field label="Start date"><input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
          <Field label="Syllabus summary" className="sm:col-span-2"><input className="input" required value={form.syllabus} onChange={(e) => set("syllabus", e.target.value)} /></Field>
          <Field label="Topics (one per line)" className="sm:col-span-2"><textarea className="input" rows={5} value={form.topics} onChange={(e) => set("topics", e.target.value)} /></Field>
          <Field label="Risk disclaimer" className="sm:col-span-2"><textarea className="input" rows={2} required minLength={10} value={form.disclaimer} onChange={(e) => set("disclaimer", e.target.value)} /></Field>
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
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enrollmentOpen} onChange={(e) => set("enrollmentOpen", e.target.checked)} /> Enrolment open</label>
          {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Save course"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
