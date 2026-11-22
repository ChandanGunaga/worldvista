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
      <section className="relative isolate h-[46vh] min-h-[320px] overflow-hidden bg-navy-950">
        {p.imageUrl && <Image src={p.imageUrl} unoptimized={p.imageUrl.startsWith("/uploads/")} alt={p.name} fill priority className="-z-10 object-cover opacity-70" sizes="100vw" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/30 to-transparent" />
        <div className="container-x flex h-full flex-col justify-end pb-10 text-white">
          <Link href="/tours" className="mb-4 text-sm text-white/70 hover:text-white">← All packages</Link>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{p.tag ?? p.hotelCategory}</span>
          <h1 className="mt-2 text-4xl sm:text-5xl">{p.name}</h1>
          <p className="mt-2 text-white/80">{p.nights} Nights / {p.days} Days · {p.destination}</p>
        </div>
      </section>
      <div className="container-x grid gap-10 py-14 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <h2 className="text-2xl text-navy-950">Highlights</h2>
            <p className="mt-3 text-slate-700">{p.summary}</p>
            {p.description && <div className="mt-4"><Markdown>{p.description}</Markdown></div>}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="card p-5">
              <h3 className="font-sans font-semibold text-navy-950">Inclusions</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{p.inclusions.map((i) => <li key={i}>✓ {i}</li>)}</ul>
            </div>
            <div className="card p-5">
              <h3 className="font-sans font-semibold text-navy-950">Exclusions</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{p.exclusions.map((i) => <li key={i}>– {i}</li>)}</ul>
            </div>
          </div>
          {p.cancellationPolicy && (
            <div className="card p-5 text-sm text-slate-700">
              <h3 className="font-sans font-semibold text-navy-950">Cancellation</h3>
              <p className="mt-2">{p.cancellationPolicy} <Link href="/legal/refund-policy" className="text-navy-700 underline">Read the policy</Link>.</p>
            </div>
          )}
          <div id="enquire" className="scroll-mt-24">
            <EnquiryForm type="TOUR" packages={[{ id: p.id, name: p.name }]} defaultPackageId={p.id} title={`Enquire about ${p.name}`} />
          </div>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <div className="text-sm text-slate-500">From</div>
            <div className="font-serif text-4xl text-navy-950">{money(p.price, p.currency)}</div>
            <div className="text-sm text-slate-500">{p.chargeNote}</div>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Duration</dt><dd className="font-medium">{p.nights}N / {p.days}D</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Hotels</dt><dd className="font-medium">{p.hotelCategory}</dd></div>
              {p.validityDays && <div className="flex justify-between"><dt className="text-slate-500">Validity</dt><dd className="font-medium">{p.validityDays} days</dd></div>}
              {(p.availableFrom || p.availableTo) && <div className="flex justify-between"><dt className="text-slate-500">Available</dt><dd className="font-medium">{fmtDate(p.availableFrom)} – {fmtDate(p.availableTo)}</dd></div>}
            </dl>
            <a href="#enquire" className="btn-gold mt-6 w-full">Enquire now</a>
            {!p.verified && <p className="mt-3 text-xs text-slate-500">Itinerary and hotel details are indicative and confirmed at booking.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
