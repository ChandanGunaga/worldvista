"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { ActivateModal, type ActivateTarget } from "@/components/ActivateModal";
import { Alert, Badge, PageHeader, SecNo, Spinner } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";
import type { Course } from "@/lib/types";

type ClassCourse = {
  enrollmentId: string; status: string; courseId: string; title: string; schedule: string; duration: string; trainer: string | null;
  progress: { done: number; total: number; pct: number };
  sessions: { id: string; title: string; startsAt: string; durationMins: number; instructor: string | null; notes: string; liveUrl: string | null; recordingUrl: string | null; completed: boolean }[];
};

export default function MemberEducation() {
  const courses = useApi<{ courses: Course[] }>("/public/courses");
  const cat = useApi<{ courses: { id: string; creditEligible: boolean; enrollment: string | null }[] }>("/member/catalogue");
  const classes = useApi<{ courses: ClassCourse[] }>("/member/classes");
  const cfg = useApi<{ payments: boolean }>("/public/config");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [act, setAct] = useState<ActivateTarget | null>(null);
  const [now] = useState(() => Date.now());

  const reloadAll = () => { cat.reload(); classes.reload(); };
  const status = (id: string) => cat.data?.courses.find((c) => c.id === id);
  const enrolmentFor = (id: string) => classes.data?.courses.find((c) => c.courseId === id);

  async function call(fn: () => Promise<unknown>, ok?: string) {
    setMsg(null);
    try { await fn(); if (ok) setMsg({ kind: "success", text: ok }); reloadAll(); } catch (e) { setMsg({ kind: "error", text: (e as Error).message }); }
  }
  async function payFor(enrollmentId: string) {
    try {
      const r = await api<{ token: string }>(`/member/enrollments/${enrollmentId}/pay`, { method: "POST" });
      window.location.href = `/pay/${r.token}`;
    } catch (e) { setMsg({ kind: "error", text: (e as Error).message }); }
  }

  if (courses.loading) return <Spinner />;
  return (
    <>
      <PageHeader title="Academy & Classes" subtitle="Enrolment, class timetable, live links, recordings and your progress." />
      <Alert kind="warning">Financial market trading involves risk, including loss of capital. Courses are for educational purposes only and are not financial advice.</Alert>
      {msg && <div className="mt-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}

      <div className="mt-8"><SecNo n={1}>Courses</SecNo></div>
      <div className="space-y-6">
        {courses.data?.courses.map((c) => {
          const st = status(c.id);
          const e = enrolmentFor(c.id);
          const enrolled = st?.enrollment === "ENROLLED" || st?.enrollment === "COMPLETED";
          return (
            <div key={c.id} className="lux-card grid gap-6 p-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <span className="chip">{c.duration} · {c.schedule}</span>
                <h2 className="mt-3 font-serif text-3xl text-white">{c.title}</h2>
                <p className="text-sm text-white/50">{c.syllabus}</p>
                <ul className="mt-4 grid gap-1.5 text-sm text-white/70 sm:grid-cols-2">{c.topics.map((t) => <li key={t} className="flex gap-2"><span className="text-gold-400">✦</span>{t}</li>)}</ul>
                <p className="mt-4 text-xs italic text-white/40">{c.disclaimer}</p>
              </div>
              <div className="rounded-2xl border border-gold-400/25 bg-gold-400/[0.05] p-5">
                <div className="font-serif text-4xl text-gold-grad">{money(c.tuition, c.currency)}</div>
                {c.trainer && <div className="mt-1 text-sm text-white/60">Trainer: {c.trainer}</div>}
                {c.startDate && <div className="mt-1 text-sm text-white/60">Starts {fmtDate(c.startDate)}</div>}
                <div className="mt-4 space-y-2">
                  {st?.enrollment && <div className="text-sm">Status: <Badge value={st.enrollment} /></div>}
                  {enrolled && e && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-white/50"><span>Progress</span><span>{e.progress.done}/{e.progress.total} classes</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold-grad transition-all duration-700" style={{ width: `${e.progress.pct}%` }} /></div>
                    </div>
                  )}
                  {!enrolled && c.enrollmentOpen && (
                    <>
                      {st?.creditEligible && <button className="btn-lux w-full" onClick={() => setAct({ kind: "COURSE", id: c.id, name: c.title })}>Enrol with USD credit</button>}
                      {!st?.enrollment && <button className="btn-outline w-full" onClick={() => call(() => api("/member/enrollments", { method: "POST", json: { courseId: c.id } }), "Enrolment requested. Our academy team will contact you with payment and schedule details.")}>Request enrolment</button>}
                      {st?.enrollment === "REQUESTED" && cfg.data?.payments && e && <button className="btn-outline w-full" onClick={() => payFor(e.enrollmentId)}>Pay tuition online</button>}
                    </>
                  )}
                  {!enrolled && !c.enrollmentOpen && <span className="text-sm text-white/45">Enrolment closed</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {classes.data?.courses.filter((c) => c.sessions.length).map((c) => {
        const enrolled = c.status === "ENROLLED" || c.status === "COMPLETED";
        return (
          <div key={c.courseId} className="mt-10">
            <SecNo n={2}>Timetable · {c.title}</SecNo>
            {!enrolled && <div className="mb-4"><Alert kind="info">Live class links and recordings unlock once your enrolment is confirmed.</Alert></div>}
            <div className="card overflow-x-auto p-2 sm:p-4">
              <table className="table-x">
                <thead><tr><th>#</th><th>Class</th><th>Date & time</th><th>Instructor</th><th>Links</th><th>Done</th></tr></thead>
                <tbody>
                  {c.sessions.map((s, i) => {
                    const start = new Date(s.startsAt).getTime();
                    const live = now >= start - 15 * 60e3 && now <= start + s.durationMins * 60e3;
                    const past = now > start;
                    return (
                      <tr key={s.id} className={live ? "bg-gold-400/[0.06]" : undefined}>
                        <td className="font-mono text-xs text-white/40">{String(i + 1).padStart(2, "0")}</td>
                        <td><div className="text-white">{s.title}</div>{s.notes && <div className="text-xs text-white/45">{s.notes}</div>}</td>
                        <td className="whitespace-nowrap">{fmtDate(s.startsAt, true)}<div className="text-xs text-white/40">{s.durationMins} min</div></td>
                        <td>{s.instructor ?? "—"}</td>
                        <td className="space-x-2 whitespace-nowrap">
                          {s.liveUrl && (live || !past) && <a href={s.liveUrl} target="_blank" rel="noreferrer" className={live ? "btn-lux !px-3 !py-1.5 text-xs" : "btn-outline btn-sm"}>{live ? "● Join live" : "Live link"}</a>}
                          {s.recordingUrl && <a href={s.recordingUrl} target="_blank" rel="noreferrer" className="btn-outline btn-sm">Recording</a>}
                          {!s.liveUrl && !s.recordingUrl && <span className="text-xs text-white/30">{enrolled ? "Link coming soon" : "Locked"}</span>}
                        </td>
                        <td>
                          {enrolled && past ? (
                            <input type="checkbox" className="h-4 w-4 accent-gold-400" checked={s.completed} aria-label={`Mark ${s.title} complete`}
                              onChange={(ev) => call(() => api(`/member/classes/${s.id}/complete`, { method: "POST", json: { completed: ev.target.checked } }))} />
                          ) : <span className="text-xs text-white/25">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <ActivateModal target={act} onClose={() => setAct(null)} onDone={reloadAll} />
    </>
  );
}
