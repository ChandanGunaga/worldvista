import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI & Financial Markets" };

const AI = [
  { t: "Routine & rule-based tasks", d: "AI automates structured workflows, repetitive coding, customer support and administrative data entry." },
  { t: "Deterministic data processing", d: "Work built on static formulas and predictable input–output models is increasingly handled by machine-learning systems." },
  { t: "High-speed processing", d: "Computers execute repetitive analytical tasks thousands of times faster than people, without fatigue." },
];
const HUMAN = [
  { t: "Dynamic market psychology", d: "Markets are driven by human emotion — fear, greed and mass irrationality — which algorithms struggle to quantify accurately." },
  { t: "Unprecedented black-swan events", d: "Models rely on historical data. Novel macroeconomic or geopolitical shocks can break strategies that were over-fitted to the past." },
  { t: "Discretionary risk & adaptability", d: "Managing risk well calls for flexible judgement, context and real-time strategic pivots." },
];

export default function AiMarkets() {
  return (
    <div className="container-x py-16">
      <p className="eyebrow">Education · Perspective</p>
      <h1 className="mt-2 max-w-3xl text-4xl text-navy-950">Why AI changes jobs — and why human judgement still matters in markets</h1>
      <p className="mt-4 max-w-2xl text-slate-600">This article presents World Vista&apos;s educational viewpoint. Algorithmic and AI-driven trading is widespread; nothing here is a claim that AI cannot trade or that human traders will profit.</p>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automation</p>
          <h2 className="mt-1 text-2xl text-navy-950">How AI replaces traditional roles</h2>
          <ol className="mt-6 space-y-4">{AI.map((a, i) => <li key={a.t} className="rounded-xl bg-slate-50 p-4"><div className="font-semibold text-navy-950">{i + 1}. {a.t}</div><p className="mt-1 text-sm text-slate-600">{a.d}</p></li>)}</ol>
        </section>
        <section className="card border-gold-500 p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">The human edge</p>
          <h2 className="mt-1 text-2xl text-navy-950">Where markets resist automation</h2>
          <ol className="mt-6 space-y-4">{HUMAN.map((a, i) => <li key={a.t} className="rounded-xl bg-gold-50 p-4"><div className="font-semibold text-gold-700">{i + 1}. {a.t}</div><p className="mt-1 text-sm text-slate-700">{a.d}</p></li>)}</ol>
        </section>
      </div>
      <p className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600"><strong>Disclaimer:</strong> Financial market trading involves risk. Educational purposes only. This is not investment advice.</p>
    </div>
  );
}
