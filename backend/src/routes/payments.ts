import express, { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { env, features } from "../lib/env";
import { createOrder, verifyCheckoutSignature, verifyWebhookSignature } from "../lib/razorpay";
import { markPaid } from "../lib/payments";

/** Public pay-link endpoints: /api/payments/:token */
export const paymentsRouter = Router();

async function byToken(token: string) {
  const p = await prisma.payment.findUnique({ where: { publicToken: token } });
  if (!p) throw new HttpError(404, "Payment link not found");
  return p;
}

paymentsRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const p = await byToken(req.params.token);
    const expired = p.status === "CREATED" && p.expiresAt && p.expiresAt < new Date();
    res.json({
      payment: {
        reference: p.reference,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        payerName: p.payerName,
        status: expired ? "EXPIRED" : p.status,
        paidAt: p.paidAt,
      },
      enabled: features.payments,
    });
  }),
);

paymentsRouter.post(
  "/:token/order",
  asyncHandler(async (req, res) => {
    const p = await byToken(req.params.token);
    if (p.status === "PAID") throw new HttpError(400, "This payment is already complete");
    if (p.status !== "CREATED" && p.status !== "FAILED") throw new HttpError(400, "This payment link is no longer active");
    if (p.expiresAt && p.expiresAt < new Date()) throw new HttpError(400, "This payment link has expired. Please contact us for a new one.");
    // Reuse an existing order so repeated clicks don't create duplicates
    const orderId =
      p.providerOrderId ??
      (await createOrder({ amount: Number(p.amount), currency: p.currency, receipt: p.reference, notes: { reference: p.reference } }));
    if (!p.providerOrderId) await prisma.payment.update({ where: { id: p.id }, data: { providerOrderId: orderId } });
    res.json({
      keyId: env.razorpay.keyId,
      orderId,
      amount: p.amount,
      currency: p.currency,
      description: p.description,
      prefill: { name: p.payerName, email: p.payerEmail, contact: p.payerPhone ?? "" },
    });
  }),
);

paymentsRouter.post(
  "/:token/verify",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }),
      req.body,
    );
    const p = await byToken(req.params.token);
    if (!p.providerOrderId || p.providerOrderId !== body.razorpay_order_id) throw new HttpError(400, "Order mismatch");
    if (!verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      throw new HttpError(400, "Payment signature could not be verified");
    }
    await markPaid(p.id, body.razorpay_payment_id, "checkout");
    res.json({ ok: true, reference: p.reference });
  }),
);

/** Razorpay webhook: /api/webhooks/razorpay. Mounted with a raw body parser. */
export const webhookRouter = Router();
webhookRouter.post(
  "/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    const sig = req.header("x-razorpay-signature") ?? "";
    if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(req.body, sig)) throw new HttpError(400, "Invalid signature");
    const event = JSON.parse(req.body.toString("utf8")) as {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string } } };
    };
    const entity = event.payload?.payment?.entity;
    if (entity?.order_id) {
      const p = await prisma.payment.findUnique({ where: { providerOrderId: entity.order_id } });
      if (p) {
        if (event.event === "payment.captured" || event.event === "order.paid") await markPaid(p.id, entity.id, "webhook");
        else if (event.event === "payment.failed" && p.status === "CREATED") {
          await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED" } });
        }
      }
    }
    res.json({ ok: true });
  }),
);
