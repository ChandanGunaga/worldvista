import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import { EnquiryForm } from "@/components/EnquiryForm";
import { PageHero } from "@/components/lux/PageHero";
import { Reveal } from "@/components/lux/Reveal";

export const metadata: Metadata = { title: "Contact" };
type Contact = { email?: string; phone?: string; whatsapp?: string; address?: string; hours?: string };

export default async function ContactPage() {
  const data = await serverApi<{ settings: { contact?: Contact; company?: { legalName?: string } } }>("/public/settings");
  const c = data?.settings.contact ?? {};
  const rows: [string, string, string | undefined, string?][] = [
    ["✉", "Email", c.email, c.email ? `mailto:${c.email}` : undefined],
    ["☎", "Phone", c.phone, c.phone ? `tel:${c.phone.replace(/\s/g, "")}` : undefined],
    ["✆", "WhatsApp", c.whatsapp],
    ["⌖", "Address", c.address],
    ["◷", "Hours", c.hours],
    ["◆", "Company", data?.settings.company?.legalName],
  ];
  return (
    <>
      <PageHero chip="Get in touch" image="/images/dubai-wide.jpg" title={<>Let&apos;s plan something <span className="text-gold-grad italic">remarkable</span></>} sub="Questions about a journey, the academy or your account? We're happy to help." />
      <section className="container-x grid gap-10 py-24 lg:grid-cols-5">
        <Reveal variant="left" className="lg:col-span-2">
          <div className="lux-card-gold space-y-6 p-8">
            {rows.filter((r) => r[2]).map(([icon, label, value, href]) => (
              <div key={label} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold-500/30 bg-gold-400/10 text-gold-200">{icon}</span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">{label}</div>
                  {href ? <a href={href} className="font-medium text-white transition hover:text-gold-200">{value}</a> : <div className="font-medium text-white">{value}</div>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-white/40">World Vista staff will never ask for your password, OTP codes or wallet keys.</p>
        </Reveal>
        <Reveal variant="right" className="lg:col-span-3"><EnquiryForm type="GENERAL" title="Send us a message" /></Reveal>
      </section>
    </>
  );
}
