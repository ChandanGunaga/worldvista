"use client";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Spinner } from "@/components/ui";
import { fmtDate, money } from "@/lib/api";

type Receipt = {
  activation: {
    id: string; receiptNo: string; kind: string; itemName: string; travellers: number; unitPrice: string; serviceCharge: string; total: string; status: string;
    createdAt: string; cancelReason: string | null;
    enquiry: { reference: string; status: string; preferredDate: string | null } | null;
    ledger: { txId: string; type: string; amount: string; balanceAfter: string; createdAt: string }[];
    user: { fullName: string; memberId: string; email: string };
  };
  company: { legalName?: string; registration?: string; gstin?: string } | null;
};

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<Receipt>(`/member/activations/${id}`);
  if (loading) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  const a = data.activation;
  const debit = a.ledger.find((l) => l.type === "ACTIVATION_DEBIT");
  const refund = a.ledger.find((l) => l.type === "ACTIVATION_REFUND");
  const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div className={`flex justify-between py-2.5 ${strong ? "border-t border-gold-400/30 text-lg font-semibold text-white" : "border-b border-white/[0.06] text-sm text-white/70"}`}><span>{k}</span><span>{v}</span></div>
  );
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-5 flex justify-between">
        <Link href="/dashboard/credits" className="btn-outline btn-sm">← Back</Link>
        <button className="btn-lux !px-4 !py-2 text-xs" onClick={() => window.print()}>Print / save PDF</button>
      </div>
      <div className="lux-card-gold print-sheet p-8">
        <div className="flex items-start justify-between gap-4">
          <Image src="/images/logo-gold-t.png" alt="World Vista" width={150} height={73} className="h-14 w-auto" />
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">Package activation receipt</div>
            <div className="font-mono text-lg text-gold-300">{a.receiptNo}</div>
            <div className="text-xs text-white/45">{fmtDate(a.createdAt, true)}</div>
          </div>
        </div>
        <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
          <div><div className="text-white/40">Member</div><div className="text-white">{a.user.fullName}</div><div className="font-mono text-xs text-white/55">{a.user.memberId} · {a.user.email}</div></div>
          <div className="sm:text-right"><div className="text-white/40">Status</div><Badge value={a.status} />{a.enquiry && <div className="mt-1 font-mono text-xs text-white/55">Booking {a.enquiry.reference}</div>}</div>
        </div>
        <div className="mt-8">
          <div className="mb-2 font-serif text-xl text-white">{a.itemName}</div>
          {a.kind === "TOUR" && <div className="mb-3 text-sm text-white/50">{a.travellers} traveller(s){a.enquiry?.preferredDate ? ` · preferred departure ${fmtDate(a.enquiry.preferredDate)}` : ""}</div>}
          <Row k={`Package price${a.travellers > 1 ? ` (${money(a.unitPrice, "USD")} × ${a.travellers})` : ""}`} v={money(Number(a.unitPrice) * a.travellers, "USD")} />
          <Row k="Service charges" v={money(Number(a.serviceCharge) * a.travellers, "USD")} />
          <Row k="Paid with USD Package Credit" v={money(a.total, "USD")} strong />
        </div>
        <div className="mt-6 space-y-1 text-xs text-white/45">
          {debit && <div>Transaction ID <span className="font-mono">{debit.txId}</span> · balance after {money(debit.balanceAfter, "USD")}</div>}
          {refund && <div>Refunded to credit balance: <span className="font-mono">{refund.txId}</span> on {fmtDate(refund.createdAt)}</div>}
          {a.cancelReason && <div>Cancellation reason: {a.cancelReason}</div>}
        </div>
        <div className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
          {data.company?.legalName ?? "World Vista"}{data.company?.registration ? ` · ${data.company.registration}` : ""}{data.company?.gstin ? ` · GSTIN ${data.company.gstin}` : ""}.
          USD Package Credit is a non-withdrawable, non-transferable credit for World Vista packages. Cancellations follow the Travel Cancellation & Refund Policy.
        </div>
      </div>
    </div>
  );
}
