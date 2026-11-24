"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/tours", label: "Journeys" },
  { href: "/education", label: "Academy" },
  { href: "/ai-markets", label: "Insights" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
      <div
        className={clsx(
          "mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full border px-4 transition-all duration-500 sm:h-[72px] sm:px-6",
          scrolled ? "border-white/10 bg-onyx-850/85 shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl" : "border-white/[0.06] bg-onyx-850/50 backdrop-blur-md",
        )}
      >
        <Link href="/" className="flex shrink-0 items-center" aria-label="World Vista home">
          <Image src="/images/logo-gold-t.png" alt="World Vista" width={900} height={439} priority className="h-10 w-auto sm:h-11" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "relative px-3.5 py-2 text-[13px] font-bold uppercase tracking-[0.08em] transition-colors xl:px-4",
                active(n.href) ? "text-gold-300" : "text-white/85 hover:text-gold-200",
              )}
            >
              {active(n.href) && <span className="absolute -top-[14px] left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-gold-grad sm:-top-[18px]" />}
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/tours#enquire" className="text-[13px] font-bold uppercase tracking-[0.08em] text-white/80 transition hover:text-gold-200">Plan a trip</Link>
          <Link href="/login" className="btn-lux py-2.5 text-[13px] uppercase tracking-[0.08em]">Login</Link>
        </div>
        <button className="rounded-full p-2 text-gold-200 lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M8 12h12M4 17h16"} /></svg>
        </button>
      </div>
      <div className={clsx("mx-auto mt-2 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-onyx-850/95 backdrop-blur-xl transition-all duration-500 lg:hidden", open ? "max-h-[520px] opacity-100" : "max-h-0 border-transparent opacity-0")}>
        <nav className="flex flex-col p-4" aria-label="Mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={clsx("rounded-xl px-3 py-3 text-sm font-bold uppercase tracking-[0.08em]", active(n.href) ? "bg-gold-400/10 text-gold-300" : "text-white/85")}>{n.label}</Link>
          ))}
          <Link href="/login" className="btn-lux mt-3">Member login</Link>
        </nav>
      </div>
    </header>
  );
}
