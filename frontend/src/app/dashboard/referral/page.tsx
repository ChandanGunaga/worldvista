"use client";
import { useApi } from "@/components/useApi";
import { CopyButton, PageHeader, Spinner } from "@/components/ui";

export default function Referral() {
  const { data } = useApi<{ memberId: string; leftLink: string; rightLink: string }>("/member/referral");
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="My Referral Link" subtitle="Invite friends and family to discover World Vista." />
      <div className="card p-6">
        <div className="text-sm text-slate-500">Your member / referrer ID</div>
        <div className="mt-1 flex items-center gap-3"><span className="font-serif text-3xl text-navy-950">{data.memberId}</span><CopyButton text={data.memberId} /></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[["Left team link", data.leftLink], ["Right team link", data.rightLink]].map(([label, link]) => (
            <div key={label} className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-navy-950">{label}</div>
              <div className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">{link}</div>
              <div className="mt-3"><CopyButton text={link} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card mt-6 p-6 text-sm text-slate-600">
        <h2 className="text-lg text-navy-950">How referrals work</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>Share your link or member ID.</li>
          <li>Your contact registers and verifies their email.</li>
          <li>They appear under <strong>My Team</strong> on the side you chose.</li>
        </ol>
        <p className="mt-4 rounded-lg bg-gold-50 px-4 py-3 text-gold-700">Please don&apos;t make income, earnings or investment-return claims when sharing World Vista. Describe our travel and education services only.</p>
      </div>
    </>
  );
}
