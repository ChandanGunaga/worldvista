import Image from "next/image";
import Link from "next/link";
import { serverApi } from "@/lib/api";

type Contact = { email?: string; phone?: string; address?: string; hours?: string };

const EXPLORE = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/tours", label: "Journeys" },
  { href: "/education", label: "Academy" },
  { href: "/ai-markets", label: "Insights" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];
const POLICIES = [
  { href: "/legal/terms", label: "Terms & Conditions" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/refund-policy", label: "Cancellation & Refunds" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
  { href: "/legal/grievance", label: "Grievance Redressal" },
];

export async function SiteFooter() {
  const data = await serverApi<{ settings: { contact?: Contact } }>("/public/settings");
  const c = data?.settings.contact ?? {};
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-onyx-950 text-white/60">
      <div className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-gold-500/10 blur-[120px]" />
      <div className="container-x relative grid gap-12 py-20 lg:grid-cols-[1.1fr_1px_1.4fr]">
        <div>
          <Image src="/images/logo-gold-t.png" alt="World Vista" width={900} height={439} className="h-28 w-auto" />
          <p className="mt-6 font-serif text-2xl italic text-champagne">&ldquo;A More Meaningful Life&rdquo;</p>
          <p className="mt-2 text-[11px] font-bold tracking-[0.32em] text-gold-300">TRAVEL • LEARN • EXPERIENCE</p>
          <Link href="/register" className="btn-lux mt-8">Become a member</Link>
        </div>
        <div className="hidden bg-white/10 lg:block" />
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <h3 className="mb-4 font-sans text-sm font-bold uppercase tracking-[0.14em] text-white">Navigation</h3>
            <ul className="space-y-2.5 text-sm">{EXPLORE.map((l) => <li key={l.href}><Link href={l.href} className="transition hover:text-gold-200">{l.label}</Link></li>)}</ul>
          </div>
          <div>
            <h3 className="mb-4 font-sans text-sm font-bold uppercase tracking-[0.14em] text-white">Policies</h3>
            <ul className="space-y-2.5 text-sm">{POLICIES.map((l) => <li key={l.href}><Link href={l.href} className="transition hover:text-gold-200">{l.label}</Link></li>)}</ul>
          </div>
          <div>
            <h3 className="mb-4 font-sans text-sm font-bold uppercase tracking-[0.14em] text-white">Contact</h3>
            <ul className="space-y-2.5 text-sm">
              {c.email && <li><a href={`mailto:${c.email}`} className="transition hover:text-gold-200">{c.email}</a></li>}
              {c.phone && <li>{c.phone}</li>}
              {c.address && <li>{c.address}</li>}
              {c.hours && <li className="text-white/40">{c.hours}</li>}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-white/40 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} <span className="text-gold-300">World Vista</span>. All rights reserved.</p>
          <p className="max-w-2xl md:text-right">Tour prices exclude service charges. Education content is for learning only and is not financial advice; trading involves risk.</p>
        </div>
      </div>
    </footer>
  );
}
