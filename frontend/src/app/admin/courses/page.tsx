"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { useSession } from "@/components/session";
import { Alert, Badge, Empty, Field, Modal, PageHeader, SecNo, Spinner } from "@/components/ui";
import { ImageUpload } from "@/components/ImageUpload";
import { api, fmtDate, money } from "@/lib/api";
import type { Course } from "@/lib/types";

type CourseRow = Course & { _count: { enrollments: number }; creditEligible?: boolean };
type Session = { id: string; title: string; startsAt: string; durationMins: number; instructor: string | null; liveUrl: string | null; recordingUrl: string | null; notes: string; _count: { progress: number } };
type Student = { enrollmentId: string; memberId: string; fullName: string; status: string; completed: number };

/** ISO -> value for <input type="datetime-local"> in the browser's local time. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const blankSession = { title: "", startsAt: "", durationMins: "60", instructor: "", liveUrl: "", recordingUrl: "", notes: "" };
type SessionForm = typeof blankSession;

function Timetable({ course, onClose }: { course: CourseRow; onClose: () => void }) {
  const { data, error, loading, reload } = useApi<{ sessions: Session[]; students: Student[] }>(`/admin/courses/${course.id}/sessions`);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SessionForm>(blankSession);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof SessionForm>(k: K, v: SessionForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const startEdit = (s?: Session) => {
    setErr("");
    if (!s) { setForm({ ...blankSession, instructor: course.trainer ?? "" }); setEditing("new"); return; }
    setForm({
      title: s.title, startsAt: toLocalInput(s.startsAt), durationMins: String(s.durationMins), instructor: s.instructor ?? "",
      liveUrl: s.liveUrl ?? "", recordingUrl: s.recordingUrl ?? "", notes: s.notes ?? "",
    });
    setEditing(s.id);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const when = new Date(form.startsAt);
    if (Number.isNaN(when.getTime())) { setErr("Choose a valid start date and time."); return; }
    setBusy(true);
    setErr("");
    const payload = {
      title: form.title.trim(), startsAt: when.toISOString(), durationMins: Number(form.durationMins) || 60,
      instructor: form.instructor.trim() || null, liveUrl: form.liveUrl.trim(), recordingUrl: form.recordingUrl.trim(), notes: form.notes,
    };
    try {
      if (editing === "new") await api(`/admin/courses/${course.id}/sessions`, { method: "POST", json: payload });
      else await api(`/admin/sessions/${editing}`, { method: "PUT", json: payload });
      setEditing(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Session) => {
    if (!window.confirm(`Delete session "${s.title}"? Member completion records for it will be removed.`)) return;
    setErr("");
    try {
      await api(`/admin/sessions/${s.id}`, { method: "DELETE" });
      if (editing === s.id) setEditing(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const total = data?.sessions.length ?? 0;
  return (
    <Modal open onClose={onClose} title={`Timetable · ${course.title}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-white/50">Times are shown and entered in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
          {editing === null && <button className="btn-lux btn-sm" onClick={() => startEdit()}>+ Add session</button>}
        </div>
        {error && <Alert>{error}</Alert>}
        {err && editing === null && <Alert>{err}</Alert>}

        {editing !== null && (
          <form onSubmit={save} className="grid gap-3 rounded-xl border border-gold-400/25 bg-white/[0.03] p-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2"><input className="input" required minLength={2} maxLength={150} value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Starts at"><input className="input" type="datetime-local" required value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
            <Field label="Duration (minutes)"><input className="input" type="number" min="15" max="600" step="5" required value={form.durationMins} onChange={(e) => set("durationMins", e.target.value)} /></Field>
            <Field label="Instructor"><input className="input" maxLength={120} value={form.instructor} onChange={(e) => set("instructor", e.target.value)} /></Field>
            <Field label="Live class link" hint="Zoom / Meet URL"><input className="input" type="url" placeholder="https://" value={form.liveUrl} onChange={(e) => set("liveUrl", e.target.value)} /></Field>
            <Field label="Recording link" className="sm:col-span-2"><input className="input" type="url" placeholder="https://" value={form.recordingUrl} onChange={(e) => set("recordingUrl", e.target.value)} /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea className="input" rows={2} maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className="btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-lux btn-sm" disabled={busy}>{busy ? "Saving…" : editing === "new" ? "Add session" : "Save session"}</button>
            </div>
          </form>
        )}

        <div>
          <SecNo n={1}>Sessions</SecNo>
          {loading && !data ? <Spinner /> : !data?.sessions.length ? <Empty>No sessions scheduled yet.</Empty> : (
            <div className="overflow-x-auto">
              <table className="table-x">
                <thead><tr><th>When</th><th>Session</th><th>Links</th><th>Done</th><th /></tr></thead>
                <tbody>
                  {data.sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap text-xs">{fmtDate(s.startsAt, true)}<div className="text-white/45">{s.durationMins} min</div></td>
                      <td>{s.title}<div className="text-xs text-white/45">{s.instructor ?? "—"}{s.notes ? ` · ${s.notes}` : ""}</div></td>
                      <td className="whitespace-nowrap text-xs">
                        {s.liveUrl ? <a className="text-gold-300 hover:underline" href={s.liveUrl} target="_blank" rel="noreferrer">Live</a> : <span className="text-white/30">Live</span>}
                        {" · "}
                        {s.recordingUrl ? <a className="text-gold-300 hover:underline" href={s.recordingUrl} target="_blank" rel="noreferrer">Recording</a> : <span className="text-white/30">Recording</span>}
                      </td>
                      <td className="whitespace-nowrap">{s._count.progress}{data.students.length ? <span className="text-white/45"> / {data.students.length}</span> : null}</td>
                      <td className="space-x-2 whitespace-nowrap">
                        <button className="btn-outline btn-sm" onClick={() => startEdit(s)}>Edit</button>
                        <button className="btn-outline btn-sm" onClick={() => remove(s)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <SecNo n={2}>Student progress</SecNo>
          {loading && !data ? null : !data?.students.length ? <Empty>No enrolled students yet.</Empty> : (
            <div className="overflow-x-auto">
              <table className="table-x">
                <thead><tr><th>Student</th><th>Status</th><th>Completed</th></tr></thead>
                <tbody>
                  {data.students.map((st) => {
                    const pct = total ? Math.round((st.completed / total) * 100) : 0;
                    return (
                      <tr key={st.enrollmentId}>
                        <td>{st.fullName}<div className="font-mono text-xs text-gold-300">{st.memberId}</div></td>
                        <td><Badge value={st.status} /></td>
                        <td className="min-w-[160px]">
                          <div className="text-sm text-white">{st.completed} / {total}</div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-gold-grad" style={{ width: `${pct}%` }} /></div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
type Enr = { id: string; status: string; createdAt: string; course: { title: string }; user: { memberId: string; fullName: string; email: string } };

const blank = {
  slug: "", title: "", tuition: "0", currency: "USD", duration: "", schedule: "", topics: "", syllabus: "", trainer: "",
  startDate: "", enrollmentOpen: true, disclaimer: "Financial market trading involves risk. Educational purposes only.", imageUrl: "", active: true, creditEligible: true,
};
type Form = typeof blank;
const toForm = (c: CourseRow): Form => ({
  slug: c.slug, title: c.title, tuition: String(c.tuition), currency: c.currency, duration: c.duration, schedule: c.schedule,
  topics: c.topics.join("\n"), syllabus: c.syllabus, trainer: c.trainer ?? "", startDate: c.startDate?.slice(0, 10) ?? "",
  enrollmentOpen: c.enrollmentOpen, disclaimer: c.disclaimer, imageUrl: c.imageUrl ?? "", active: c.active, creditEligible: c.creditEligible ?? true,
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
  const [timetable, setTimetable] = useState<CourseRow | null>(null);
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
        action={canEditCourses ? <button className="btn-lux" onClick={() => { setForm(blank); setErr(""); setEditing("new"); }}>New course</button> : undefined}
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
                      <h2 className="text-xl text-white">{c.title}</h2>
                      <div className="text-sm text-white/50">{money(c.tuition, c.currency)} · {c.duration} · {c.schedule}</div>
                    </div>
                    <div className="space-x-1 whitespace-nowrap">
                      <Badge value={c.active ? "ACTIVE" : "CLOSED"} />
                      <Badge value={c.enrollmentOpen ? "OPEN" : "CLOSED"} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/60">{c.syllabus}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.topics.map((t) => <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-white/70">{t}</span>)}
                    {c.creditEligible !== false && c.currency === "USD" && <span className="chip">USD credit</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-white/50">{c._count.enrollments} enrolment(s){c.startDate ? ` · starts ${fmtDate(c.startDate)}` : ""}</span>
                    <span className="space-x-2 whitespace-nowrap">
                      <button className="btn-outline btn-sm" onClick={() => setTimetable(c)}>Timetable</button>
                      <button className="btn-outline btn-sm" onClick={() => { setForm(toForm(c)); setErr(""); setEditing(c.id); }}>Edit</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-xl text-white">Enrolments</h2>
        {enrErr && <div className="mb-3"><Alert>{enrErr}</Alert></div>}
        {enr.error && <Alert>{enr.error}</Alert>}
        {enr.loading && !enr.data ? <Spinner /> : !enr.data?.enrollments.length ? <Empty>No enrolments yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead><tr><th>Member</th><th>Course</th><th>Requested</th><th>Status</th></tr></thead>
              <tbody>
                {enr.data.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td>{e.user.fullName}<div className="text-xs text-white/50">{e.user.memberId} · {e.user.email}</div></td>
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
          <label className="flex items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <label className="flex items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={form.creditEligible} onChange={(e) => set("creditEligible", e.target.checked)} /> Can be paid with USD credit</label>
          <label className="flex items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={form.enrollmentOpen} onChange={(e) => set("enrollmentOpen", e.target.checked)} /> Enrolment open</label>
          {err && <div className="sm:col-span-2"><Alert>{err}</Alert></div>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-lux" disabled={busy}>{busy ? "Saving…" : "Save course"}</button>
          </div>
        </form>
      </Modal>
      {timetable && <Timetable course={timetable} onClose={() => setTimetable(null)} />}
    </>
  );
}
