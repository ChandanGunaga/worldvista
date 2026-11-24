"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { SessionGate, useSession } from "@/components/session";

const GROUPS: { title: string; items: { href: string; label: string; icon: string }[] }[] = [
  { title: "Account", items: [
    { href: "/dashboard", label: "Overview", icon: "◈" },
    { href: "/dashboard/profile", label: "Profile & Security", icon: "◎" },
  ] },
  { title: "Travel & Learn", items: [
    { href: "/dashboard/tours", label: "Tour Packages", icon: "✈" },
    { href: "/dashboard/bookings", label: "My Bookings", icon: "▤" },
    { href: "/dashboard/education", label: "Academy & Classes", icon: "✦" },
  ] },
  { title: "Package Credit", items: [
    { href: "/dashboard/credits", label: "USD Package Credit", icon: "$" },
  ] },
  { title: "Earnings", items: [
    { href: "/dashboard/income", label: "Income & Wallet", icon: "◆" },
    { href: "/dashboard/volume", label: "Business Volume", icon: "⇄" },
    { href: "/dashboard/ranks", label: "My Ranks", icon: "★" },
    { href: "/dashboard/withdrawals", label: "Withdrawals", icon: "↗" },
    { href: "/dashboard/plan", label: "Business Plan", icon: "≡" },
  ] },
  { title: "Network", items: [
    { href: "/dashboard/referral", label: "Referral Link & QR", icon: "⌘" },
    { href: "/dashboard/team", label: "Genealogy", icon: "⋔" },
  ] },
  { title: "Help", items: [
    { href: "/dashboard/support", label: "Support", icon: "?" },
    { href: "/dashboard/notifications", label: "Notifications", icon: "◔" },
  ] },
];

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));

  return (
    <div className="site-dark min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-40 w-[272px] flex-col border-r border-white/[0.06] bg-onyx-950/95 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen",
        open ? "flex" : "hidden",
      )}>
        <Link href="/" className="px-6 pb-3 pt-6"><Image src="/images/logo-gold-t.png" alt="World Vista" width={180} height={88} className="h-14 w-auto" /></Link>
        <div className="mx-4 mb-4 rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-400/10 to-transparent px-4 py-3">
          <div className="truncate text-sm font-semibold text-white">{user?.fullName}</div>
          <div className="font-mono text-xs tracking-wider text-gold-300">{user?.memberId}</div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Member">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">{g.title}</div>
              {g.items.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                  className={clsx("mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition", isActive(n.href) ? "portal-nav-active" : "text-white/65 hover:bg-white/[0.05] hover:text-white")}>
                  <span className={clsx("grid h-6 w-6 place-items-center rounded-lg text-xs", isActive(n.href) ? "bg-onyx-950/15" : "bg-white/[0.05] text-gold-300")}>{n.icon}</span>
                  {n.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <button onClick={logout} className="w-full rounded-xl px-3 py-2 text-left text-sm text-white/60 hover:bg-white/5 hover:text-white">Sign out →</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="relative min-w-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(226,176,74,0.10),transparent_65%)]" />
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-onyx-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <Image src="/images/logo-gold-t.png" alt="World Vista" width={120} height={58} className="h-9 w-auto" />
          <button onClick={() => setOpen(true)} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white" aria-label="Open menu">Menu</button>
        </div>
        <main className="relative mx-auto max-w-6xl animate-rise px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate><Shell>{children}</Shell></SessionGate>;
}
