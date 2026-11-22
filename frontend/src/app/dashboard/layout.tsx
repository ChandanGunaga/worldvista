"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { SessionGate, useSession } from "@/components/session";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/profile", label: "Profile & Security" },
  { href: "/dashboard/referral", label: "My Referral Link" },
  { href: "/dashboard/team", label: "My Team" },
  { href: "/dashboard/tours", label: "Tour Packages" },
  { href: "/dashboard/education", label: "Financial Education" },
  { href: "/dashboard/programs", label: "Wallet & Programs" },
  { href: "/dashboard/support", label: "Support" },
  { href: "/dashboard/notifications", label: "Notifications" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className={clsx("fixed inset-y-0 left-0 z-40 w-[260px] flex-col bg-navy-900 text-white lg:static lg:flex", open ? "flex" : "hidden")}>
        <Link href="/" className="px-5 py-4"><Image src="/logo.png" alt="World Vista" width={170} height={56} className="h-11 w-auto" /></Link>
        <div className="mx-4 mb-4 rounded-xl bg-white/5 px-4 py-3">
          <div className="truncate text-sm font-semibold">{user?.fullName}</div>
          <div className="text-xs text-gold-400">{user?.memberId}</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Member">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={clsx("block rounded-lg px-3 py-2 text-sm transition", isActive(n.href) ? "bg-gold-400 font-semibold text-navy-950" : "text-white/75 hover:bg-white/5 hover:text-white")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button onClick={logout} className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white">Sign out</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-navy-950/50 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0">
        <div className="flex items-center justify-between bg-navy-900 px-4 py-3 lg:hidden">
          <Image src="/logo.png" alt="World Vista" width={120} height={40} className="h-8 w-auto" />
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-white" aria-label="Open menu">☰</button>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate><Shell>{children}</Shell></SessionGate>;
}
