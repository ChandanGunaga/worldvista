import crypto from "crypto";
import type { PaymentPurpose } from "@prisma/client";
import { prisma } from "./prisma";
import { reference } from "./ids";
import { sendMail } from "./mailer";
import { sendWhatsApp } from "./whatsapp";
import { audit } from "./audit";
import { env } from "./env";

export const payLink = (token: string) => `${env.frontendUrl}/pay/${token}`;

export async function createPayment(data: {
  purpose: PaymentPurpose;
  amount: number;
  currency: string;
  description: string;
  payerName: string;
  payerEmail: string;
  payerPhone?: string | null;
  enquiryId?: string;
  enrollmentId?: string;
  userId?: string | null;
  createdById?: string;
  expiresInDays?: number;
}) {
  const { expiresInDays = 7, ...rest } = data;
  return prisma.payment.create({
    data: {
      ...rest,
      reference: reference("PAY"),
      publicToken: crypto.randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + expiresInDays * 86400000),
    },
  });
}

/**
 * Marks a payment as paid exactly once (safe to call from both the browser
 * callback and the webhook) and runs the side effects for its purpose.
 */
export async function markPaid(paymentId: string, providerPaymentId: string, source: "checkout" | "webhook") {
  const updated = await prisma.payment.updateMany({
    where: { id: paymentId, status: { in: ["CREATED", "FAILED"] } },
    data: { status: "PAID", providerPaymentId, paidAt: new Date() },
  });
  if (updated.count === 0) return false; // already processed

  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { enquiry: true, enrollment: { include: { course: true } } } });
  if (p.enquiryId) await prisma.enquiry.update({ where: { id: p.enquiryId }, data: { status: "CONFIRMED" } });
  if (p.enrollmentId) await prisma.enrollment.update({ where: { id: p.enrollmentId }, data: { status: "ENROLLED" } });
  const userId = p.userId ?? p.enquiry?.userId ?? p.enrollment?.userId;
  if (userId) {
    await prisma.notification.create({ data: { userId, title: "Payment received", body: `${p.description} — ${p.currency} ${p.amount} (${p.reference})` } });
  }
  await audit({ action: "payment.paid", entity: "Payment", entityId: p.id, after: { reference: p.reference, amount: p.amount.toString(), currency: p.currency, providerPaymentId, source } });
  const msg = `Thank you! We received your payment of ${p.currency} ${p.amount} for ${p.description}. Receipt reference: ${p.reference}.`;
  await sendMail(p.payerEmail, `Payment received — ${p.reference}`, `Hi ${p.payerName},\n\n${msg}\n\nWorld Vista`).catch((e) => console.error("mail", e));
  await sendWhatsApp(p.payerPhone, `World Vista: ${msg}`);
  return true;
}
