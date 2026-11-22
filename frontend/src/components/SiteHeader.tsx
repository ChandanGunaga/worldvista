"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/tours", label: "Tour Packages" },
  { href: "/education", label: "Education" },
  { href: "/ai-markets", label: "AI & Markets" },
  { href: "/faq", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-navy-900/95 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="World Vista home">
          <Image src="/logo.png" alt="World Vista" width={168} height={56} priority className="h-11 w-auto" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "rounded-full px-3 py-2 text-sm font-medium transition",
                path === n.href ? "text-gold-400" : "text-white/80 hover:text-white",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="btn-ghost-light btn-sm">Member Login</Link>
          <Link href="/tours#enquire" className="btn-gold btn-sm">Plan a Trip</Link>
        </div>
        <button className="rounded-lg p-2 text-white lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
        </button>
      </div>
      {open && (
        <nav className="border-t border-white/10 bg-navy-900 lg:hidden" aria-label="Mobile">
          <div className="container-x flex flex-col py-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-2.5 text-white/90">{n.label}</Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="btn-gold mt-3">Member Login</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
