import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import type { Page } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { PageHero } from "@/components/lux/PageHero";
import { Reveal } from "@/components/lux/Reveal";
import { SectionHead } from "@/components/lux/SectionHead";

export const metadata: Metadata = { title: "About World Vista" };

const MVV = [
  { icon: "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z", t: "Mission", d: "To inspire a more meaningful life by making world-class travel and practical learning accessible, transparent and genuinely enriching." },
  { icon: "M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z", t: "Vision", d: "To become a trusted global lifestyle brand, known for curated journeys, thoughtful education and exceptional care for every member." },
  { icon: "M6 3h12l4 6-10 12L2 9z", t: "Values", d: "Integrity, transparency and excellence. We confirm every detail in writing, never over-promise and treat every traveller like family." },
];
const VALUES = ["Integrity", "Transparency", "Excellence", "Care", "Curiosity", "Global outlook"];
const ROADMAP = [
  { y: "2026", label: "Now live", t: "Tourism Packages & Network Rollout", items: ["Flagship destinations: Dubai, Sri Lanka, Oman & Malaysia", "90-day booking window across 4 & 5-star properties"], now: true },
  { y: "2027", label: "Coming soon", t: "E-Commerce Platform", items: ["Marketplace for luxury goods, luggage & travel gear", "One-click flights, stays & activities", "Wellness line"], now: false },
  { y: "2028+", label: "Coming soon", t: "Global Brand & Luxury Delivery", items: ["World Vista luxury lifestyle brand", "Worldwide delivery of bespoke goods", "VIP membership & 24/7 concierge"], now: false },
];

export default async function About() {
  const d = await serverApi<{ page: Page }>("/public/pages/about");
  return (
    <>
      <PageHero chip="About us" title={<>A more <span className="text-gold-grad italic">meaningful</span> life</>} sub="World Vista brings together curated luxury travel and practical financial-markets education under one trusted brand." />

      <section className="container-x grid items-center gap-16 py-28 lg:grid-cols-2">
        <Reveal variant="left" className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10">
          <Image src="/images/about.jpg" alt="Luxury villa terrace" fill className="object-cover" sizes="(max-width:1024px) 100vw, 45vw" />
        </Reveal>
        <Reveal variant="right">
          <span className="chip">Our story</span>
          <h2 className="lux-title mt-5">Who <span className="text-gold-grad italic">we are</span></h2>
          <div className="mt-6">{d && <Markdown>{d.page.body}</Markdown>}</div>
          <Link href="/contact" className="btn-lux mt-8">Contact us</Link>
        </Reveal>
      </section>

      <section className="relative py-24">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-gold-500/[0.07] blur-[130px]" />
        <div className="container-x relative">
          <SectionHead chip="What drives us" title={<>Purpose, <span className="text-gold-grad italic">promise</span> & principles</>} />
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {MVV.map((m, i) => (
              <Reveal key={m.t} delay={i * 120} className="h-full">
                <div className="lux-card lux-hover h-full p-10 text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/30 bg-gold-400/10">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F2D266" strokeWidth="1.5" strokeLinejoin="round"><path d={m.icon} /></svg>
                  </div>
                  <h3 className="mt-6 font-sans text-2xl font-bold uppercase tracking-[0.12em] text-white">{m.t}</h3>
                  <p className="mt-4 leading-relaxed text-white/60">{m.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 flex flex-wrap justify-center gap-3">
            {VALUES.map((v) => <span key={v} className="rounded-full border border-white/10 bg-onyx-800 px-5 py-2 text-sm text-white/75"><span className="mr-2 text-gold-400">✦</span>{v}</span>)}
          </Reveal>
        </div>
      </section>

      <section className="relative isolate overflow-hidden py-28">
        <Image src="/images/dubai-wide.jpg" alt="" fill className="-z-10 object-cover opacity-20" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-onyx-900 via-onyx-900/80 to-onyx-900" />
        <div className="container-x">
          <SectionHead chip="Expansion trajectory" title={<>Roadmap: <span className="text-gold-grad">2026 & beyond</span></>} />
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {ROADMAP.map((r, i) => (
              <Reveal key={r.y} delay={i * 140} className="h-full">
                <div className={`${r.now ? "lux-card-gold" : "lux-card"} lux-hover h-full p-8`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gold-grad font-serif text-5xl">{r.y}</span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${r.now ? "bg-gold-400/15 text-gold-200" : "bg-white/5 text-white/45"}`}>{r.label}</span>
                  </div>
                  <h3 className="mt-6 font-sans text-xl font-semibold text-white">{r.t}</h3>
                  <ul className="mt-4 space-y-3 text-sm text-white/60">{r.items.map((it) => <li key={it} className="flex gap-3"><span className="text-gold-400">✦</span>{it}</li>)}</ul>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-white/35">Roadmap items are plans and may change. Future services are not currently available.</p>
        </div>
      </section>
    </>
  );
}
