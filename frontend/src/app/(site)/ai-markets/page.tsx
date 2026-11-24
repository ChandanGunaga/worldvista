import type { Metadata } from "next";
import { PageHero } from "@/components/lux/PageHero";
import { Reveal } from "@/components/lux/Reveal";

export const metadata: Metadata = { title: "AI & Financial Markets" };

const AI = [
  { t: "Routine & rule-based tasks", d: "AI automates structured workflows, repetitive coding, customer support and administrative data entry." },
  { t: "Deterministic data processing", d: "Work built on static formulas and predictable input–output models is increasingly handled by machine-learning systems." },
  { t: "High-speed processing", d: "Computers execute repetitive analytical tasks thousands of times faster than people, without fatigue." },
];
const HUMAN = [
  { t: "Dynamic market psychology", d: "Markets are driven by human emotion (fear, greed and mass irrationality), which algorithms struggle to quantify accurately." },
  { t: "Unprecedented black-swan events", d: "Models rely on historical data. Novel macroeconomic or geopolitical shocks can break strategies that were over-fitted to the past." },
  { t: "Discretionary risk & adaptability", d: "Managing risk well calls for flexible judgement, context and real-time strategic pivots." },
];

export default function AiMarkets() {
  return (
    <>
      <PageHero chip="Insights · Perspective" image="/images/education.jpg" title={<>Why AI changes jobs, and why <span className="text-gold-grad italic">human judgement</span> still matters</>} sub="World Vista's educational viewpoint. Algorithmic trading is widespread; nothing here claims AI cannot trade or that human traders will profit." />
      <section className="container-x grid gap-8 py-24 lg:grid-cols-2">
        <Reveal variant="left" className="h-full">
          <div className="lux-card h-full p-8 sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">Automation</p>
            <h2 className="mt-2 font-serif text-3xl text-white">How AI replaces traditional roles</h2>
            <ol className="mt-8 space-y-4">{AI.map((a, i) => <li key={a.t} className="rounded-2xl border border-white/[0.06] bg-onyx-900/60 p-5"><div className="font-semibold text-white"><span className="mr-3 font-serif text-white/30">0{i + 1}</span>{a.t}</div><p className="mt-2 text-sm text-white/55">{a.d}</p></li>)}</ol>
          </div>
        </Reveal>
        <Reveal variant="right" className="h-full">
          <div className="lux-card-gold h-full p-8 sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gold-300">The human edge</p>
            <h2 className="mt-2 font-serif text-3xl text-white">Where markets resist automation</h2>
            <ol className="mt-8 space-y-4">{HUMAN.map((a, i) => <li key={a.t} className="rounded-2xl border border-gold-500/20 bg-gold-400/[0.05] p-5"><div className="font-semibold text-gold-200"><span className="text-gold-grad mr-3 font-serif">0{i + 1}</span>{a.t}</div><p className="mt-2 text-sm text-white/65">{a.d}</p></li>)}</ol>
          </div>
        </Reveal>
      </section>
      <div className="container-x pb-24">
        <p className="rounded-2xl border border-white/[0.08] bg-onyx-800 px-6 py-4 text-sm text-white/55"><strong className="text-white">Disclaimer:</strong> Financial market trading involves risk. Educational purposes only. This is not investment advice.</p>
      </div>
    </>
  );
}
