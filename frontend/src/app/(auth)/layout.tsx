import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-dark grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-onyx-950 lg:block">
        <Image src="/images/hero.jpg" alt="" fill className="animate-kenburns object-cover opacity-50" sizes="50vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-onyx-950 via-onyx-950/40 to-onyx-950/10" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold-400/40 to-transparent" />
        <div className="absolute bottom-14 left-12 right-12">
          <span className="chip">Travel • Learn • Experience</span>
          <p className="mt-6 font-serif text-5xl leading-tight text-white">A More <span className="text-gold-grad italic">Meaningful</span> Life</p>
          <p className="mt-4 max-w-md text-white/55">Curated journeys, practical learning and a member community, all in one place.</p>
        </div>
      </div>
      <div className="relative flex flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(226,176,74,0.10),transparent_60%)]" />
        <div className="relative px-6 py-5">
          <Link href="/" className="inline-block"><Image src="/images/logo-gold-t.png" alt="World Vista" width={150} height={73} className="h-12 w-auto" /></Link>
        </div>
        <div className="relative flex flex-1 items-center justify-center px-6 py-10">
          <div className="lux-card-gold w-full max-w-md animate-rise p-7 sm:p-9"><Suspense>{children}</Suspense></div>
        </div>
      </div>
    </div>
  );
}
