import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApi, money, fmtDate } from "@/lib/api";
import type { TourPackage } from "@/lib/types";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Markdown } from "@/components/Markdown";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await serverApi<{ package: TourPackage }>(`/public/packages/${params.slug}`);
  return { title: data?.package.name ?? "Tour package", description: data?.package.summary };
}

export default async function TourDetail({ params }: { params: { slug: string } }) {
  const data = await serverApi<{ package: TourPackage }>(`/public/packages/${params.slug}`);
  if (!data) notFound();
  const p = data.package;
  return (
    <>
      <section className="relative isolate flex min-h-[62vh] items-end overflow-hidden bg-onyx-950 pb-14 pt-40">
        {p.imageUrl && <Image src={p.imageUrl} unoptimized={p.imageUrl.startsWith("/uploads/")} alt={p.name} fill priority className="-z-10 animate-kenburns object-cover opacity-60" sizes="100vw" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-onyx-900 via-onyx-950/40 to-onyx-950/60" />
        <div className="container-x text-white">
          <Link href="/tours" className="mb-6 inline-block text-sm text-white/60 transition hover:text-gold-200">← All journeys</Link>
          <div><span className="chip animate-rise">{p.tag ?? p.hotelCategory}</span></div>
          <h1 className="mt-5 animate-rise font-serif text-5xl [animation-delay:120ms] sm:text-7xl">{p.name}</h1>
          <p className="mt-3 animate-rise text-lg text-white/70 [animation-delay:240ms]">{p.nights} Nights · {p.days} Days · {p.destination}</p>
        </div>
      </section>
      <div className="container-x grid gap-10 py-20 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <span className="chip">Highlights</span>
            <p className="mt-5 font-serif text-2xl leading-snug text-champagne">{p.summary}</p>
            {p.description && <div className="mt-4"><Markdown>{p.description}</Markdown></div>}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="lux-card p-6">
              <h3 className="font-sans font-semibold text-white">Inclusions</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-white/70">{p.inclusions.map((i) => <li key={i} className="flex gap-3"><span className="text-gold-400">✓</span>{i}</li>)}</ul>
            </div>
            <div className="lux-card p-6">
              <h3 className="font-sans font-semibold text-white">Exclusions</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-white/55">{p.exclusions.map((i) => <li key={i} className="flex gap-3"><span className="text-white/30">–</span>{i}</li>)}</ul>
            </div>
          </div>
          {!!p.itinerary?.length && (
            <div>
              <span className="chip">Itinerary</span>
              <ol className="relative mt-6 space-y-6 border-l border-gold-400/30 pl-8">
                {p.itinerary.map((d) => (
                  <li key={d.day} className="relative">
                    <span className="absolute -left-[45px] grid h-8 w-8 place-items-center rounded-full bg-gold-grad text-xs font-bold text-onyx-950 shadow-glow">{String(d.day).padStart(2, "0")}</span>
                    <h3 className="font-serif text-xl text-white">Day {d.day} · {d.title}</h3>
                    {d.details && <p className="mt-1 text-sm text-white/60">{d.details}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {p.cancellationPolicy && (
            <div className="lux-card p-6 text-sm text-white/65">
              <h3 className="font-sans font-semibold text-navy-950">Cancellation</h3>
              <p className="mt-2">{p.cancellationPolicy} <Link href="/legal/refund-policy" className="text-gold-300 underline">Read the policy</Link>.</p>
            </div>
          )}
          <div id="enquire" className="scroll-mt-32">
            <EnquiryForm type="TOUR" packages={[{ id: p.id, name: p.name }]} defaultPackageId={p.id} title={`Enquire about ${p.name}`} />
          </div>
        </div>
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="lux-card-gold p-7">
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">From</div>
            <div className="text-gold-grad mt-1 font-serif text-5xl">{money(p.price, p.currency)}</div>
            <div className="text-sm text-slate-500">{Number(p.serviceCharge) > 0 ? `+ ${money(p.serviceCharge ?? 0, p.currency)} service charge per traveller` : p.chargeNote}</div>
            <dl className="mt-6 space-y-3 border-t border-white/[0.08] pt-6 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Duration</dt><dd className="font-medium text-white">{p.nights}N / {p.days}D</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Hotels</dt><dd className="font-medium text-white">{p.hotelCategory}</dd></div>
              {p.validityDays && <div className="flex justify-between"><dt className="text-slate-500">Validity</dt><dd className="font-medium text-white">{p.validityDays} days</dd></div>}
              {(p.availableFrom || p.availableTo) && <div className="flex justify-between"><dt className="text-slate-500">Available</dt><dd className="font-medium text-white">{fmtDate(p.availableFrom)} – {fmtDate(p.availableTo)}</dd></div>}
            </dl>
            <Link href="/dashboard/tours" className="btn-lux mt-7 w-full">Book now</Link>
            <a href="#enquire" className="btn-lux-outline mt-3 w-full">Enquire first</a>
            {!p.verified && <p className="mt-3 text-xs text-slate-500">Itinerary and hotel details are indicative and confirmed at booking.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
