import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { audit } from "../lib/audit";
import { reference } from "../lib/ids";
import { sendMail } from "../lib/mailer";
import { requireAuth } from "../middleware/auth";
import { activate, creditSummary, quote } from "../lib/credits";
import { processActivation } from "../lib/compensation";
import {
  isInDownline, legCounts, loadBinaryTreeLazy, maskName, placementPath, searchDownline, sponsorChildren,
} from "../lib/genealogy";

/** Member features added in spec v1.2/v1.3: credits, activations, bookings, classes, genealogy. */
export const memberFeaturesRouter = Router();
memberFeaturesRouter.use(requireAuth);

// ---------- USD Package Credit ----------
memberFeaturesRouter.get(
  "/credits",
  asyncHandler(async (req, res) => {
    const id = req.user!.id;
    const [summary, credits, ledger] = await Promise.all([
      creditSummary(id),
      prisma.usdCredit.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        // internalNote and fundingRef are admin-only and deliberately not selected
        select: { id: true, reference: true, amount: true, status: true, createdAt: true, approvedAt: true, voidedAt: true, sentAt: true },
      }),
      prisma.creditLedgerEntry.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, txId: true, type: true, amount: true, balanceAfter: true, memo: true, createdAt: true, credit: { select: { reference: true } }, activation: { select: { receiptNo: true, itemName: true } } },
      }),
    ]);
    res.json({ summary, credits, ledger });
  }),
);

memberFeaturesRouter.get(
  "/catalogue",
  asyncHandler(async (req, res) => {
    const [packages, courses, enrollments, summary] = await Promise.all([
      prisma.tourPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.course.findMany({ where: { active: true } }),
      prisma.enrollment.findMany({ where: { userId: req.user!.id }, select: { courseId: true, status: true } }),
      creditSummary(req.user!.id),
    ]);
    res.json({
      balance: summary.available,
      packages: packages.map((p) => ({
        id: p.id, slug: p.slug, name: p.name, destination: p.destination, price: p.price, serviceCharge: p.serviceCharge, currency: p.currency,
        nights: p.nights, days: p.days, summary: p.summary, imageUrl: p.imageUrl, tag: p.tag, creditEligible: p.creditEligible && p.currency === "USD",
      })),
      courses: courses.map((c) => ({
        id: c.id, slug: c.slug, title: c.title, tuition: c.tuition, currency: c.currency, duration: c.duration, schedule: c.schedule, imageUrl: c.imageUrl,
        enrollmentOpen: c.enrollmentOpen, creditEligible: c.creditEligible && c.currency === "USD",
        enrollment: enrollments.find((e) => e.courseId === c.id)?.status ?? null,
      })),
    });
  }),
);

const activationInput = z.object({
  kind: z.enum(["TOUR", "COURSE"]),
  itemId: z.string().min(1),
  travellers: z.coerce.number().int().min(1).max(20).default(1),
});

memberFeaturesRouter.post(
  "/activations/quote",
  asyncHandler(async (req, res) => {
    const body = parse(activationInput, req.body);
    const q = await quote(body.kind, body.itemId, body.kind === "TOUR" ? body.travellers : 1);
    const s = await creditSummary(req.user!.id);
    res.json({
      itemName: q.itemName, travellers: q.travellers, unitPrice: q.unitPrice.toFixed(2), serviceCharge: q.serviceCharge.toFixed(2),
      total: q.total.toFixed(2), available: s.available, sufficient: Number(s.available) >= Number(q.total), needsReview: q.needsReview, currency: "USD",
    });
  }),
);

memberFeaturesRouter.post(
  "/activations",
  asyncHandler(async (req, res) => {
    const body = parse(
      activationInput.extend({
        preferredDate: z.coerce.date().optional(),
        message: z.string().trim().max(2000).optional(),
        expectedTotal: z.string().regex(/^\d+(\.\d{1,2})?$/),
        idempotencyKey: z.string().min(16).max(80),
        confirm: z.literal(true),
      }),
      req.body,
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.status !== "ACTIVE") throw new HttpError(403, "Verify your email before activating packages");
    const { activation, duplicate } = await activate({ user, ...body });
    if (!duplicate) {
      await audit({ actorId: user.id, action: "member.package_activation", entity: "PackageActivation", entityId: activation.id, after: { receiptNo: activation.receiptNo, item: activation.itemName, total: activation.total.toString(), status: activation.status }, ip: req.ip });
      const msg = `${activation.itemName}: USD ${activation.total.toFixed(2)} paid with USD Package Credit. Receipt ${activation.receiptNo}. Status: ${activation.status === "ACTIVE" ? "active" : "pending confirmation by our team"}.`;
      await prisma.notification.create({ data: { userId: user.id, title: "Package activated", body: msg } });
      if (user.notifyEmail) await sendMail(user.email, `Receipt ${activation.receiptNo} — World Vista`, msg);
      if (activation.status === "ACTIVE") await processActivation(activation.id);
    }
    res.status(duplicate ? 200 : 201).json({ activation });
  }),
);

memberFeaturesRouter.get(
  "/activations",
  asyncHandler(async (req, res) => {
    const activations = await prisma.packageActivation.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: { enquiry: { select: { reference: true, status: true, preferredDate: true } }, ledger: { select: { txId: true, type: true, amount: true, createdAt: true } } },
    });
    res.json({ activations });
  }),
);

memberFeaturesRouter.get(
  "/activations/:id",
  asyncHandler(async (req, res) => {
    const a = await prisma.packageActivation.findFirst({
      where: { OR: [{ id: req.params.id }, { receiptNo: req.params.id }], userId: req.user!.id },
      include: {
        enquiry: { select: { reference: true, status: true, preferredDate: true } },
        ledger: { select: { txId: true, type: true, amount: true, balanceAfter: true, createdAt: true } },
        user: { select: { fullName: true, memberId: true, email: true } },
      },
    });
    if (!a) throw new HttpError(404, "Receipt not found");
    const company = await prisma.setting.findUnique({ where: { key: "company" } });
    res.json({ activation: a, company: company?.value ?? null });
  }),
);

// ---------- Bookings ----------
memberFeaturesRouter.post(
  "/bookings",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        packageId: z.string(),
        travellers: z.coerce.number().int().min(1).max(20),
        preferredDate: z.coerce.date().optional(),
        message: z.string().trim().max(2000).default(""),
      }),
      req.body,
    );
    const pkg = await prisma.tourPackage.findFirst({ where: { id: body.packageId, active: true } });
    if (!pkg) throw new HttpError(404, "Package not found");
    if (body.preferredDate && body.preferredDate < new Date()) throw new HttpError(400, "Choose a future travel date");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const enq = await prisma.enquiry.create({
      data: {
        reference: reference("BKG"), type: "TOUR", packageId: pkg.id, userId: user.id, name: user.fullName, email: user.email, phone: user.mobile,
        travellers: body.travellers, preferredDate: body.preferredDate, message: body.message,
      },
    });
    await prisma.notification.create({ data: { userId: user.id, title: `Booking request ${enq.reference}`, body: `${pkg.name} for ${body.travellers} traveller(s). Our team will confirm availability and the final quote.` } });
    res.status(201).json({ booking: enq });
  }),
);

memberFeaturesRouter.get(
  "/bookings",
  asyncHandler(async (req, res) => {
    const bookings = await prisma.enquiry.findMany({
      where: { type: "TOUR", OR: [{ userId: req.user!.id }, { email: req.user!.email }] },
      orderBy: { createdAt: "desc" },
      include: {
        package: { select: { name: true, slug: true, imageUrl: true, nights: true, days: true } },
        activation: { select: { id: true, receiptNo: true, status: true, total: true } },
        payments: { select: { reference: true, publicToken: true, status: true, amount: true, currency: true } },
      },
    });
    res.json({ bookings });
  }),
);

// ---------- Classes ----------
memberFeaturesRouter.get(
  "/classes",
  asyncHandler(async (req, res) => {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.id },
      include: {
        course: { include: { sessions: { orderBy: { startsAt: "asc" } } } },
        progress: { select: { sessionId: true, completedAt: true } },
      },
    });
    res.json({
      courses: enrollments.map((e) => {
        const enrolled = e.status === "ENROLLED" || e.status === "COMPLETED";
        const done = new Set(e.progress.map((p) => p.sessionId));
        const sessions = e.course.sessions.map((s) => ({
          id: s.id, title: s.title, startsAt: s.startsAt, durationMins: s.durationMins, instructor: s.instructor ?? e.course.trainer, notes: s.notes,
          // Live and recorded links are only released to enrolled students
          liveUrl: enrolled ? s.liveUrl : null,
          recordingUrl: enrolled ? s.recordingUrl : null,
          completed: done.has(s.id),
        }));
        return {
          enrollmentId: e.id, status: e.status, courseId: e.course.id, title: e.course.title, schedule: e.course.schedule, duration: e.course.duration,
          trainer: e.course.trainer, sessions,
          progress: { done: done.size, total: sessions.length, pct: sessions.length ? Math.round((done.size / sessions.length) * 100) : 0 },
        };
      }),
    });
  }),
);

memberFeaturesRouter.post(
  "/classes/:sessionId/complete",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ completed: z.boolean() }), req.body);
    const s = await prisma.courseSession.findUnique({ where: { id: req.params.sessionId } });
    if (!s) throw new HttpError(404, "Class not found");
    const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: s.courseId } } });
    if (!enr || !["ENROLLED", "COMPLETED"].includes(enr.status)) throw new HttpError(403, "You're not enrolled in this course");
    if (s.startsAt > new Date()) throw new HttpError(400, "This class hasn't started yet");
    if (body.completed) {
      await prisma.sessionProgress.upsert({ where: { enrollmentId_sessionId: { enrollmentId: enr.id, sessionId: s.id } }, update: {}, create: { enrollmentId: enr.id, sessionId: s.id } });
    } else {
      await prisma.sessionProgress.deleteMany({ where: { enrollmentId: enr.id, sessionId: s.id } });
    }
    res.json({ ok: true });
  }),
);

// ---------- Genealogy (spec §28) ----------
async function resolveInTeam(viewerId: string, memberId?: string) {
  if (!memberId) return viewerId;
  const t = await prisma.user.findUnique({ where: { memberId: memberId.toUpperCase() }, select: { id: true } });
  if (!t) throw new HttpError(404, "Member not found");
  if (t.id !== viewerId && !(await isInDownline(prisma, viewerId, t.id))) throw new HttpError(403, "That member is not in your team");
  return t.id;
}

memberFeaturesRouter.get(
  "/genealogy/binary",
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ root: z.string().optional(), depth: z.coerce.number().int().min(1).max(4).default(3) }), req.query);
    const rootId = await resolveInTeam(req.user!.id, q.root);
    const [tree, legs, path] = await Promise.all([
      loadBinaryTreeLazy(prisma, rootId, q.depth, true),
      legCounts(prisma, rootId),
      rootId === req.user!.id ? null : placementPath(prisma, req.user!.id, rootId),
    ]);
    res.json({ tree, legs, path });
  }),
);

memberFeaturesRouter.get(
  "/genealogy/sponsor",
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ root: z.string().optional() }), req.query);
    const rootId = await resolveInTeam(req.user!.id, q.root);
    res.json({ children: await sponsorChildren(prisma, rootId, true) });
  }),
);

memberFeaturesRouter.get(
  "/genealogy/search",
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ q: z.string().trim().min(2).max(60) }), req.query);
    const rows = await searchDownline(prisma, req.user!.id, q.q);
    res.json({ results: rows.map((r) => ({ memberId: r.memberId, fullName: maskName(r.fullName), status: r.status, side: r.placementSide, joinedAt: r.createdAt })) });
  }),
);

memberFeaturesRouter.get(
  "/genealogy/node/:memberId",
  asyncHandler(async (req, res) => {
    const id = await resolveInTeam(req.user!.id, req.params.memberId);
    const self = id === req.user!.id;
    const u = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        memberId: true, fullName: true, status: true, placementSide: true, createdAt: true, country: true,
        sponsor: { select: { memberId: true } }, placementParent: { select: { memberId: true } },
        _count: { select: { referrals: true } },
      },
    });
    const [legs, activePackages, bookings, courses] = await Promise.all([
      legCounts(prisma, id),
      prisma.packageActivation.count({ where: { userId: id, status: "ACTIVE" } }),
      prisma.enquiry.count({ where: { userId: id, type: "TOUR", status: "CONFIRMED" } }),
      prisma.enrollment.count({ where: { userId: id, status: { in: ["ENROLLED", "COMPLETED"] } } }),
    ]);
    res.json({
      node: {
        memberId: u.memberId, fullName: self ? u.fullName : maskName(u.fullName), status: u.status, side: u.placementSide, joinedAt: u.createdAt,
        country: u.country, sponsorId: u.sponsor?.memberId ?? null, placementParentId: u.placementParent?.memberId ?? null, directReferrals: u._count.referrals,
        legs, packageStatus: activePackages + bookings + courses > 0 ? "Active package" : "No package yet", activePackages, confirmedTrips: bookings, courses,
      },
    });
  }),
);
