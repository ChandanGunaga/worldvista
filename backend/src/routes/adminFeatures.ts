import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { audit } from "../lib/audit";
import { sendMail } from "../lib/mailer";
import { ADMIN_ROLES, requireAuth, requireRole } from "../middleware/auth";
import { processActivation, reverseActivation } from "../lib/compensation";
import { approveCredit, createCredit, creditSummary, reviewActivation, voidCredit } from "../lib/credits";
import {
  inPlacementSubtree, legCounts, loadBinaryTreeLazy, placementPath, searchDownline, sponsorChildren,
} from "../lib/genealogy";

/** Admin features added in spec v1.2/v1.3. */
export const adminFeaturesRouter = Router();
adminFeaturesRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

const FINANCE = requireRole("FINANCE_ADMIN");
const FIN_OR_SUPPORT = requireRole("FINANCE_ADMIN", "SUPPORT_ADMIN");
const SUPPORT = requireRole("SUPPORT_ADMIN");
const CONTENT_OR_SUPPORT = requireRole("CONTENT_ADMIN", "SUPPORT_ADMIN");
const SUPER = requireRole();

async function reauth(req: Request) {
  const pw = typeof req.body?.password === "string" ? req.body.password : "";
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!pw || !(await bcrypt.compare(pw, u.passwordHash))) throw new HttpError(403, "Re-enter your password to confirm this action");
}

async function findMember(query: string) {
  const q = query.trim();
  const m = await prisma.user.findFirst({ where: { role: "MEMBER", OR: [{ memberId: q.toUpperCase() }, { email: q.toLowerCase() }] } });
  if (!m) throw new HttpError(404, "No member with that Member ID or email");
  return m;
}

const money = (d: Prisma.Decimal | number | string) => Number(d).toFixed(2);

// ---------- Member lookup (for pickers) ----------
adminFeaturesRouter.get(
  "/lookup/members",
  FIN_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ q: z.string().trim().min(2).max(80) }), req.query);
    const members = await prisma.user.findMany({
      where: { role: "MEMBER", OR: [{ memberId: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { fullName: { contains: q.q, mode: "insensitive" } }] },
      select: { id: true, memberId: true, fullName: true, email: true, status: true },
      take: 8,
    });
    res.json({ members });
  }),
);

// ---------- USD Credits (spec §25-26) ----------
adminFeaturesRouter.get(
  "/credits",
  FINANCE,
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({ q: z.string().trim().optional(), status: z.enum(["PENDING", "APPROVED", "VOIDED"]).optional(), page: z.coerce.number().int().min(1).default(1) }),
      req.query,
    );
    const where: Prisma.UsdCreditWhereInput = {
      status: q.status,
      ...(q.q ? { OR: [{ reference: { contains: q.q, mode: "insensitive" } }, { user: { memberId: { contains: q.q, mode: "insensitive" } } }, { user: { email: { contains: q.q, mode: "insensitive" } } }] } : {}),
    };
    const [total, credits, totals, outstanding] = await Promise.all([
      prisma.usdCredit.count({ where }),
      prisma.usdCredit.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * 25, take: 25, include: { user: { select: { memberId: true, fullName: true, email: true } } } }),
      prisma.usdCredit.groupBy({ by: ["status"], _sum: { amount: true }, _count: true }),
      prisma.creditLedgerEntry.aggregate({ _sum: { amount: true } }),
    ]);
    const ids = [...new Set(credits.flatMap((c) => [c.createdById, c.approvedById, c.voidedById]).filter(Boolean) as string[])];
    const admins = Object.fromEntries((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })).map((a) => [a.id, a.fullName]));
    res.json({
      total,
      credits: credits.map((c) => ({ ...c, createdBy: admins[c.createdById], approvedBy: c.approvedById ? admins[c.approvedById] : null, voidedBy: c.voidedById ? admins[c.voidedById] : null })),
      totals: Object.fromEntries(totals.map((t) => [t.status, { amount: money(t._sum.amount ?? 0), count: t._count }])),
      outstandingBalance: money(outstanding._sum.amount ?? 0),
    });
  }),
);

adminFeaturesRouter.post(
  "/credits",
  FINANCE,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ member: z.string().min(2), amount: z.coerce.number().positive().max(100000), internalNote: z.string().trim().min(3).max(500), password: z.string() }),
      req.body,
    );
    await reauth(req);
    const m = await findMember(body.member);
    const c = await createCredit({ userId: m.id, amount: body.amount, internalNote: body.internalNote, createdById: req.user!.id });
    await audit({ actorId: req.user!.id, action: "credit.generate", entity: "UsdCredit", entityId: c.id, after: { reference: c.reference, member: m.memberId, amount: money(c.amount) }, reason: body.internalNote, ip: req.ip });
    res.status(201).json({ credit: c });
  }),
);

async function notifyCredit(creditId: string, kind: "sent" | "approved") {
  const c = await prisma.usdCredit.findUniqueOrThrow({ where: { id: creditId }, include: { user: true } });
  const amt = `USD ${money(c.amount)}`;
  const body =
    kind === "approved" || c.status === "APPROVED"
      ? `${amt} USD Package Credit (ref ${c.reference}) is now available in your balance. It can be used to activate eligible tour and course packages. It is not cash and cannot be withdrawn or transferred.`
      : `${amt} USD Package Credit (ref ${c.reference}) has been issued to you and will become available once approved.`;
  await prisma.notification.create({ data: { userId: c.userId, title: kind === "approved" ? "USD credit available" : "USD credit issued", body } });
  await sendMail(c.user.email, `World Vista — USD Package Credit ${c.reference}`, body);
  await prisma.usdCredit.update({ where: { id: c.id }, data: { sentAt: new Date() } });
}

adminFeaturesRouter.post(
  "/credits/:id/send",
  FINANCE,
  asyncHandler(async (req, res) => {
    const c = await prisma.usdCredit.findUnique({ where: { id: req.params.id } });
    if (!c) throw new HttpError(404, "Credit not found");
    if (c.status === "VOIDED") throw new HttpError(400, "This credit is void");
    await notifyCredit(c.id, "sent");
    await audit({ actorId: req.user!.id, action: "credit.send", entity: "UsdCredit", entityId: c.id, ip: req.ip });
    res.json({ ok: true });
  }),
);

adminFeaturesRouter.post(
  "/credits/:id/approve",
  FINANCE,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ fundingRef: z.string().trim().min(3).max(200), password: z.string() }), req.body);
    await reauth(req);
    const { credit, entry } = await approveCredit(req.params.id, { id: req.user!.id, role: req.user!.role }, body.fundingRef);
    await audit({ actorId: req.user!.id, action: "credit.approve", entity: "UsdCredit", entityId: credit.id, before: { status: "PENDING" }, after: { status: "APPROVED", txId: entry.txId, amount: money(credit.amount) }, reason: body.fundingRef, ip: req.ip });
    await notifyCredit(credit.id, "approved");
    res.json({ ok: true });
  }),
);

adminFeaturesRouter.post(
  "/credits/:id/void",
  FINANCE,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ reason: z.string().trim().min(5).max(500), password: z.string() }), req.body);
    await reauth(req);
    const before = await voidCredit(req.params.id, req.user!.id, body.reason);
    await audit({ actorId: req.user!.id, action: "credit.void", entity: "UsdCredit", entityId: before.id, before: { status: before.status }, after: { status: "VOIDED" }, reason: body.reason, ip: req.ip });
    await prisma.notification.create({ data: { userId: before.userId, title: "USD credit cancelled", body: `Credit ${before.reference} (USD ${money(before.amount)}) was cancelled. Contact support if you have questions.` } });
    res.json({ ok: true });
  }),
);

adminFeaturesRouter.get(
  "/members/:id/credits",
  FIN_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const m = await prisma.user.findFirst({ where: { OR: [{ id: req.params.id }, { memberId: req.params.id.toUpperCase() }] } });
    if (!m) throw new HttpError(404, "Member not found");
    const [summary, ledger] = await Promise.all([
      creditSummary(m.id),
      prisma.creditLedgerEntry.findMany({ where: { userId: m.id }, orderBy: { createdAt: "desc" }, take: 50, include: { credit: { select: { reference: true } }, activation: { select: { receiptNo: true } } } }),
    ]);
    res.json({ summary, ledger });
  }),
);

// ---------- Package activations ----------
adminFeaturesRouter.get(
  "/activations",
  FIN_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ status: z.enum(["PENDING_APPROVAL", "ACTIVE", "CANCELLED"]).optional(), q: z.string().trim().optional() }), req.query);
    const activations = await prisma.packageActivation.findMany({
      where: {
        status: q.status,
        ...(q.q ? { OR: [{ receiptNo: { contains: q.q, mode: "insensitive" } }, { user: { memberId: { contains: q.q, mode: "insensitive" } } }, { itemName: { contains: q.q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { memberId: true, fullName: true, email: true } }, enquiry: { select: { reference: true, preferredDate: true, message: true } } },
    });
    res.json({ activations });
  }),
);

adminFeaturesRouter.post(
  "/activations/:id/review",
  FIN_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("approve") }),
        z.object({ action: z.literal("cancel"), reason: z.string().trim().min(5).max(500), refund: z.boolean().default(true), password: z.string() }),
      ]),
      req.body,
    );
    if (body.action === "cancel") await reauth(req);
    const a = await reviewActivation(req.params.id, req.user!.id, body.action, body.action === "cancel" ? body.reason : undefined, body.action === "cancel" ? body.refund : false);
    // Commissions: approval qualifies the sale; cancellation reverses volume and direct commission (linked entries)
    if (body.action === "approve") await processActivation(a.id);
    else await reverseActivation(a.id, req.user!.id, body.reason);
    await audit({
      actorId: req.user!.id, action: `activation.${body.action}`, entity: "PackageActivation", entityId: a.id,
      after: { status: a.status, refund: body.action === "cancel" ? body.refund : undefined }, reason: body.action === "cancel" ? body.reason : null, ip: req.ip,
    });
    const msg =
      body.action === "approve"
        ? `${a.itemName} (receipt ${a.receiptNo}) is confirmed. Our travel team will share your itinerary and vouchers.`
        : `${a.itemName} (receipt ${a.receiptNo}) was cancelled: ${body.reason}.${body.refund ? ` USD ${money(a.total)} was returned to your USD Package Credit balance.` : ""}`;
    await prisma.notification.create({ data: { userId: a.userId, title: body.action === "approve" ? "Package confirmed" : "Package cancelled", body: msg } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: a.userId } });
    if (u.notifyEmail) await sendMail(u.email, `World Vista — ${a.receiptNo}`, msg);
    res.json({ ok: true });
  }),
);

// ---------- Course sessions (timetable) ----------
const sessionSchema = z.object({
  title: z.string().trim().min(2).max(150),
  startsAt: z.coerce.date(),
  durationMins: z.coerce.number().int().min(15).max(600).default(60),
  instructor: z.string().trim().max(120).nullable().optional(),
  liveUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("").transform(() => null)),
  recordingUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("").transform(() => null)),
  notes: z.string().max(2000).default(""),
});

adminFeaturesRouter.get(
  "/courses/:id/sessions",
  CONTENT_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const [sessions, enrolled] = await Promise.all([
      prisma.courseSession.findMany({ where: { courseId: req.params.id }, orderBy: { startsAt: "asc" }, include: { _count: { select: { progress: true } } } }),
      prisma.enrollment.findMany({
        where: { courseId: req.params.id, status: { in: ["ENROLLED", "COMPLETED"] } },
        include: { user: { select: { memberId: true, fullName: true } }, _count: { select: { progress: true } } },
      }),
    ]);
    res.json({ sessions, students: enrolled.map((e) => ({ enrollmentId: e.id, memberId: e.user.memberId, fullName: e.user.fullName, status: e.status, completed: e._count.progress })) });
  }),
);

adminFeaturesRouter.post(
  "/courses/:id/sessions",
  CONTENT_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const data = parse(sessionSchema, req.body);
    await prisma.course.findUniqueOrThrow({ where: { id: req.params.id } });
    const s = await prisma.courseSession.create({ data: { ...data, courseId: req.params.id } });
    await audit({ actorId: req.user!.id, action: "admin.session_create", entity: "CourseSession", entityId: s.id, after: data, ip: req.ip });
    res.status(201).json({ session: s });
  }),
);

adminFeaturesRouter.put(
  "/sessions/:id",
  CONTENT_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const data = parse(sessionSchema, req.body);
    const before = await prisma.courseSession.findUniqueOrThrow({ where: { id: req.params.id } });
    const s = await prisma.courseSession.update({ where: { id: before.id }, data });
    await audit({ actorId: req.user!.id, action: "admin.session_update", entity: "CourseSession", entityId: s.id, before, after: data, ip: req.ip });
    res.json({ session: s });
  }),
);

adminFeaturesRouter.delete(
  "/sessions/:id",
  CONTENT_OR_SUPPORT,
  asyncHandler(async (req, res) => {
    const before = await prisma.courseSession.findUniqueOrThrow({ where: { id: req.params.id } });
    await prisma.courseSession.delete({ where: { id: before.id } });
    await audit({ actorId: req.user!.id, action: "admin.session_delete", entity: "CourseSession", entityId: before.id, before, ip: req.ip });
    res.json({ ok: true });
  }),
);

// ---------- Genealogy (spec §28, §31) ----------
async function memberIdToId(memberId?: string) {
  if (!memberId) {
    // Default root: the earliest member without a placement parent
    const top = await prisma.user.findFirst({ where: { role: "MEMBER", placementParentId: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!top) throw new HttpError(404, "No members yet");
    return top.id;
  }
  const u = await prisma.user.findUnique({ where: { memberId: memberId.toUpperCase() }, select: { id: true } });
  if (!u) throw new HttpError(404, "Member not found");
  return u.id;
}

adminFeaturesRouter.get(
  "/genealogy/roots",
  SUPPORT,
  asyncHandler(async (_req, res) => {
    const roots = await prisma.user.findMany({
      where: { role: "MEMBER", placementParentId: null },
      select: { memberId: true, fullName: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ roots });
  }),
);

adminFeaturesRouter.get(
  "/genealogy/binary",
  SUPPORT,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ root: z.string().optional(), depth: z.coerce.number().int().min(1).max(5).default(3) }), req.query);
    const rootId = await memberIdToId(q.root);
    const [tree, legs] = await Promise.all([loadBinaryTreeLazy(prisma, rootId, q.depth, false), legCounts(prisma, rootId)]);
    res.json({ tree, legs, path: null });
  }),
);

adminFeaturesRouter.get(
  "/genealogy/sponsor",
  SUPPORT,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ root: z.string().optional() }), req.query);
    res.json({ children: await sponsorChildren(prisma, await memberIdToId(q.root), false) });
  }),
);

adminFeaturesRouter.get(
  "/genealogy/search",
  SUPPORT,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ q: z.string().trim().min(2).max(80) }), req.query);
    const rows = await searchDownline(prisma, null, q.q);
    res.json({ results: rows.map((r) => ({ memberId: r.memberId, fullName: r.fullName, status: r.status, side: r.placementSide, joinedAt: r.createdAt })) });
  }),
);

adminFeaturesRouter.get(
  "/genealogy/node/:memberId",
  SUPPORT,
  asyncHandler(async (req, res) => {
    const id = await memberIdToId(req.params.memberId);
    const u = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        memberId: true, fullName: true, email: true, mobile: true, status: true, placementSide: true, createdAt: true, country: true,
        sponsor: { select: { memberId: true } }, placementParent: { select: { memberId: true } }, _count: { select: { referrals: true } },
      },
    });
    const [legs, activePackages, confirmedTrips, courses] = await Promise.all([
      legCounts(prisma, id),
      prisma.packageActivation.count({ where: { userId: id, status: "ACTIVE" } }),
      prisma.enquiry.count({ where: { userId: id, type: "TOUR", status: "CONFIRMED" } }),
      prisma.enrollment.count({ where: { userId: id, status: { in: ["ENROLLED", "COMPLETED"] } } }),
    ]);
    res.json({
      node: {
        memberId: u.memberId, fullName: u.fullName, email: u.email, mobile: u.mobile, status: u.status, side: u.placementSide, joinedAt: u.createdAt, country: u.country,
        sponsorId: u.sponsor?.memberId ?? null, placementParentId: u.placementParent?.memberId ?? null, directReferrals: u._count.referrals, legs,
        packageStatus: activePackages + confirmedTrips + courses > 0 ? "Active package" : "No package yet", activePackages, confirmedTrips, courses,
      },
    });
  }),
);

/** Audited placement correction. Moves a member (with their whole subtree) into an empty slot. */
adminFeaturesRouter.post(
  "/genealogy/move",
  SUPER,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ memberId: z.string().min(3), newParent: z.string().min(3), side: z.enum(["LEFT", "RIGHT"]), reason: z.string().trim().min(10).max(500), password: z.string() }),
      req.body,
    );
    await reauth(req);
    const result = await prisma.$transaction(async (tx) => {
      const m = await tx.user.findUnique({ where: { memberId: body.memberId.toUpperCase() } });
      const p = await tx.user.findUnique({ where: { memberId: body.newParent.toUpperCase() } });
      if (!m || !p) throw new HttpError(404, "Member or new parent not found");
      if (m.role !== "MEMBER") throw new HttpError(400, "Only member accounts can be placed");
      if (await inPlacementSubtree(tx, m.id, p.id)) throw new HttpError(400, "A member can't be placed under themselves or their own downline");
      const taken = await tx.user.findFirst({ where: { placementParentId: p.id, placementSide: body.side } });
      if (taken) throw new HttpError(409, `${p.memberId}'s ${body.side.toLowerCase()} slot is already taken by ${taken.memberId}`);
      const before = { placementParent: m.placementParentId, side: m.placementSide };
      await tx.user.update({ where: { id: m.id }, data: { placementParentId: p.id, placementSide: body.side } });
      return { m, p, before };
    });
    await audit({
      actorId: req.user!.id, action: "genealogy.placement_correction", entity: "User", entityId: result.m.id,
      before: result.before, after: { placementParent: result.p.id, parentMemberId: result.p.memberId, side: body.side }, reason: body.reason, ip: req.ip,
    });
    res.json({ ok: true, path: await placementPath(prisma, result.p.id, result.m.id) });
  }),
);

// ---------- Reports summary (daily / monthly / annual) ----------
adminFeaturesRouter.get(
  "/reports/summary",
  requireRole("FINANCE_ADMIN", "SUPPORT_ADMIN"),
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ period: z.enum(["day", "month", "year"]).default("month"), from: z.coerce.date().optional(), to: z.coerce.date().optional() }), req.query);
    const to = q.to ?? new Date();
    const from = q.from ?? new Date(to.getTime() - (q.period === "day" ? 30 : q.period === "month" ? 365 : 365 * 5) * 864e5);
    const unit = q.period; // validated enum, safe to inline
    const bucket = (table: string, col: string, extra = "", agg = "COUNT(*)::float") =>
      prisma.$queryRawUnsafe<{ b: Date; v: number }[]>(
        `SELECT date_trunc('${unit}', "${col}" AT TIME ZONE 'UTC') AS b, ${agg} AS v FROM "${table}" WHERE "${col}" >= $1 AND "${col}" <= $2 ${extra} GROUP BY 1 ORDER BY 1`,
        from, to,
      );
    const [members, bookings, confirmed, payments, paymentsInr, credits, activations] = await Promise.all([
      bucket("User", "createdAt", `AND role = 'MEMBER'`),
      bucket("Enquiry", "createdAt", `AND type = 'TOUR'`),
      bucket("Enquiry", "updatedAt", `AND status = 'CONFIRMED'`),
      bucket("Payment", "paidAt", `AND status = 'PAID' AND currency = 'USD'`, `COALESCE(SUM(amount),0)::float`),
      bucket("Payment", "paidAt", `AND status = 'PAID' AND currency = 'INR'`, `COALESCE(SUM(amount),0)::float`),
      bucket("UsdCredit", "approvedAt", `AND status <> 'PENDING'`, `COALESCE(SUM(amount),0)::float`),
      bucket("PackageActivation", "createdAt", `AND status <> 'CANCELLED'`, `COALESCE(SUM(total),0)::float`),
    ]);
    const keys = new Set<string>();
    const map = (rows: { b: Date; v: number }[]) => Object.fromEntries(rows.map((r) => { const k = new Date(r.b).toISOString().slice(0, q.period === "day" ? 10 : q.period === "month" ? 7 : 4); keys.add(k); return [k, Number(r.v)]; }));
    const series = { members: map(members), bookings: map(bookings), confirmed: map(confirmed), payments: map(payments), paymentsInr: map(paymentsInr), credits: map(credits), activations: map(activations) };
    const rows = [...keys].sort().reverse().map((k) => ({
      period: k, newMembers: series.members[k] ?? 0, bookingRequests: series.bookings[k] ?? 0, bookingsConfirmed: series.confirmed[k] ?? 0,
      paymentsReceived: series.payments[k] ?? 0, paymentsReceivedInr: series.paymentsInr[k] ?? 0, creditsApproved: series.credits[k] ?? 0, creditActivations: series.activations[k] ?? 0,
    }));
    res.json({ period: q.period, from, to, rows });
  }),
);

// ---------- Overview extras ----------
adminFeaturesRouter.get(
  "/stats/extra",
  asyncHandler(async (_req, res) => {
    const [outstanding, pendingCredits, pendingActivations, paid30, activations30] = await Promise.all([
      prisma.creditLedgerEntry.aggregate({ _sum: { amount: true } }),
      prisma.usdCredit.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: true }),
      prisma.packageActivation.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.payment.groupBy({ by: ["currency"], where: { status: "PAID", paidAt: { gte: new Date(Date.now() - 30 * 864e5) } }, _sum: { amount: true } }),
      prisma.packageActivation.aggregate({ where: { status: { not: "CANCELLED" }, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } }, _sum: { total: true }, _count: true }),
    ]);
    res.json({
      creditLiability: money(outstanding._sum.amount ?? 0),
      pendingCredits: { count: pendingCredits._count, amount: money(pendingCredits._sum.amount ?? 0) },
      pendingActivations,
      paymentsLast30: Object.fromEntries(paid30.map((p) => [p.currency, money(p._sum.amount ?? 0)])) as Record<string, string>,
      activationsLast30: { count: activations30._count, amount: money(activations30._sum.total ?? 0) },
    });
  }),
);
