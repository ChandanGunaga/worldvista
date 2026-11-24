import crypto from "crypto";
import { Prisma, type LedgerType } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { reference } from "./ids";

/**
 * USD Package Credit (spec §25).
 *
 * Closed-loop credit that can only be spent on World Vista's own tour and course
 * packages. It is NOT withdrawable, NOT transferable and NOT an investment or
 * income balance. Every movement is an append-only ledger row; the member's
 * balance is the sum of their ledger rows. All mutations take a row lock on the
 * member (SELECT … FOR UPDATE) so concurrent activations can't double-spend.
 */

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;
const ZERO = new D(0);

export const CREDIT_CURRENCY = "USD";

const txId = () => "TXN-" + crypto.randomBytes(6).toString("hex").toUpperCase();

async function lockMember(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  if (!rows.length) throw new HttpError(404, "Member not found");
}

export async function ledgerBalance(tx: Tx, userId: string): Promise<Prisma.Decimal> {
  const agg = await tx.creditLedgerEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? ZERO;
}

/** Appends a ledger row. Caller must hold the member lock. Refuses negative balances. */
async function append(
  tx: Tx,
  e: { userId: string; type: LedgerType; amount: Prisma.Decimal; creditId?: string; activationId?: string; reversesId?: string; actorId?: string | null; memo?: string },
) {
  const current = await ledgerBalance(tx, e.userId);
  const after = current.add(e.amount);
  if (after.isNegative()) throw new HttpError(400, "Insufficient USD credit balance");
  return tx.creditLedgerEntry.create({
    data: {
      txId: txId(),
      userId: e.userId,
      type: e.type,
      amount: e.amount,
      balanceAfter: after,
      creditId: e.creditId,
      activationId: e.activationId,
      reversesId: e.reversesId,
      actorId: e.actorId ?? null,
      memo: e.memo ?? "",
    },
  });
}

export async function creditSummary(userId: string) {
  const [ledger, pending, voided] = await Promise.all([
    prisma.creditLedgerEntry.groupBy({ by: ["type"], where: { userId }, _sum: { amount: true } }),
    prisma.usdCredit.aggregate({ where: { userId, status: "PENDING" }, _sum: { amount: true } }),
    prisma.usdCredit.aggregate({ where: { userId, status: "VOIDED", approvedAt: null }, _sum: { amount: true } }),
  ]);
  const by = (t: LedgerType) => ledger.find((l) => l.type === t)?._sum.amount ?? ZERO;
  const available = ledger.reduce((s, l) => s.add(l._sum.amount ?? ZERO), ZERO);
  return {
    currency: CREDIT_CURRENCY,
    available: available.toFixed(2),
    pending: (pending._sum.amount ?? ZERO).toFixed(2),
    received: by("CREDIT_APPROVED").toFixed(2),
    spent: by("ACTIVATION_DEBIT").add(by("ACTIVATION_REFUND")).neg().toFixed(2),
    refunded: by("ACTIVATION_REFUND").toFixed(2),
    reversed: by("CREDIT_REVERSAL").neg().add(voided._sum.amount ?? ZERO).toFixed(2),
  };
}

// ---------------- Admin: credits ----------------

export async function createCredit(input: { userId: string; amount: number; internalNote: string; createdById: string }) {
  if (!(input.amount > 0) || input.amount > 100000) throw new HttpError(400, "Amount must be between 0.01 and 100,000");
  return prisma.usdCredit.create({
    data: {
      reference: reference("CR"),
      userId: input.userId,
      amount: new D(input.amount).toDecimalPlaces(2),
      internalNote: input.internalNote,
      createdById: input.createdById,
    },
  });
}

export async function approveCredit(creditId: string, approver: { id: string; role: string }, fundingRef: string) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.usdCredit.findUnique({ where: { id: creditId } });
    if (!c) throw new HttpError(404, "Credit not found");
    if (c.createdById === approver.id && approver.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "A different administrator must approve a credit you generated");
    }
    await lockMember(tx, c.userId);
    // Conditional update = idempotent: a second approve finds no PENDING row.
    const upd = await tx.usdCredit.updateMany({
      where: { id: c.id, status: "PENDING" },
      data: { status: "APPROVED", approvedById: approver.id, approvedAt: new Date(), fundingRef },
    });
    if (upd.count !== 1) throw new HttpError(409, "Only pending credits can be approved");
    const entry = await append(tx, { userId: c.userId, type: "CREDIT_APPROVED", amount: c.amount, creditId: c.id, actorId: approver.id, memo: `Credit ${c.reference}` });
    return { credit: { ...c, status: "APPROVED" as const }, entry };
  });
}

export async function voidCredit(creditId: string, actorId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.usdCredit.findUnique({ where: { id: creditId }, include: { ledger: true } });
    if (!c) throw new HttpError(404, "Credit not found");
    await lockMember(tx, c.userId);
    const fresh = await tx.usdCredit.findUniqueOrThrow({ where: { id: c.id } });
    if (fresh.status === "VOIDED") throw new HttpError(409, "Credit is already void");
    if (fresh.status === "APPROVED") {
      const original = c.ledger.find((l) => l.type === "CREDIT_APPROVED");
      // append() refuses if the member already spent it, so a spent credit can't be voided.
      try {
        await append(tx, { userId: c.userId, type: "CREDIT_REVERSAL", amount: c.amount.neg(), creditId: c.id, reversesId: original?.id, actorId, memo: `Void ${c.reference}: ${reason}` });
      } catch (e) {
        if (e instanceof HttpError) throw new HttpError(409, "This credit has already been (partly) spent and can't be voided. Cancel the package activation first.");
        throw e;
      }
    }
    await tx.usdCredit.update({ where: { id: c.id }, data: { status: "VOIDED", voidedById: actorId, voidedAt: new Date(), voidReason: reason } });
    return fresh;
  });
}

// ---------------- Member: activation ----------------

export async function quote(kind: "TOUR" | "COURSE", itemId: string, travellers: number) {
  if (kind === "TOUR") {
    const p = await prisma.tourPackage.findFirst({ where: { id: itemId, active: true } });
    if (!p) throw new HttpError(404, "Package not found");
    if (!p.creditEligible || p.currency !== CREDIT_CURRENCY) throw new HttpError(400, "This package can't be paid with USD credit");
    const unit = new D(p.price);
    const charge = new D(p.serviceCharge);
    const total = unit.add(charge).mul(travellers);
    return { kind, itemName: p.name, packageId: p.id, courseId: null, unitPrice: unit, serviceCharge: charge, travellers, total, needsReview: true };
  }
  const c = await prisma.course.findFirst({ where: { id: itemId, active: true } });
  if (!c) throw new HttpError(404, "Course not found");
  if (!c.creditEligible || c.currency !== CREDIT_CURRENCY) throw new HttpError(400, "This course can't be paid with USD credit");
  if (!c.enrollmentOpen) throw new HttpError(400, "Enrolment is closed for this course");
  const unit = new D(c.tuition);
  return { kind, itemName: c.title, packageId: null, courseId: c.id, unitPrice: unit, serviceCharge: ZERO, travellers: 1, total: unit, needsReview: false };
}

export async function activate(input: {
  user: { id: string; fullName: string; email: string; mobile: string | null };
  kind: "TOUR" | "COURSE";
  itemId: string;
  travellers: number;
  preferredDate?: Date;
  message?: string;
  expectedTotal: string;
  idempotencyKey: string;
}) {
  const q = await quote(input.kind, input.itemId, input.kind === "TOUR" ? input.travellers : 1);
  if (!q.total.equals(new D(input.expectedTotal))) throw new HttpError(409, "The price changed. Please review the new total and confirm again.");

  return prisma.$transaction(
    async (tx) => {
      await lockMember(tx, input.user.id);
      const existing = await tx.packageActivation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.userId !== input.user.id) throw new HttpError(409, "Duplicate request");
        return { activation: existing, duplicate: true };
      }
      if ((await ledgerBalance(tx, input.user.id)).lessThan(q.total)) throw new HttpError(400, "Insufficient USD credit balance");

      let enquiryId: string | undefined;
      if (q.kind === "TOUR") {
        const enq = await tx.enquiry.create({
          data: {
            reference: reference("BKG"),
            type: "TOUR",
            packageId: q.packageId,
            userId: input.user.id,
            name: input.user.fullName,
            email: input.user.email,
            phone: input.user.mobile,
            travellers: q.travellers,
            preferredDate: input.preferredDate,
            message: input.message ?? "",
            status: "NEW",
            adminNotes: "Paid in full with USD Package Credit. Confirm dates and hotels, then approve the activation.",
          },
        });
        enquiryId = enq.id;
      } else {
        const enr = await tx.enrollment.findUnique({ where: { userId_courseId: { userId: input.user.id, courseId: q.courseId! } } });
        if (enr && (enr.status === "ENROLLED" || enr.status === "COMPLETED")) throw new HttpError(409, "You're already enrolled in this course");
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId: input.user.id, courseId: q.courseId! } },
          update: { status: "ENROLLED" },
          create: { userId: input.user.id, courseId: q.courseId!, status: "ENROLLED" },
        });
      }

      const activation = await tx.packageActivation.create({
        data: {
          receiptNo: reference("RCPT"),
          idempotencyKey: input.idempotencyKey,
          userId: input.user.id,
          kind: q.kind,
          packageId: q.packageId,
          courseId: q.courseId,
          enquiryId,
          itemName: q.itemName,
          travellers: q.travellers,
          unitPrice: q.unitPrice,
          serviceCharge: q.serviceCharge,
          total: q.total,
          status: q.needsReview ? "PENDING_APPROVAL" : "ACTIVE",
        },
      });
      await append(tx, { userId: input.user.id, type: "ACTIVATION_DEBIT", amount: q.total.neg(), activationId: activation.id, actorId: input.user.id, memo: `${q.itemName} — receipt ${activation.receiptNo}` });
      return { activation, duplicate: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
  );
}

export async function reviewActivation(id: string, actorId: string, action: "approve" | "cancel", reason?: string, refund = true) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.packageActivation.findUnique({ where: { id }, include: { ledger: true } });
    if (!a) throw new HttpError(404, "Activation not found");
    await lockMember(tx, a.userId);
    if (action === "approve") {
      const upd = await tx.packageActivation.updateMany({ where: { id, status: "PENDING_APPROVAL" }, data: { status: "ACTIVE", reviewedById: actorId, reviewedAt: new Date() } });
      if (upd.count !== 1) throw new HttpError(409, "Only pending activations can be approved");
      if (a.enquiryId) await tx.enquiry.update({ where: { id: a.enquiryId }, data: { status: "CONFIRMED" } });
      return { ...a, status: "ACTIVE" as const };
    }
    const upd = await tx.packageActivation.updateMany({
      where: { id, status: { in: ["PENDING_APPROVAL", "ACTIVE"] } },
      data: { status: "CANCELLED", reviewedById: actorId, reviewedAt: new Date(), cancelReason: reason },
    });
    if (upd.count !== 1) throw new HttpError(409, "Activation is already cancelled");
    if (refund) {
      const debit = a.ledger.find((l) => l.type === "ACTIVATION_DEBIT");
      if (debit) await append(tx, { userId: a.userId, type: "ACTIVATION_REFUND", amount: debit.amount.neg(), activationId: a.id, reversesId: debit.id, actorId, memo: `Refund ${a.receiptNo}: ${reason}` });
    }
    if (a.enquiryId) await tx.enquiry.update({ where: { id: a.enquiryId }, data: { status: "CANCELLED" } });
    if (a.kind === "COURSE" && a.courseId) {
      await tx.enrollment.updateMany({ where: { userId: a.userId, courseId: a.courseId }, data: { status: "CANCELLED" } });
    }
    return { ...a, status: "CANCELLED" as const };
  });
}
