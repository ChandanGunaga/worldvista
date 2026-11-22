"use client";
import Link from "next/link";
import Script from "next/script";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Badge, Spinner } from "@/components/ui";
import { api, fmtDate, money } from "@/lib/api";

type PayInfo = {
  payment: { reference: string; description: string; amount: string; currency: string; payerName: string; status: string; paidAt: string | null };
  enabled: boolean;
};
type Order = { keyId: string; orderId: string; amount: string; currency: string; description: string; prefill: { name: string; email: string; contact: string } };
type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
  }
}

export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, loading, reload } = useApi<PayInfo>(`/payments/${token}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function pay() {
    setBusy(true);
    setMsg(null);
    try {
      if (!window.Razorpay) throw new Error("Payment window failed to load. Check your connection and try again.");
      const o = await api<Order>(`/payments/${token}/order`, { method: "POST" });
      const rzp = new window.Razorpay({
        key: o.keyId,
        order_id: o.orderId,
        name: "World Vista",
        description: o.description,
        image: "/images/logo-gold.png",
        prefill: o.prefill,
        theme: { color: "#0E1F4D" },
        handler: async (r: RzpResponse) => {
          try {
            await api(`/payments/${token}/verify`, { method: "POST", json: r });
            setMsg({ kind: "success", text: "Payment successful! A receipt has been emailed to you." });
            reload();
          } catch (e) {
            setMsg({ kind: "error", text: `We couldn't confirm the payment yet (${(e as Error).message}). If money was debited, it will be confirmed automatically — contact support with your reference.` });
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (r) => {
        setMsg({ kind: "error", text: r.error?.description ?? "Payment failed. Please try again." });
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-16">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="card w-full max-w-md p-8">
        <p className="eyebrow">Secure payment</p>
        {loading ? <Spinner /> : error || !data ? <div className="mt-4"><Alert>{error ?? "Payment link not found"}</Alert></div> : (
          <>
            <h1 className="mt-2 text-2xl text-navy-950">{data.payment.description}</h1>
            <p className="mt-1 text-sm text-slate-500">For {data.payment.payerName} · Ref {data.payment.reference}</p>
            <div className="my-6 rounded-xl bg-cream p-5 text-center">
              <div className="font-serif text-4xl text-navy-950">{money(data.payment.amount, data.payment.currency)}</div>
              <div className="mt-2"><Badge value={data.payment.status} /></div>
            </div>
            {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
            {data.payment.status === "PAID" ? (
              <p className="text-center text-sm text-slate-600">Paid on {fmtDate(data.payment.paidAt, true)}. Thank you!</p>
            ) : data.payment.status === "CREATED" || data.payment.status === "FAILED" ? (
              data.enabled ? (
                <button className="btn-gold w-full" disabled={busy} onClick={pay}>{busy ? "Processing…" : `Pay ${money(data.payment.amount, data.payment.currency)}`}</button>
              ) : <Alert kind="info">Online payment is temporarily unavailable. Please contact us.</Alert>
            ) : <Alert kind="info">This payment link is no longer active. Please contact us for a new one.</Alert>}
            <p className="mt-6 text-center text-xs text-slate-500">Payments are processed securely by Razorpay. World Vista never sees your card or UPI details. <Link href="/legal/refund-policy" className="underline">Refund policy</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
