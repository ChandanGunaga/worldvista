import Image from "next/image";
import Link from "next/link";
import { serverApi, money } from "@/lib/api";
import type { Course, Faq, TourPackage } from "@/lib/types";
import { PackageCard } from "@/components/PackageCard";

const WHY = [
  { t: "Mental & Physical Vitality", d: "Lowers chronic stress, restores emotional balance and supports overall wellbeing." },
  { t: "Cognitive Expansion & Creativity", d: "Exposure to diverse cultures stimulates fresh thinking and problem solving." },
  { t: "Unforgettable Shared Memories", d: "Shared journeys forge deep family relationships and lifetime milestones." },
  { t: "Purpose & Expanded Perspective", d: "Breaking daily routine helps rediscover motivation and a richer life vista." },
];

export default async function Home() {
  const [pk, cr, fq] = await Promise.all([
    serverApi<{ packages: TourPackage[] }>("/public/packages"),
    serverApi<{ courses: Course[] }>("/public/courses"),
    serverApi<{ faqs: Faq[] }>("/public/faqs"),
  ]);
  const packages = pk?.packages ?? [];
  const course = cr?.courses[0];
  const faqs = (fq?.faqs ?? []).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy-950">
        <Image src="/images/hero.jpg" alt="Infinity pool overlooking the sea at sunset" fill priority className="-z-10 object-cover opacity-55" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/40 via-navy-950/30 to-navy-950/90" />
        <div className="container-x flex min-h-[78vh] flex-col items-center justify-center py-24 text-center">
          <Image src="/images/logo-gold.png" alt="" width={220} height={144} className="h-28 w-auto mix-blend-screen" />
          <h1 className="mt-6 text-4xl italic text-white sm:text-6xl">&ldquo;More Meaningful Life&rdquo;</h1>
          <div className="mx-auto mt-6 flex items-center gap-4">
            <span className="h-px w-16 bg-gold-500 sm:w-28" />
            <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
            <span className="h-px w-16 bg-gold-500 sm:w-28" />
          </div>
          <p className="mt-5 text-sm font-semibold tracking-[0.3em] text-gold-400">TRAVEL • LEARN • EXPERIENCE</p>
          <p className="mx-auto mt-6 max-w-xl text-base text-white/80">Handpicked journeys across Asia and the Middle East, curated 4 & 5-star stays, and practical financial-markets education.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/tours" className="btn-gold">Explore tour packages</Link>
            <Link href="/contact" className="btn-ghost-light">Talk to a travel expert</Link>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="container-x py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Tourism highlights</p>
            <h2 className="mt-2 text-3xl text-navy-950 sm:text-4xl">Curated journeys, ready to depart</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600">90-day departure validity • Service charges extra</span>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => <PackageCard key={p.id} p={p} />)}
        </div>
        {!packages.length && <p className="mt-10 text-slate-500">Packages are loading — please check back shortly.</p>}
      </section>

      {/* About brief */}
      <section className="bg-white py-20">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Who we are</p>
            <h2 className="mt-2 text-3xl text-navy-950 sm:text-4xl">About World Vista</h2>
            <blockquote className="mt-6 border-l-4 border-gold-500 bg-cream px-5 py-4 font-serif text-xl italic text-navy-900">
              &ldquo;Inspiring a More Meaningful Life through world-class travel adventures.&rdquo;
            </blockquote>
            <div className="mt-6 space-y-4">
              <div className="card p-4"><div className="font-semibold text-navy-950">Global Destination Network</div><p className="text-sm text-slate-600">Handpicked properties and bespoke itineraries.</p></div>
              <div className="card p-4"><div className="font-semibold text-navy-950">Curated 3, 4 & 5-Star Hospitality</div><p className="text-sm text-slate-600">Premium properties with 90-day departure validity.</p></div>
            </div>
            <Link href="/about" className="btn-outline mt-6">Our story</Link>
          </div>
          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl">
            <Image src="/images/about.jpg" alt="Luxury villa terrace with infinity pool" fill className="object-cover" sizes="(max-width:1024px) 100vw, 50vw" />
          </div>
        </div>
      </section>

      {/* Why travel */}
      <section className="container-x py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="eyebrow">Purpose & wellbeing</p>
            <h2 className="mt-2 text-3xl text-navy-950 sm:text-4xl">Why travel is important</h2>
            <p className="mt-4 text-slate-600">Travel is an investment in health, mindset and irreplaceable memories.</p>
            <div className="mt-6 overflow-hidden rounded-2xl bg-navy-950">
              <div className="relative aspect-[3/2]"><Image src="/images/travel-family.jpg" alt="Family enjoying a mountain view" fill className="object-cover" sizes="40vw" /></div>
              <p className="px-5 py-4 font-serif italic text-gold-300">&ldquo;The world is a book, and those who do not travel read only one page.&rdquo; <span className="block pt-1 font-sans text-xs not-italic text-white/60">Saint Augustine</span></p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:content-center">
            {WHY.map((w) => (
              <div key={w.t} className="card border-l-4 border-l-gold-500 p-6">
                <h3 className="font-sans text-lg font-semibold text-navy-950">{w.t}</h3>
                <p className="mt-2 text-sm text-slate-600">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Education preview */}
      {course && (
        <section className="bg-navy-950 py-20 text-white">
          <div className="container-x grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Learn</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">Financial Markets Education</h2>
              <p className="mt-4 text-white/70">{course.syllabus}. Build practical understanding of market structure, risk management and trading psychology.</p>
              <div className="mt-6 flex flex-wrap gap-6">
                <div><div className="font-serif text-3xl text-gold-400">{money(course.tuition, course.currency)}</div><div className="text-xs text-white/60">Academy tuition</div></div>
                <div><div className="font-serif text-3xl">{course.duration}</div><div className="text-xs text-white/60">Duration</div></div>
                <div><div className="font-serif text-3xl">{course.schedule}</div><div className="text-xs text-white/60">Schedule</div></div>
              </div>
              <p className="mt-6 text-xs italic text-white/50">{course.disclaimer}</p>
              <Link href="/education" className="btn-gold mt-6">View course</Link>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl"><Image src="/images/education.jpg" alt="Trading desk with multiple monitors" fill className="object-cover" sizes="50vw" /></div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="container-x py-20">
        <div className="grid gap-10 lg:grid-cols-3">
          <div>
            <p className="eyebrow">Questions</p>
            <h2 className="mt-2 text-3xl text-navy-950">Frequently asked</h2>
            <Link href="/faq" className="btn-outline mt-6">All FAQs</Link>
          </div>
          <div className="space-y-3 lg:col-span-2">
            {faqs.map((f) => (
              <details key={f.id} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold text-navy-950">{f.question}</summary>
                <p className="mt-3 text-sm text-slate-600">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="relative isolate overflow-hidden">
        <Image src="/images/resort.jpg" alt="" fill className="-z-10 object-cover" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-navy-950/70" />
        <div className="container-x py-20 text-center text-white">
          <h2 className="text-3xl sm:text-4xl">Embark on extraordinary journeys</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">Tell us where you&apos;d like to go. Our travel team will tailor dates, hotels and the final quote.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/tours#enquire" className="btn-gold">Send an enquiry</Link>
            <Link href="/register" className="btn-ghost-light">Become a member</Link>
          </div>
        </div>
      </section>
    </>
  );
}
