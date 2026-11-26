import Image from "next/image";
import Link from "next/link";
import { serverApi } from "@/lib/api";
import type { Course, Faq, TourPackage } from "@/lib/types";
import { PackageCard } from "@/components/PackageCard";
import { Reveal } from "@/components/lux/Reveal";
import { Emblem } from "@/components/lux/Emblem";
import { SectionHead } from "@/components/lux/SectionHead";

const PILLARS = [
  {
    k: "Travel",
    title: "Curated Travel Experiences",
    body: "Explore selected destinations, accommodation options and travel experiences across Asia and the Middle East.",
    points: ["Dubai, Sri Lanka, Oman, Malaysia & Thailand", "Private transfers and guided sightseeing", "A dedicated travel desk from enquiry to return"],
    href: "/tours",
    cta: "Explore journeys",
  },
  {
    k: "Learn",
    title: "World Vista Academy",
    body: "A structured basic-to-advanced programme on how financial markets work, taught with an emphasis on risk management and discipline.",
    points: ["Market structure & price action", "Risk management and position sizing", "Trading psychology & journaling", "Educational only, never financial advice"],
    href: "/education",
    cta: "View the academy",
  },
  {
    k: "Experience",
    title: "Lifestyle & Membership",
    body: "A members' portal for bookings, learning and support today. Concierge services and a lifestyle marketplace are on the roadmap.",
    points: ["Personal member dashboard", "Booking & payment history", "Member Support", "Future: concierge & curated goods"],
    href: "/register",
    cta: "Become a member",
  },
];

const WHY = [
  { n: "01", t: "Handpicked Hospitality", d: "Every property is chosen for comfort, location and service, from boutique retreats to five-star resorts." },
  { n: "02", t: "Transparent Pricing", d: "Clear information about package inclusions, applicable charges and booking conditions before confirmation." },
  { n: "03", t: "Human Expertise", d: "Real travel specialists plan your dates, rooms and transfers, and stay reachable throughout your trip." },
  { n: "04", t: "Secure & Simple", d: "Access available booking information and contact our support team for assistance." },
];

const ROADMAP = [
  { y: "2026", t: "Tourism & Network Rollout", d: "Flagship destinations in Dubai, Sri Lanka, Oman, Malaysia and Thailand, with a 90-day booking window.", now: true },
  { y: "2027", t: "Travel Marketplace", d: "One-click flights, stays and activities, plus luxury luggage and travel gear.", now: false },
  { y: "2028+", t: "Global Lifestyle Brand", d: "VIP membership, 24/7 concierge and worldwide delivery of curated goods.", now: false },
];

const DESTINATIONS = ["Dubai", "Sri Lanka", "Oman", "Malaysia", "Thailand", "India", "Abu Dhabi", "Kuala Lumpur", "Muscat", "Phuket"];

export default async function Home() {
  const [pk, cr, fq] = await Promise.all([
    serverApi<{ packages: TourPackage[] }>("/public/packages"),
    serverApi<{ courses: Course[] }>("/public/courses"),
    serverApi<{ faqs: Faq[] }>("/public/faqs"),
  ]);
  const packages = pk?.packages ?? [];
  const course = cr?.courses[0];
  const faqs = (fq?.faqs ?? []).slice(0, 5);

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative isolate overflow-hidden bg-onyx-950">
        <div className="absolute inset-0 -z-20 overflow-hidden">
          <Image src="/images/hero.jpg" alt="" fill priority className="animate-kenburns object-cover opacity-[0.22]" sizes="100vw" />
        </div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,rgba(226,176,74,.16),transparent_55%),linear-gradient(to_bottom,rgba(6,6,7,.6),rgba(11,11,13,1))]" />
        <div className="absolute -bottom-px left-0 right-0 -z-10 h-40 bg-[linear-gradient(170deg,transparent_49.5%,#0B0B0D_50%)]" />
        <div className="container-x grid min-h-[100svh] items-center gap-10 pb-24 pt-36 lg:grid-cols-2 lg:pt-28">
          <div className="text-center lg:text-left">
            <span className="chip animate-rise">Travel • Learn • Experience</span>
            <h1 className="mt-7 animate-rise font-serif text-5xl leading-[1.02] text-white [animation-delay:120ms] sm:text-7xl">
              Welcome to<br />
              <span className="text-gold-grad">World Vista</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl animate-rise text-lg leading-relaxed text-white/65 [animation-delay:240ms] lg:mx-0">
              Discover quality travel experiences and financial markets education, focused on meaningful journeys, practical learning and customer service.
            </p>
            <div className="mt-10 flex animate-rise flex-wrap justify-center gap-4 [animation-delay:360ms] lg:justify-start">
              <Link href="/tours" className="btn-lux">Explore journeys</Link>
              <Link href="/contact" className="btn-lux-outline">Talk to an expert</Link>
            </div>
          </div>
          <div className="animate-rise [animation-delay:300ms]">
            <Emblem />
          </div>
        </div>
      </section>

      {/* ───────── Destination marquee ───────── */}
      <div className="relative overflow-hidden border-y border-white/[0.06] bg-onyx-900 py-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-onyx-900 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-onyx-900 to-transparent" />
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {[...DESTINATIONS, ...DESTINATIONS].map((d, i) => (
            <span key={i} className="flex items-center gap-12 font-serif text-2xl italic text-white/35">
              {d}<span className="text-sm not-italic text-gold-400">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ───────── About ───────── */}
      <section className="container-x grid items-center gap-16 py-28 lg:grid-cols-2">
        <Reveal variant="left" className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10">
            <Image src="/images/about.jpg" alt="Luxury villa terrace with an infinity pool" fill className="object-cover transition duration-[1500ms] hover:scale-105" sizes="(max-width:1024px) 100vw, 45vw" />
          </div>
          <div className="absolute -bottom-8 -right-4 hidden w-56 rounded-3xl border border-gold-500/30 bg-onyx-850/90 p-5 backdrop-blur sm:block lg:-right-10">
            <div className="text-gold-grad font-serif text-4xl">3 · 4 · 5★</div>
            <p className="mt-1 text-sm text-white/60">Curated hospitality across every journey</p>
          </div>
        </Reveal>
        <Reveal variant="right">
          <span className="chip">About us</span>
          <h2 className="lux-title mt-5">Journeys that <span className="text-gold-grad italic">enrich</span> lives</h2>
          <p className="lux-sub mt-6">
            World Vista brings together world-class travel and practical learning. We design journeys that restore balance, spark curiosity and create memories families keep for a lifetime, then support our members with education that builds real-world understanding.
          </p>
          <blockquote className="mt-8 border-l-2 border-gold-400 pl-5 font-serif text-xl italic text-champagne">
            &ldquo;Inspiring a more meaningful life through world-class travel adventures.&rdquo;
          </blockquote>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="lux-card p-5"><div className="font-semibold text-white">Global destination network</div><p className="mt-1 text-sm text-white/55">Handpicked properties & bespoke itineraries.</p></div>
            <div className="lux-card p-5"><div className="font-semibold text-white">End-to-end care</div><p className="mt-1 text-sm text-white/55">From initial enquiry to booking assistance.</p></div>
          </div>
          <Link href="/about" className="btn-lux mt-10">Our story</Link>
        </Reveal>
      </section>

      {/* ───────── Pillars ───────── */}
      <section className="relative py-28">
        <div className="pointer-events-none absolute left-1/2 top-24 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-gold-500/[0.07] blur-[140px]" />
        <div className="container-x relative">
          <SectionHead chip="The World Vista ecosystem" title={<>Our <span className="text-gold-grad">Core Pillars</span></>} sub="Three ways World Vista adds meaning to your life, built on trust, transparency and genuine service." />
          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <Reveal key={p.k} delay={i * 120} className="h-full">
                <div className="lux-card-gold lux-hover flex h-full flex-col p-8">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold-300">{p.k}</span>
                    <span className="font-serif text-5xl text-white/[0.06]">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-serif text-3xl text-white">{p.title}</h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-white/60">{p.body}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex gap-3 text-sm text-white/75"><span className="mt-0.5 text-gold-400">✦</span>{pt}</li>
                    ))}
                  </ul>
                  <Link href={p.href} className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-gold-300 transition hover:gap-4">{p.cta} <span aria-hidden>→</span></Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Packages ───────── */}
      <section className="border-t border-white/[0.06] bg-onyx-950/60 py-28">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead center={false} chip="Signature journeys" title={<>Curated trips, <span className="text-gold-grad italic">ready to depart</span></>} />
            <Reveal><Link href="/tours" className="btn-lux-outline">View all journeys</Link></Reveal>
          </div>
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 120} className="h-full"><PackageCard p={p} /></Reveal>
            ))}
          </div>
          {!packages.length && <p className="mt-10 text-white/50">Packages are loading. Please check back shortly.</p>}
          <p className="mt-8 text-center text-xs text-white/35">Travel packages are subject to availability. Package details, inclusions and booking conditions are provided upon enquiry.</p>
        </div>
      </section>

      {/* ───────── Why choose ───────── */}
      <section className="py-28">
        <div className="container-x">
          <SectionHead title={<>Why choose <span className="text-gold-grad">World Vista</span></>} />
          <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-14">
              {WHY.slice(0, 2).map((w, i) => (
                <Reveal key={w.n} variant="left" delay={i * 150} className="relative lg:text-right">
                  <span className="text-gold-grad font-serif text-5xl leading-none">{w.n}</span>
                  <h3 className="relative mt-3 font-serif text-2xl text-white">{w.t}</h3>
                  <p className="relative mt-3 text-white/55 lg:ml-auto lg:max-w-sm">{w.d}</p>
                </Reveal>
              ))}
            </div>
            <Reveal variant="zoom" className="hidden lg:block"><Emblem size="md" /></Reveal>
            <div className="space-y-14">
              {WHY.slice(2).map((w, i) => (
                <Reveal key={w.n} variant="right" delay={i * 150} className="relative">
                  <span className="text-gold-grad font-serif text-5xl leading-none">{w.n}</span>
                  <h3 className="relative mt-3 font-serif text-2xl text-white">{w.t}</h3>
                  <p className="relative mt-3 max-w-sm text-white/55">{w.d}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Why travel (wellbeing) ───────── */}
      <section className="relative isolate overflow-hidden py-28">
        <Image src="/images/travel-family.jpg" alt="" fill className="-z-10 object-cover opacity-25" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-onyx-900 via-onyx-900/90 to-onyx-900/60" />
        <div className="container-x grid gap-14 lg:grid-cols-2">
          <Reveal>
            <span className="chip">Purpose & wellbeing</span>
            <h2 className="lux-title mt-5">Travel is an <span className="text-gold-grad italic">Experience</span> Worth Remembering</h2>
            <p className="lux-sub mt-6">Discover new destinations, experience different cultures and create lasting memories.</p>
            <p className="mt-10 font-serif text-2xl italic leading-snug text-champagne">&ldquo;The world is a book, and those who do not travel read only one page.&rdquo;</p>
            <p className="mt-2 text-sm text-white/40">Saint Augustine</p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["Mental & physical vitality", "Enjoy new surroundings and refreshing travel experiences."],
              ["Creativity & perspective", "New cultures spark fresh thinking and better problem-solving."],
              ["Shared memories", "Journeys together build bonds and lifelong family milestones."],
              ["Renewed purpose", "Stepping out of routine helps you rediscover what matters."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 100}>
                <div className="lux-card lux-hover h-full p-6 backdrop-blur">
                  <div className="h-px w-10 bg-gold-grad" />
                  <h3 className="mt-4 font-sans text-lg font-semibold text-white">{t}</h3>
                  <p className="mt-2 text-sm text-white/55">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Academy ───────── */}
      {course && (
        <section className="py-28">
          <div className="container-x">
            <div className="lux-card-gold grid items-center gap-12 overflow-hidden p-8 sm:p-12 lg:grid-cols-2">
              <Reveal variant="left">
                <span className="chip">World Vista Academy</span>
                <h2 className="lux-title mt-5">Financial Markets <span className="text-gold-grad italic">Education</span></h2>
                <p className="lux-sub mt-5">Learn financial market fundamentals, technical analysis, market structure, risk management and trading psychology through structured educational content.</p>
                <p className="mt-5 text-xs italic text-white/40">{course.disclaimer}</p>
                <Link href="/education" className="btn-lux mt-8">View the course</Link>
              </Reveal>
              <Reveal variant="right" className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10">
                <Image src={course.imageUrl ?? "/images/education.jpg"} unoptimized={!!course.imageUrl?.startsWith("/uploads/")} alt="Trading desk with market charts" fill className="object-cover" sizes="(max-width:1024px) 100vw, 45vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-onyx-950/70 to-transparent" />
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* ───────── Roadmap ───────── */}
      <section className="border-t border-white/[0.06] bg-onyx-950/60 py-28">
        <div className="container-x">
          <SectionHead chip="Vision" title={<>The road <span className="text-gold-grad italic">ahead</span></>} sub="Where World Vista is today, and where we're heading next." />
          <div className="relative mt-16 grid gap-8 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-[34px] hidden h-px bg-gradient-to-r from-gold-400/60 via-gold-400/20 to-transparent md:block" />
            {ROADMAP.map((r, i) => (
              <Reveal key={r.y} delay={i * 150}>
                <div className="relative">
                  <div className={`relative z-10 grid h-[68px] w-[68px] place-items-center rounded-full border ${r.now ? "border-gold-400 bg-gold-grad text-onyx-950" : "border-white/15 bg-onyx-800 text-gold-300"} font-serif text-lg font-semibold`}>{r.y}</div>
                  <div className="mt-6">
                    <span className={`text-[11px] font-bold uppercase tracking-[0.24em] ${r.now ? "text-gold-300" : "text-white/40"}`}>{r.now ? "Now live" : "Coming soon"}</span>
                    <h3 className="mt-2 font-serif text-2xl text-white">{r.t}</h3>
                    <p className="mt-2 text-white/55">{r.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 text-xs text-white/35">Roadmap items are plans and may change. Future services are not yet available.</p>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      {faqs.length > 0 && (
        <section className="py-28">
          <div className="container-x grid items-center gap-16 lg:grid-cols-2">
            <div>
              <Reveal>
                <span className="chip">FAQ & answers</span>
                <h2 className="lux-title mt-5">Get every <span className="text-gold-grad italic">single</span> answer</h2>
              </Reveal>
              <div className="mt-10 space-y-4">
                {faqs.map((f, i) => (
                  <Reveal key={f.id} delay={i * 80}>
                    <details className="faq-item group rounded-2xl border border-white/[0.08] bg-onyx-800 transition-colors" open={i === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 p-6 font-semibold text-white">
                        {f.question}
                        <span className="faq-icon text-2xl font-light text-gold-300 transition-transform duration-300">+</span>
                      </summary>
                      <p className="px-6 pb-6 leading-relaxed text-white/60">{f.answer}</p>
                    </details>
                  </Reveal>
                ))}
              </div>
              <Link href="/faq" className="btn-lux-outline mt-8">All questions</Link>
            </div>
            <Reveal variant="zoom" className="hidden lg:block"><Emblem /></Reveal>
          </div>
        </section>
      )}

      {/* ───────── CTA ───────── */}
      <section className="container-x pb-28">
        <Reveal variant="zoom">
          <div className="relative isolate overflow-hidden rounded-[2.5rem] border border-gold-500/30 px-6 py-20 text-center sm:px-16">
            <Image src="/images/resort.jpg" alt="" fill className="-z-10 animate-kenburns object-cover" sizes="100vw" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-onyx-950/90 via-onyx-950/75 to-gold-700/40" />
            <span className="chip">Begin your journey</span>
            <h2 className="mx-auto mt-6 max-w-3xl font-serif text-4xl text-white sm:text-6xl">Embark on <span className="text-gold-grad italic">extraordinary</span> journeys</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">Tell us where you&apos;d like to go. Our travel team will tailor the dates, hotels and final quote for you.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/tours#enquire" className="btn-lux">Send an enquiry</Link>
              <Link href="/register" className="btn-lux-outline">Become a member</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
