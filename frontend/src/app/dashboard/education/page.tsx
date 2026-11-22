"use client";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";
import type { Course } from "@/lib/types";

type Enrollment = { id: string; status: string; createdAt: string; course: Course };

export default function MemberEducation() {
  const courses = useApi<{ courses: Course[] }>("/public/courses");
  const enr = useApi<{ enrollments: Enrollment[] }>("/member/enrollments");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const cfg = useApi<{ payments: boolean }>("/public/config");

  async function payFor(enrollmentId: string) {
    setMsg(null);
    try {
      const r = await api<{ token: string }>(`/member/enrollments/${enrollmentId}/pay`, { method: "POST" });
      window.location.href = `/pay/${r.token}`;
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  const enrolledIn = new Map(enr.data?.enrollments.map((e) => [e.course.id, e]) ?? []);

  async function enroll(id: string) {
    setMsg(null);
    try {
      await api("/member/enrollments", { method: "POST", json: { courseId: id } });
      setMsg({ kind: "success", text: "Enrolment requested. Our academy team will contact you with payment and schedule details." });
      enr.reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  if (courses.loading) return <Spinner />;
  return (
    <>
      <PageHeader title="Financial Education" subtitle="Course details and your enrolment status." />
      <Alert kind="warning">Financial market trading involves risk, including loss of capital. Courses are for educational purposes only and are not financial advice.</Alert>
      {msg && <div className="mt-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      <div className="mt-6 space-y-6">
        {courses.data?.courses.map((c) => {
          const e = enrolledIn.get(c.id);
          return (
            <div key={c.id} className="card grid gap-6 p-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <h2 className="text-2xl text-navy-950">{c.title}</h2>
                <p className="text-sm text-slate-500">{c.syllabus}</p>
                <ul className="mt-4 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">{c.topics.map((t) => <li key={t}>• {t}</li>)}</ul>
                <p className="mt-4 text-xs italic text-slate-500">{c.disclaimer}</p>
              </div>
              <div className="rounded-xl bg-cream p-5">
                <div className="font-serif text-4xl text-navy-950">{money(c.tuition, c.currency)}</div>
                <div className="text-sm text-slate-600">{c.duration} · {c.schedule}</div>
                {c.trainer && <div className="mt-1 text-sm text-slate-600">Trainer: {c.trainer}</div>}
                {c.startDate && <div className="mt-1 text-sm text-slate-600">Starts {fmtDate(c.startDate)}</div>}
                <div className="mt-4">
                  {e ? (
                    <div className="space-y-3">
                      <div className="text-sm">Status: <Badge value={e.status} /></div>
                      {e.status === "REQUESTED" && cfg.data?.payments && <button className="btn-gold w-full" onClick={() => payFor(e.id)}>Pay tuition & confirm</button>}
                    </div>
                  )
                    : c.enrollmentOpen ? <button className="btn-navy w-full" onClick={() => enroll(c.id)}>Request enrolment</button>
                    : <span className="text-sm text-slate-500">Enrolment closed</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
