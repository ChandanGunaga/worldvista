import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import type { TourPackage } from "@/lib/types";
import { PackageCard } from "@/components/PackageCard";
import { EnquiryForm } from "@/components/EnquiryForm";
import { PageHero } from "@/components/lux/PageHero";
import { Reveal } from "@/components/lux/Reveal";
import { SectionHead } from "@/components/lux/SectionHead";

export const metadata: Metadata = { title: "Journeys" };

const STEPS = [
  ["Choose", "Pick a signature journey or tell us your dream destination."],
  ["Enquire", "Share dates and travellers. Our team replies within 1–2 business days."],
  ["Confirm", "Receive a written quote with hotels, itinerary and service charges."],
  ["Travel", "Pay securely online and set off. We're with you all the way."],
];

export default async function Tours() {
  const data = await serverApi<{ packages: TourPackage[] }>("/public/packages");
  const packages = data?.packages ?? [];
  return (
    <>
      <PageHero chip="Signature journeys" image="/images/resort.jpg" title={<>Curated trips, <span className="text-gold-grad italic">beautifully</span> planned</>} sub="Verified hotel lodging, private transfers and guided experiences. Eligible packages carry a 90-day departure validity." />
      <section className="container-x py-24">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p, i) => <Reveal key={p.id} delay={(i % 3) * 120} className="h-full"><PackageCard p={p} /></Reveal>)}
        </div>
        <p className="mt-8 text-center text-sm italic text-white/40">*Service charges extra. Itinerary, hotels, dates and taxes are confirmed in writing before booking.</p>
      </section>
      <section className="border-y border-white/[0.06] bg-onyx-950/60 py-24">
        <div className="container-x">
          <SectionHead chip="How it works" title={<>Four steps to your <span className="text-gold-grad italic">next escape</span></>} />
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <Reveal key={t} delay={i * 120}>
                <div className="lux-card lux-hover h-full p-7">
                  <div className="text-gold-grad font-serif text-5xl">0{i + 1}</div>
                  <h3 className="mt-4 font-sans text-xl font-semibold text-white">{t}</h3>
                  <p className="mt-2 text-sm text-white/55">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section id="enquire" className="container-x max-w-3xl scroll-mt-28 py-24">
        <Reveal><EnquiryForm type="TOUR" packages={packages.map((p) => ({ id: p.id, name: p.name }))} title="Plan your trip" /></Reveal>
      </section>
    </>
  );
}
