import Image from "next/image";
import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import type { Page } from "@/lib/types";
import { Markdown } from "@/components/Markdown";

export const metadata: Metadata = { title: "About World Vista" };

const ROADMAP = [
  { year: "2026", label: "Current phase", title: "Tourism Packages & Network Rollout", items: ["Flagship destinations: Dubai, Sri Lanka, Oman & Malaysia", "90-day booking window across 4 & 5-star properties"], soon: false },
  { year: "2027", label: "Tech ecosystem", title: "E-Commerce Platform", items: ["Marketplace for luxury goods, luggage & travel gear", "One-click flights, stays & activities", "Wellness line"], soon: true },
  { year: "2028+", label: "Global branding", title: "Global Brand & Luxury Delivery", items: ["World Vista luxury lifestyle brand", "Worldwide delivery of bespoke goods", "VIP membership & 24/7 concierge"], soon: true },
];

export default async function About() {
  const d = await serverApi<{ page: Page }>("/public/pages/about");
  return (
    <>
      <section className="relative isolate overflow-hidden bg-navy-950">
        <Image src="/images/dubai-wide.jpg" alt="" fill priority className="-z-10 object-cover opacity-50" sizes="100vw" />
        <div className="container-x py-24 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Who we are</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">About World Vista</h1>
        </div>
      </section>
      <div className="container-x grid gap-12 py-16 lg:grid-cols-3">
        <div className="lg:col-span-2">{d && <Markdown>{d.page.body}</Markdown>}</div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl"><Image src="/images/about.jpg" alt="Luxury villa terrace" fill className="object-cover" sizes="33vw" /></div>
      </div>
      <section className="bg-white py-16">
        <div className="container-x">
          <p className="eyebrow">Expansion trajectory</p>
          <h2 className="mt-2 text-3xl text-navy-950">Roadmap: 2026 & beyond</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ROADMAP.map((r) => (
              <div key={r.year} className={`card p-6 ${!r.soon ? "border-2 border-gold-500" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-serif text-3xl text-navy-950">{r.year}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{r.soon ? "Coming soon" : r.label}</span>
                </div>
                <h3 className="mt-4 font-sans text-lg font-semibold text-navy-950">{r.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">{r.items.map((i) => <li key={i}>• {i}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Roadmap items are plans and may change. Future services are not currently available.</p>
        </div>
      </section>
    </>
  );
}
