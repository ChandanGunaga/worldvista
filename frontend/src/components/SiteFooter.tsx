import Image from "next/image";
import Link from "next/link";
import { serverApi } from "@/lib/api";

type Contact = { email?: string; phone?: string; address?: string; hours?: string };

export async function SiteFooter() {
  const data = await serverApi<{ settings: { contact?: Contact } }>("/public/settings");
  const c = data?.settings.contact ?? {};
  return (
    <footer className="bg-navy-950 text-white/70">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Image src="/logo.png" alt="World Vista" width={180} height={60} className="h-12 w-auto" />
          <p className="mt-4 font-serif text-lg italic text-white">&ldquo;More Meaningful Life&rdquo;</p>
          <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-gold-400">TRAVEL • LEARN • EXPERIENCE</p>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-sm font-semibold text-white">Explore</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/tours" className="hover:text-white">Tour Packages</Link></li>
            <li><Link href="/education" className="hover:text-white">Financial Markets Education</Link></li>
            <li><Link href="/ai-markets" className="hover:text-white">AI & Financial Markets</Link></li>
            <li><Link href="/about" className="hover:text-white">About World Vista</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-sm font-semibold text-white">Policies</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/legal/terms" className="hover:text-white">Terms & Conditions</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/legal/refund-policy" className="hover:text-white">Cancellation & Refunds</Link></li>
            <li><Link href="/legal/disclaimer" className="hover:text-white">Disclaimer</Link></li>
            <li><Link href="/legal/grievance" className="hover:text-white">Grievance Redressal</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-sm font-semibold text-white">Contact</h3>
          <ul className="space-y-2 text-sm">
            {c.email && <li><a href={`mailto:${c.email}`} className="hover:text-white">{c.email}</a></li>}
            {c.phone && <li>{c.phone}</li>}
            {c.address && <li>{c.address}</li>}
            {c.hours && <li className="text-white/50">{c.hours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-white/50 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} World Vista. All rights reserved.</p>
          <p className="max-w-2xl md:text-right">Tour prices exclude service charges. Education content is for educational purposes only and is not financial advice; trading involves risk.</p>
        </div>
      </div>
    </footer>
  );
}
