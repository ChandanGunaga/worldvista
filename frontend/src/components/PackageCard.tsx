import Image from "next/image";
import Link from "next/link";
import { money } from "@/lib/api";
import type { TourPackage } from "@/lib/types";

export function PackageCard({ p }: { p: TourPackage }) {
  return (
    <Link href={`/tours/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-navy-900">
        {p.imageUrl && (
          <Image src={p.imageUrl} unoptimized={p.imageUrl.startsWith("/uploads/")} alt={p.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
        )}
        {p.validityDays && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-navy-900">{p.validityDays}-day validity</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-2xl text-navy-950">{p.name}</h3>
          <div className="text-right">
            <div className="text-lg font-bold text-navy-950">{money(p.price, p.currency)}</div>
            <div className="text-[11px] text-slate-500">{p.chargeNote}</div>
          </div>
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-700">{p.nights} Nights / {p.days} Days</div>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{p.summary}</p>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-navy-900">{p.tag ?? p.hotelCategory}</span>
          <span className="text-sm font-semibold text-gold-700 group-hover:underline">View details →</span>
        </div>
      </div>
    </Link>
  );
}
