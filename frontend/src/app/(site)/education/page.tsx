import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { serverApi, money } from "@/lib/api";
import type { Course } from "@/lib/types";
import { EnquiryForm } from "@/components/EnquiryForm";
import { PageHero } from "@/components/lux/PageHero";
import { Reveal } from "@/components/lux/Reveal";
import { SectionHead } from "@/components/lux/SectionHead";

export const metadata: Metadata = { title: "World Vista Academy" };

const MARKET = [
  { t: "Global access", d: "Major currency markets operate 24 hours a day, 5 days a week across global financial hubs." },
  { t: "Deep liquidity", d: "High trading volume generally allows rapid order execution, though slippage and gaps still occur." },
  { t: "Broad participation", d: "Central banks, institutions, corporations and retail traders all take part." },
];
const SKILLS = ["Risk management and position sizing", "Market structure and price action", "Trading psychology and discipline", "Building and journaling a trading plan"];

export default async function Education() {
  const data = await serverApi<{ courses: Course[] }>("/public/courses");
  const courses = data?.courses ?? [];
  return (
    <>
      <PageHero chip="World Vista Academy" image="/images/education.jpg" title={<>Financial Markets <span className="text-gold-grad italic">Education</span></>} sub="A structured basic-to-advanced programme that teaches how markets work and how professionals manage risk." />

      <section className="container-x py-24">
        <Reveal>
          <div role="note" className="rounded-2xl border border-gold-500/30 bg-gold-400/[0.06] px-6 py-4 text-sm text-gold-100">
            <strong className="text-gold-200">Risk disclaimer:</strong> Financial market trading involves risk, including loss of capital. Our courses are for educational purposes only and are not financial advice. <Link href="/legal/education-risk" className="underline">Read more</Link>
          </div>
        </Reveal>

        {courses.map((c) => (
          <div key={c.id} className="mt-14 grid items-center gap-12 lg:grid-cols-2">
            <Reveal variant="left" className="space-y-6">
              <div className="lux-card-gold p-8">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-gold-300">Academy tuition</div>
                <div className="text-gold-grad mt-2 font-serif text-6xl">{money(c.tuition, c.currency)}</div>
                <div className="mt-2 text-white/65">{c.duration} · {c.schedule}</div>
                {c.trainer && <div className="mt-1 text-sm text-white/45">Trainer: {c.trainer}</div>}
              </div>
              <div className="lux-card p-8">
                <h2 className="font-serif text-2xl text-white">{c.title}</h2>
                <p className="mt-1 text-sm text-white/45">{c.syllabus}</p>
                <ul className="mt-6 grid gap-3 text-sm text-white/75 sm:grid-cols-2">{c.topics.map((t) => <li key={t} className="flex gap-3"><span className="text-gold-400">✦</span>{t}</li>)}</ul>
              </div>
              <p className="text-sm italic text-white/40">Disclaimer: {c.disclaimer}</p>
              <div className="flex flex-wrap gap-4">
                {c.enrollmentOpen ? <Link href="/dashboard/education" className="btn-lux">Enrol as a member</Link> : <span className="btn-lux-outline">Enrolment closed</span>}
                <a href="#course-enquiry" className="btn-lux-outline">Ask a question</a>
              </div>
            </Reveal>
            <Reveal variant="right" className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10">
              <Image src={c.imageUrl ?? "/images/education.jpg"} unoptimized={!!c.imageUrl?.startsWith("/uploads/")} alt="" fill className="object-cover" sizes="(max-width:1024px) 100vw, 45vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-onyx-950/70 to-transparent" />
            </Reveal>
          </div>
        ))}
      </section>

      <section className="border-y border-white/[0.06] bg-onyx-950/60 py-24">
        <div className="container-x grid gap-14 lg:grid-cols-2">
          <div>
            <SectionHead center={false} chip="Foundations" title={<>Understanding the <span className="text-gold-grad italic">market</span></>} sub="The foreign-exchange market is the world's largest and most liquid financial market." />
            <div className="mt-8 space-y-4">{MARKET.map((m, i) => <Reveal key={m.t} delay={i * 100}><div className="lux-card lux-hover p-6"><div className="font-semibold text-white">{m.t}</div><p className="mt-1 text-sm text-white/55">{m.d}</p></div></Reveal>)}</div>
          </div>
          <div>
            <SectionHead center={false} chip="Curriculum" title={<>Skills you&apos;ll <span className="text-gold-grad italic">practise</span></>} />
            <ul className="mt-8 space-y-4">{SKILLS.map((s, i) => <Reveal as="li" key={s} delay={i * 100}><div className="lux-card lux-hover flex items-center gap-5 p-6 text-white/80"><span className="text-gold-grad font-serif text-3xl">0{i + 1}</span>{s}</div></Reveal>)}</ul>
            <Link href="/ai-markets" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-gold-300">Read: AI & financial markets →</Link>
          </div>
        </div>
      </section>

      {courses[0] && (
        <section id="course-enquiry" className="container-x max-w-3xl scroll-mt-32 py-24">
          <Reveal><EnquiryForm type="COURSE" courseId={courses[0].id} title="Course enquiry" /></Reveal>
        </section>
      )}
    </>
  );
}
