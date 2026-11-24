"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useApi } from "@/components/useApi";
import { CopyButton, PageHeader, SecNo, Spinner } from "@/components/ui";

function QR({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: "#0B0B0D", light: "#F7E3A1" } }).then(setSrc).catch(() => setSrc(""));
  }, [text]);
  if (!src) return <div className="aspect-square w-40 animate-pulse rounded-2xl bg-white/5" />;
  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`QR code: ${label}`} className="w-40 rounded-2xl border border-gold-400/40 shadow-glow" />
      <a href={src} download={`world-vista-${label.toLowerCase().replace(/\s+/g, "-")}.png`} className="text-xs text-gold-300 underline">Download QR</a>
    </div>
  );
}

export default function Referral() {
  const { data } = useApi<{ memberId: string; leftLink: string; rightLink: string }>("/member/referral");
  if (!data) return <Spinner />;
  const general = data.leftLink.replace(/&side=LEFT$/, "");
  return (
    <>
      <PageHeader title="Referral Link & QR" subtitle="Invite friends and family to discover World Vista travel and learning." />
      <div className="lux-card-gold flex flex-wrap items-center gap-6 p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-white/45">Your Member / referrer ID</div>
          <div className="mt-1 flex items-center gap-3"><span className="font-mono text-4xl tracking-wider text-gold-grad">{data.memberId}</span><CopyButton text={data.memberId} /></div>
        </div>
        <div className="ml-auto"><QR text={general} label="Referral" /></div>
      </div>

      <div className="mt-10"><SecNo n={1}>Placement links</SecNo></div>
      <div className="grid gap-5 md:grid-cols-2">
        {[["Left team link", data.leftLink], ["Right team link", data.rightLink]].map(([label, link]) => (
          <div key={label} className="lux-card flex gap-5 p-5">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{label}</div>
              <div className="mt-2 break-all rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-xs text-white/65">{link}</div>
              <div className="mt-3"><CopyButton text={link} /></div>
            </div>
            <QR text={link} label={label} />
          </div>
        ))}
      </div>

      <div className="mt-10"><SecNo n={2}>How referrals work</SecNo></div>
      <div className="grid gap-4 md:grid-cols-3">
        {["Share your link, QR code or Member ID.", "Your contact registers and verifies their email.", "They appear in My Genealogy under you, on the side you chose."].map((t, i) => (
          <div key={t} className="lux-card p-5"><div className="font-serif text-3xl text-gold-grad">0{i + 1}</div><p className="mt-2 text-sm text-white/65">{t}</p></div>
        ))}
      </div>
      <p className="mt-6 rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] px-5 py-4 text-sm text-gold-100/80">
        Please don’t make income, earnings or investment-return claims when sharing World Vista. Describe our travel and education services only.
      </p>
    </>
  );
}
