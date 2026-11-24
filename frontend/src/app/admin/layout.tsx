"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { SessionGate, useSession } from "@/components/session";
import type { Role } from "@/lib/types";

type NavItem = { href: string; label: string; roles?: Role[] };
const NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/members", label: "Members", roles: ["SUPPORT_ADMIN"] },
  { href: "/admin/genealogy", label: "Genealogy", roles: ["SUPPORT_ADMIN"] },
  { href: "/admin/enquiries", label: "Enquiries", roles: ["SUPPORT_ADMIN", "CONTENT_ADMIN"] },
  { href: "/admin/packages", label: "Packages", roles: ["CONTENT_ADMIN"] },
  { href: "/admin/courses", label: "Courses & Enrolments", roles: ["CONTENT_ADMIN", "SUPPORT_ADMIN"] },
  { href: "/admin/content", label: "Content pages", roles: ["CONTENT_ADMIN"] },
  { href: "/admin/faqs", label: "FAQs", roles: ["CONTENT_ADMIN"] },
  { href: "/admin/settings", label: "Settings", roles: ["CONTENT_ADMIN"] },
  { href: "/admin/tickets", label: "Support tickets", roles: ["SUPPORT_ADMIN"] },
  { href: "/admin/payments", label: "Payments", roles: ["FINANCE_ADMIN", "SUPPORT_ADMIN"] },
  { href: "/admin/credits", label: "USD Credits", roles: ["FINANCE_ADMIN"] },
  { href: "/admin/activations", label: "Package Activations", roles: ["FINANCE_ADMIN", "SUPPORT_ADMIN"] },
  { href: "/admin/withdrawals", label: "Withdrawals", roles: ["FINANCE_ADMIN"] },
  { href: "/admin/compensation", label: "Commission settings", roles: ["FINANCE_ADMIN"] },
  { href: "/admin/compensation/weeks", label: "Binary weeks & cap", roles: ["FINANCE_ADMIN"] },
  { href: "/admin/compensation/ledger", label: "Reward audit", roles: ["FINANCE_ADMIN"] },
  { href: "/admin/ranks", label: "Ranks", roles: ["FINANCE_ADMIN"] },
  { href: "/admin/integrations", label: "Integrations", roles: [] },
  { href: "/admin/reports", label: "Reports", roles: ["FINANCE_ADMIN", "SUPPORT_ADMIN"] },
  { href: "/admin/staff", label: "Staff & roles", roles: [] },
  { href: "/admin/modules", label: "Modules pending approval", roles: [] },
  { href: "/admin/audit", label: "Audit log", roles: [] },
];

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const role = user!.role;
  const items = NAV.filter((n) => !n.roles || role === "SUPER_ADMIN" || n.roles.includes(role));

  return (
    <div className="site-dark min-h-screen lg:flex">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-onyx-950 px-4 py-3 lg:hidden">
        <Image src="/images/logo-gold-t.png" alt="World Vista" width={120} height={58} className="h-9 w-auto" />
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white" aria-expanded={open}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <aside className={clsx("flex-col border-r border-white/[0.06] bg-onyx-950 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[264px] lg:shrink-0", open ? "flex" : "hidden")}>
        <div className="hidden px-5 pb-2 pt-6 lg:block">
          <Image src="/images/logo-gold-t.png" alt="World Vista" width={180} height={88} className="h-14 w-auto" />
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-400">Admin console</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {items.map((n) => {
            const active = n.href === "/admin" || n.href === "/admin/compensation" ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "mb-0.5 block rounded-xl px-3 py-2 text-sm transition",
                  active ? "portal-nav-active" : "text-white/60 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="truncate text-sm font-medium">{user!.fullName}</div>
          <div className="text-xs text-gold-300">{role.replace(/_/g, " ")}</div>
          <div className="mt-3 flex gap-2">
            <Link href="/dashboard" className="btn-ghost-light btn-sm">Member view</Link>
            <button onClick={logout} className="btn-ghost-light btn-sm">Log out</button>
          </div>
        </div>
      </aside>
      <main className="relative min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10"><div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(226,176,74,0.08),transparent_65%)]" /><div className="relative animate-rise">{children}</div></main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGate admin>
      <Shell>{children}</Shell>
    </SessionGate>
  );
}
