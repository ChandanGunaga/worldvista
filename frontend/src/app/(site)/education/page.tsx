import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { serverApi, money } from "@/lib/api";
import type { Course } from "@/lib/types";
import { EnquiryForm } from "@/components/EnquiryForm";

export const metadata: Metadata = { title: "Financial Markets Education" };

const MARKET = [
  { t: "Global access", d: "Major currency markets operate 24 hours a day, 5 days a week across global financial hubs." },
  { t: "Deep liquidity", d: "High trading volume generally allows rapid order execution — though slippage and gaps still occur." },
  { t: "Broad participation", d: "Central banks, institutions, corporations and retail traders all take part." },
];
const SKILLS = ["Risk management and position sizing", "Market structure and price action", "Trading psychology and discipline", "Building and journaling a trading plan"];

export default async function Education() {
  const data = await serverApi<{ courses: Course[] }>("/public/courses");
  const courses = data?.courses ?? [];
  return (
    <div className="container-x py-16">
      <p className="eyebrow">Learn</p>
      <h1 className="mt-2 text-4xl text-navy-950">Financial Markets Education</h1>
      <p className="mt-3 max-w-2xl text-slate-600">A structured, basic-to-advanced programme that teaches how markets work and how professionals manage risk.</p>

      <div role="note" className="mt-6 rounded-xl border border-gold-300 bg-gold-50 px-5 py-3 text-sm text-gold-700">
        <strong>Risk disclaimer:</strong> Financial market trading involves risk, including loss of capital. Our courses are for educational purposes only and are not financial advice. <Link href="/legal/education-risk" className="underline">Read more</Link>
      </div>

      {courses.map((c) => (
        <div key={c.id} className="mt-10 grid items-start gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="card p-6">
              <div className="eyebrow">Academy tuition</div>
              <div className="mt-1 font-serif text-5xl text-navy-950">{money(c.tuition, c.currency)}</div>
              <div className="mt-1 text-slate-600">{c.duration} · {c.schedule}</div>
              {c.trainer && <div className="mt-1 text-sm text-slate-500">Trainer: {c.trainer}</div>}
            </div>
            <div className="card border-l-4 border-l-gold-600 p-6">
              <h2 className="font-sans text-lg font-semibold text-navy-950">{c.title}</h2>
              <p className="text-sm text-slate-500">{c.syllabus}</p>
              <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">{c.topics.map((t) => <li key={t}>• {t}</li>)}</ul>
            </div>
            <p className="text-sm italic text-slate-500">Disclaimer: {c.disclaimer}</p>
            <div className="flex flex-wrap gap-3">
              {c.enrollmentOpen ? <Link href="/dashboard/education" className="btn-navy">Enrol as a member</Link> : <span className="btn-outline">Enrolment closed</span>}
              <a href="#course-enquiry" className="btn-outline">Ask a question</a>
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl"><Image src={c.imageUrl ?? "/images/education.jpg"} unoptimized={!!c.imageUrl?.startsWith("/uploads/")} alt="" fill className="object-cover" sizes="50vw" /></div>
        </div>
      ))}

      <div className="mt-20 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl text-navy-950">Understanding the market</h2>
          <p className="mt-2 text-slate-600">The foreign-exchange market is the world&apos;s largest and most liquid financial market.</p>
          <div className="mt-5 space-y-3">{MARKET.map((m) => <div key={m.t} className="card p-4"><div className="font-semibold text-navy-950">{m.t}</div><p className="text-sm text-slate-600">{m.d}</p></div>)}</div>
        </div>
        <div>
          <h2 className="text-2xl text-navy-950">Skills you&apos;ll practise</h2>
          <ul className="mt-5 space-y-3">{SKILLS.map((s) => <li key={s} className="card p-4 text-slate-700">{s}</li>)}</ul>
          <Link href="/ai-markets" className="mt-5 inline-block text-sm font-semibold text-navy-700 underline">Read: AI & Financial Markets →</Link>
        </div>
      </div>

      {courses[0] && (
        <div id="course-enquiry" className="mx-auto mt-16 max-w-3xl scroll-mt-24">
          <EnquiryForm type="COURSE" courseId={courses[0].id} title="Course enquiry" />
        </div>
      )}
    </div>
  );
}
