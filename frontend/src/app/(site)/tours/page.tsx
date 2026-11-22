import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import type { TourPackage } from "@/lib/types";
import { PackageCard } from "@/components/PackageCard";
import { EnquiryForm } from "@/components/EnquiryForm";

export const metadata: Metadata = { title: "Tour Packages" };

export default async function Tours() {
  const data = await serverApi<{ packages: TourPackage[] }>("/public/packages");
  const packages = data?.packages ?? [];
  return (
    <div className="container-x py-16">
      <p className="eyebrow">Travel</p>
      <h1 className="mt-2 text-4xl text-navy-950">Tour Packages</h1>
      <p className="mt-3 max-w-2xl text-slate-600">All packages include verified hotel lodging. Eligible packages carry a 90-day departure validity. Service charges are extra and quoted at enquiry.</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => <PackageCard key={p.id} p={p} />)}
      </div>
      <p className="mt-4 text-sm italic text-slate-500">*Service charges extra. Itinerary, hotels, dates and taxes are confirmed in writing before booking.</p>
      <div id="enquire" className="mx-auto mt-16 max-w-3xl scroll-mt-24">
        <EnquiryForm type="TOUR" packages={packages.map((p) => ({ id: p.id, name: p.name }))} title="Plan your trip" />
      </div>
    </div>
  );
}
