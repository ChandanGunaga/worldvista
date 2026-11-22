import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import { EnquiryForm } from "@/components/EnquiryForm";

export const metadata: Metadata = { title: "Contact" };
type Contact = { email?: string; phone?: string; whatsapp?: string; address?: string; hours?: string };

export default async function ContactPage() {
  const data = await serverApi<{ settings: { contact?: Contact; company?: { legalName?: string } } }>("/public/settings");
  const c = data?.settings.contact ?? {};
  return (
    <div className="container-x grid gap-10 py-16 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <p className="eyebrow">Get in touch</p>
        <h1 className="mt-2 text-4xl text-navy-950">Contact us</h1>
        <p className="mt-3 text-slate-600">Questions about a trip, a course or your account? We&apos;re happy to help.</p>
        <dl className="card mt-8 space-y-4 p-6 text-sm">
          {c.email && <div><dt className="text-slate-500">Email</dt><dd className="font-medium"><a href={`mailto:${c.email}`}>{c.email}</a></dd></div>}
          {c.phone && <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{c.phone}</dd></div>}
          {c.whatsapp && <div><dt className="text-slate-500">WhatsApp</dt><dd className="font-medium">{c.whatsapp}</dd></div>}
          {c.address && <div><dt className="text-slate-500">Address</dt><dd className="font-medium">{c.address}</dd></div>}
          {c.hours && <div><dt className="text-slate-500">Hours</dt><dd className="font-medium">{c.hours}</dd></div>}
          {data?.settings.company?.legalName && <div><dt className="text-slate-500">Company</dt><dd className="font-medium">{data.settings.company.legalName}</dd></div>}
        </dl>
        <p className="mt-4 text-xs text-slate-500">World Vista staff will never ask for your password, OTP codes or wallet keys.</p>
      </div>
      <div className="lg:col-span-3"><EnquiryForm type="GENERAL" title="Send us a message" /></div>
    </div>
  );
}
