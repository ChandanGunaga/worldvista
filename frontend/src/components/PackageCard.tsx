import Image from "next/image";
import Link from "next/link";
import type { TourPackage } from "@/lib/types";

export function PackageCard({ p }: { p: TourPackage }) {
  return (
    <Link href={`/tours/${p.slug}`} className="lux-card lux-hover group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/11] overflow-hidden bg-onyx-700">
        {p.imageUrl && (
          <Image src={p.imageUrl} unoptimized={p.imageUrl.startsWith("/uploads/")} alt={p.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-[1200ms] ease-out group-hover:scale-110" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-onyx-850 via-onyx-850/10 to-transparent" />
        {p.validityDays && (
          <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-onyx-950/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-200 backdrop-blur">{p.validityDays}-day validity</span>
        )}
        <span className="absolute bottom-4 left-5 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300">{p.tag ?? p.hotelCategory}</span>
      </div>
      <div className="flex flex-1 flex-col p-6 pt-4">
        <div>
          <h3 className="font-serif text-2xl text-white">{p.name}</h3>
          <div className="mt-1 text-sm text-white/50">{p.nights} Nights · {p.days} Days</div>
        </div>
        <p className="mt-4 flex-1 text-sm leading-relaxed text-white/60">{p.summary}</p>
        <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
          <span className="text-xs text-white/40">{p.hotelCategory}</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300 transition group-hover:gap-3">Explore <span aria-hidden>→</span></span>
        </div>
      </div>
    </Link>
  );
}
