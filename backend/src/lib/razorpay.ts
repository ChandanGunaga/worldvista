import crypto from "crypto";
import { env, features } from "./env";
import { HttpError } from "./http";

/** Currencies with no minor unit would need factor 1; USD and INR use 100. */
const MINOR_UNITS: Record<string, number> = { USD: 100, INR: 100, AED: 100, EUR: 100, GBP: 100 };

export function toMinor(amount: number, currency: string) {
  const f = MINOR_UNITS[currency];
  if (!f) throw new HttpError(400, `Unsupported currency ${currency}`);
  return Math.round(amount * f);
}

export async function createOrder(opts: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }) {
  if (!features.payments) throw new HttpError(503, "Online payments are not configured yet");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64"),
    },
    body: JSON.stringify({
      amount: toMinor(opts.amount, opts.currency),
      currency: opts.currency,
      receipt: opts.receipt.slice(0, 40),
      notes: opts.notes,
    }),
  });
  const data = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok || !data.id) {
    console.error("Razorpay order failed", res.status, data.error?.description);
    throw new HttpError(502, "Payment provider error. Please try again.");
  }
  return data.id;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Verifies the signature returned to the browser by Razorpay Checkout. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = env.razorpay.keySecret) {
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Verifies the X-Razorpay-Signature header of a webhook against the raw body. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret = env.razorpay.webhookSecret) {
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
