import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { audit, verifyAuditChain } from "../lib/audit";
import { generateMemberId } from "../lib/ids";
import { loadBinaryTree, legCounts } from "../lib/genealogy";
import { sendMail } from "../lib/mailer";
import { ADMIN_ROLES, requireAuth, requireRole } from "../middleware/auth";
import multer from "multer";
import { createPayment, payLink } from "../lib/payments";
import { features } from "../lib/env";
import { storeImage } from "../lib/storage";
import { sendWhatsApp } from "../lib/whatsapp";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

const CONTENT = requireRole("CONTENT_ADMIN");
const SUPPORT = requireRole("SUPPORT_ADMIN");
const SUPPORT_OR_CONTENT = requireRole("SUPPORT_ADMIN", "CONTENT_ADMIN");
const REPORTS = requireRole("FINANCE_ADMIN", "SUPPORT_ADMIN");
const SUPER = requireRole();

/** Re-authentication for sensitive actions: caller must resend their password. */
async function reauth(req: Request) {
  const pw = typeof req.body?.password === "string" ? req.body.password : "";
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!pw || !(await bcrypt.compare(pw, u.passwordHash))) throw new HttpError(403, "Re-enter your password to confirm this action");
}

const pageArgs = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// ---------- Dashboard ----------
adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [members, active, pendingVerification, newEnquiries, openTickets, enrollments, packages] = await Promise.all([
      prisma.user.count({ where: { role: "MEMBER" } }),
      prisma.user.count({ where: { role: "MEMBER", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "MEMBER", status: "PENDING_VERIFICATION" } }),
      prisma.enquiry.count({ where: { status: "NEW" } }),
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.enrollment.count({ where: { status: "REQUESTED" } }),
      prisma.tourPackage.count({ where: { active: true } }),
    ]);
    const recentEnquiries = await prisma.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { package: { select: { name: true } } } });
    res.json({ stats: { members, active, pendingVerification, newEnquiries, openTickets, enrollments, packages }, recentEnquiries });
  }),
);

// ---------- Members ----------
adminRouter.get(
  "/members",
  SUPPORT,
  asyncHandler(async (req, res) => {
    const q = parse(pageArgs.extend({ status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED"]).optional() }), req.query);
    const where: Prisma.UserWhereInput = {
      role: "MEMBER",
      status: q.status,
      ...(q.q
        ? { OR: [{ memberId: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { fullName: { contains: q.q, mode: "insensitive" } }, { mobile: { contains: q.q } }] }
        : {}),
    };
    const [total, members] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: { id: true, memberId: true, fullName: true, email: true, mobile: true, country: true, status: true, createdAt: true, sponsor: { select: { memberId: true } } },
      }),
    ]);
    res.json({ total, members });
  }),
);

adminRouter.get(
  "/members/:id",
  SUPPORT,
  asyncHandler(async (req, res) => {
    const m = await prisma.user.findFirst({
      where: { OR: [{ id: req.params.id }, { memberId: req.params.id.toUpperCase() }] },
      select: {
        id: true, memberId: true, fullName: true, email: true, mobile: true, country: true, address: true, role: true, status: true,
        emailVerifiedAt: true, createdAt: true, lastLoginAt: true, placementSide: true,
        sponsor: { select: { memberId: true, fullName: true } },
        placementParent: { select: { memberId: true, fullName: true } },
        _count: { select: { referrals: true, enquiries: true, tickets: true } },
        enrollments: { include: { course: { select: { title: true } } } },
        acceptances: { include: { policyVersion: { include: { page: { select: { title: true } } } } } },
      },
    });
    if (!m) throw new HttpError(404, "Member not found");
    const [tree, legs] = await Promise.all([loadBinaryTree(prisma, m.id, 2), legCounts(prisma, m.id)]);
    res.json({ member: m, tree, legs });
  }),
);

adminRouter.post(
  "/members/:id/status",
  SUPER,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(5).max(500), password: z.string() }), req.body);
    await reauth(req);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    const after = await prisma.user.update({
      where: { id: before.id },
      data: { status: body.status, tokenVersion: { increment: body.status === "SUSPENDED" ? 1 : 0 } },
    });
    await audit({ actorId: req.user!.id, action: "admin.member_status", entity: "User", entityId: before.id, before: { status: before.status }, after: { status: after.status }, reason: body.reason, ip: req.ip });
    res.json({ ok: true });
  }),
);

// ---------- Staff (Super Admin only) ----------
adminRouter.get(
  "/staff",
  SUPER,
  asyncHandler(async (_req, res) => {
    const staff = await prisma.user.findMany({
      where: { role: { in: ADMIN_ROLES } },
      select: { id: true, memberId: true, fullName: true, email: true, role: true, status: true, lastLoginAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ staff });
  }),
);

adminRouter.post(
  "/staff",
  SUPER,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        fullName: z.string().trim().min(2),
        email: z.string().trim().toLowerCase().email(),
        role: z.enum(["SUPER_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"]),
        tempPassword: z.string().min(10),
        password: z.string(),
      }),
      req.body,
    );
    await reauth(req);
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw new HttpError(409, "Email already in use");
    const u = await prisma.user.create({
      data: {
        memberId: await generateMemberId(),
        fullName: body.fullName,
        email: body.email,
        role: body.role,
        passwordHash: await bcrypt.hash(body.tempPassword, 12),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    await audit({ actorId: req.user!.id, action: "admin.staff_create", entity: "User", entityId: u.id, after: { email: u.email, role: u.role }, ip: req.ip });
    await sendMail(u.email, "Your World Vista admin account", `An admin account (${u.role}) was created for you. Sign in at the member login with the temporary password provided to you separately, then change it.`);
    res.status(201).json({ id: u.id });
  }),
);

adminRouter.post(
  "/staff/:id/role",
  SUPER,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ role: z.enum(["MEMBER", "SUPER_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"]), reason: z.string().min(5), password: z.string() }), req.body);
    await reauth(req);
    if (req.params.id === req.user!.id) throw new HttpError(400, "You cannot change your own role");
    const before = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    await prisma.user.update({ where: { id: before.id }, data: { role: body.role, tokenVersion: { increment: 1 } } });
    await audit({ actorId: req.user!.id, action: "admin.role_change", entity: "User", entityId: before.id, before: { role: before.role }, after: { role: body.role }, reason: body.reason, ip: req.ip });
    res.json({ ok: true });
  }),
);

/** Image may be an absolute http(s) URL or a site-relative path like /images/x.jpg */
const imageUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\//.test(v) || /^\/[\w\-./]+$/.test(v), "Must be an https URL or a /path")
  .nullable()
  .optional();
/** Optional date that treats "" as null. */
const optDate = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable()).optional();

// ---------- Tour packages ----------
const packageSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2),
  destination: z.string().trim().min(2),
  price: z.coerce.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  chargeNote: z.string().default("+ service charge"),
  nights: z.coerce.number().int().min(0),
  days: z.coerce.number().int().min(1),
  summary: z.string().trim().min(5),
  description: z.string().default(""),
  hotelCategory: z.string().trim().min(2),
  tag: z.string().nullable().optional(),
  validityDays: z.coerce.number().int().nullable().optional(),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  imageUrl,
  availableFrom: optDate,
  availableTo: optDate,
  cancellationPolicy: z.string().default(""),
  active: z.boolean().default(true),
  verified: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

adminRouter.get(
  "/packages",
  CONTENT,
  asyncHandler(async (_req, res) => {
    res.json({ packages: await prisma.tourPackage.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { enquiries: true } } } }) });
  }),
);

adminRouter.post(
  "/packages",
  CONTENT,
  asyncHandler(async (req, res) => {
    const data = parse(packageSchema, req.body);
    const pkg = await prisma.tourPackage.create({ data: { ...data, imageUrl: data.imageUrl || null } });
    await audit({ actorId: req.user!.id, action: "admin.package_create", entity: "TourPackage", entityId: pkg.id, after: data, ip: req.ip });
    res.status(201).json({ package: pkg });
  }),
);

adminRouter.put(
  "/packages/:id",
  CONTENT,
  asyncHandler(async (req, res) => {
    const data = parse(packageSchema, req.body);
    const before = await prisma.tourPackage.findUniqueOrThrow({ where: { id: req.params.id } });
    const pkg = await prisma.tourPackage.update({ where: { id: before.id }, data: { ...data, imageUrl: data.imageUrl || null } });
    await audit({ actorId: req.user!.id, action: "admin.package_update", entity: "TourPackage", entityId: pkg.id, before, after: data, ip: req.ip });
    res.json({ package: pkg });
  }),
);

// ---------- Courses ----------
const courseSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2),
  tuition: z.coerce.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  duration: z.string().min(1),
  schedule: z.string().min(1),
  topics: z.array(z.string()).default([]),
  syllabus: z.string().min(1),
  trainer: z.string().nullable().optional(),
  startDate: optDate,
  enrollmentOpen: z.boolean().default(true),
  disclaimer: z.string().min(10),
  imageUrl,
  active: z.boolean().default(true),
});

adminRouter.get(
  "/courses",
  CONTENT,
  asyncHandler(async (_req, res) => {
    res.json({ courses: await prisma.course.findMany({ include: { _count: { select: { enrollments: true } } } }) });
  }),
);

adminRouter.post(
  "/courses",
  CONTENT,
  asyncHandler(async (req, res) => {
    const data = parse(courseSchema, req.body);
    const c = await prisma.course.create({ data: { ...data, imageUrl: data.imageUrl || null } });
    await audit({ actorId: req.user!.id, action: "admin.course_create", entity: "Course", entityId: c.id, after: data, ip: req.ip });
    res.status(201).json({ course: c });
  }),
);

adminRouter.put(
  "/courses/:id",
  CONTENT,
  asyncHandler(async (req, res) => {
    const data = parse(courseSchema, req.body);
    const before = await prisma.course.findUniqueOrThrow({ where: { id: req.params.id } });
    const c = await prisma.course.update({ where: { id: before.id }, data: { ...data, imageUrl: data.imageUrl || null } });
    await audit({ actorId: req.user!.id, action: "admin.course_update", entity: "Course", entityId: c.id, before, after: data, ip: req.ip });
    res.json({ course: c });
  }),
);

adminRouter.get(
  "/enrollments",
  SUPPORT_OR_CONTENT,
  asyncHandler(async (_req, res) => {
    const enrollments = await prisma.enrollment.findMany({
      orderBy: { createdAt: "desc" },
      include: { course: { select: { title: true } }, user: { select: { memberId: true, fullName: true, email: true } } },
    });
    res.json({ enrollments });
  }),
);

adminRouter.post(
  "/enrollments/:id/status",
  SUPPORT_OR_CONTENT,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ status: z.enum(["REQUESTED", "ENROLLED", "COMPLETED", "CANCELLED"]) }), req.body);
    const before = await prisma.enrollment.findUniqueOrThrow({ where: { id: req.params.id }, include: { course: true } });
    await prisma.enrollment.update({ where: { id: before.id }, data: { status: body.status } });
    await prisma.notification.create({ data: { userId: before.userId, title: "Course enrolment updated", body: `${before.course.title}: ${body.status.toLowerCase()}` } });
    await audit({ actorId: req.user!.id, action: "admin.enrollment_status", entity: "Enrollment", entityId: before.id, before: { status: before.status }, after: body, ip: req.ip });
    res.json({ ok: true });
  }),
);

// ---------- Enquiries ----------
adminRouter.get(
  "/enquiries",
  SUPPORT_OR_CONTENT,
  asyncHandler(async (req, res) => {
    const q = parse(pageArgs.extend({ status: z.enum(["NEW", "CONTACTED", "CONFIRMED", "CANCELLED", "CLOSED"]).optional(), type: z.enum(["TOUR", "COURSE", "GENERAL"]).optional() }), req.query);
    const where: Prisma.EnquiryWhereInput = {
      status: q.status,
      type: q.type,
      ...(q.q ? { OR: [{ reference: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { name: { contains: q.q, mode: "insensitive" } }] } : {}),
    };
    const [total, enquiries] = await Promise.all([
      prisma.enquiry.count({ where }),
      prisma.enquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { package: { select: { name: true } }, course: { select: { title: true } }, user: { select: { memberId: true } } },
      }),
    ]);
    res.json({ total, enquiries });
  }),
);

adminRouter.patch(
  "/enquiries/:id",
  SUPPORT_OR_CONTENT,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ status: z.enum(["NEW", "CONTACTED", "CONFIRMED", "CANCELLED", "CLOSED"]), adminNotes: z.string().max(5000).optional() }), req.body);
    const before = await prisma.enquiry.findUniqueOrThrow({ where: { id: req.params.id } });
    await prisma.enquiry.update({ where: { id: before.id }, data: body });
    if (before.status !== body.status) {
      await sendWhatsApp(before.phone, `World Vista: your enquiry ${before.reference} is now ${body.status.toLowerCase()}.`);
    }
    if (before.userId && before.status !== body.status) {
      await prisma.notification.create({ data: { userId: before.userId, title: `Enquiry ${before.reference}`, body: `Status updated to ${body.status.toLowerCase()}.` } });
    }
    await audit({ actorId: req.user!.id, action: "admin.enquiry_update", entity: "Enquiry", entityId: before.id, before: { status: before.status }, after: body, ip: req.ip });
    res.json({ ok: true });
  }),
);

// ---------- Payments ----------
adminRouter.post(
  "/enquiries/:id/payment",
  SUPPORT_OR_CONTENT,
  asyncHandler(async (req, res) => {
    if (!features.payments) throw new HttpError(503, "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    const body = parse(
      z.object({
        amount: z.coerce.number().positive().max(1_000_000),
        currency: z.enum(["USD", "INR"]),
        description: z.string().trim().min(3).max(200),
        expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
      }),
      req.body,
    );
    const enq = await prisma.enquiry.findUniqueOrThrow({ where: { id: req.params.id } });
    const p = await createPayment({
      purpose: "TOUR_BOOKING",
      ...body,
      payerName: enq.name,
      payerEmail: enq.email,
      payerPhone: enq.phone,
      enquiryId: enq.id,
      userId: enq.userId,
      createdById: req.user!.id,
    });
    const url = payLink(p.publicToken);
    await sendMail(enq.email, `Your World Vista payment link — ${enq.reference}`, `Hi ${enq.name},\n\nYour booking quote is ready: ${body.description}\nAmount: ${body.currency} ${body.amount}\n\nPay securely here (valid ${body.expiresInDays} days):\n${url}\n\nWorld Vista`);
    await sendWhatsApp(enq.phone, `World Vista: your quote for ${body.description} is ${body.currency} ${body.amount}. Pay securely: ${url}`);
    if (enq.status === "NEW") await prisma.enquiry.update({ where: { id: enq.id }, data: { status: "CONTACTED" } });
    await audit({ actorId: req.user!.id, action: "admin.payment_link_create", entity: "Payment", entityId: p.id, after: { reference: p.reference, enquiry: enq.reference, ...body }, ip: req.ip });
    res.status(201).json({ reference: p.reference, url });
  }),
);

adminRouter.get(
  "/payments",
  REPORTS,
  asyncHandler(async (req, res) => {
    const q = parse(pageArgs.extend({ status: z.enum(["CREATED", "PAID", "FAILED", "CANCELLED", "REFUNDED"]).optional() }), req.query);
    const where: Prisma.PaymentWhereInput = {
      status: q.status,
      ...(q.q ? { OR: [{ reference: { contains: q.q, mode: "insensitive" } }, { payerEmail: { contains: q.q, mode: "insensitive" } }, { payerName: { contains: q.q, mode: "insensitive" } }] } : {}),
    };
    const [total, payments, paidAgg] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { enquiry: { select: { reference: true } } } }),
      prisma.payment.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    ]);
    res.json({ total, payments: payments.map((p) => ({ ...p, url: payLink(p.publicToken) })), totals: paidAgg });
  }),
);

adminRouter.post(
  "/payments/:id/cancel",
  REPORTS,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ reason: z.string().trim().min(5) }), req.body);
    const r = await prisma.payment.updateMany({ where: { id: req.params.id, status: { in: ["CREATED", "FAILED"] } }, data: { status: "CANCELLED" } });
    if (!r.count) throw new HttpError(400, "Only unpaid links can be cancelled. Refunds are processed in the Razorpay dashboard.");
    await audit({ actorId: req.user!.id, action: "admin.payment_cancel", entity: "Payment", entityId: req.params.id, reason: body.reason, ip: req.ip });
    res.json({ ok: true });
  }),
);

// ---------- Uploads ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
adminRouter.post(
  "/uploads",
  CONTENT,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const url = await storeImage(req.file.buffer);
    await audit({ actorId: req.user!.id, action: "admin.upload", entity: "Upload", entityId: url, ip: req.ip });
    res.status(201).json({ url });
  }),
);

// ---------- Integration status ----------
adminRouter.get("/integrations", SUPER, (_req, res) => {
  res.json({ integrations: features });
});

// ---------- CMS: pages (versioned policies) ----------
adminRouter.get(
  "/pages",
  CONTENT,
  asyncHandler(async (_req, res) => {
    res.json({ pages: await prisma.page.findMany({ orderBy: { slug: "asc" } }) });
  }),
);

adminRouter.put(
  "/pages/:slug",
  CONTENT,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ title: z.string().min(2), body: z.string().min(1), published: z.boolean().default(true), isPolicy: z.boolean().default(false) }), req.body);
    const before = await prisma.page.findUnique({ where: { slug: req.params.slug } });
    const page = await prisma.$transaction(async (tx) => {
      const bodyChanged = !before || before.body !== body.body;
      const version = before ? (bodyChanged && before.isPolicy ? before.version + 1 : before.version) : 1;
      const p = await tx.page.upsert({
        where: { slug: req.params.slug },
        update: { ...body, version },
        create: { slug: req.params.slug, ...body, version },
      });
      if (p.isPolicy && bodyChanged) {
        await tx.policyVersion.create({ data: { pageId: p.id, version: p.version, body: p.body } });
      }
      return p;
    });
    await audit({ actorId: req.user!.id, action: "admin.page_update", entity: "Page", entityId: page.id, before: before ? { version: before.version, title: before.title } : null, after: { version: page.version, title: page.title }, ip: req.ip });
    res.json({ page });
  }),
);

// ---------- CMS: FAQs ----------
const faqSchema = z.object({ question: z.string().min(3), answer: z.string().min(1), sortOrder: z.coerce.number().int().default(0), active: z.boolean().default(true) });

adminRouter.get("/faqs", CONTENT, asyncHandler(async (_req, res) => {
  res.json({ faqs: await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } }) });
}));
adminRouter.post("/faqs", CONTENT, asyncHandler(async (req, res) => {
  const faq = await prisma.faq.create({ data: parse(faqSchema, req.body) });
  await audit({ actorId: req.user!.id, action: "admin.faq_create", entity: "Faq", entityId: faq.id, after: faq, ip: req.ip });
  res.status(201).json({ faq });
}));
adminRouter.put("/faqs/:id", CONTENT, asyncHandler(async (req, res) => {
  const faq = await prisma.faq.update({ where: { id: req.params.id }, data: parse(faqSchema, req.body) });
  await audit({ actorId: req.user!.id, action: "admin.faq_update", entity: "Faq", entityId: faq.id, after: faq, ip: req.ip });
  res.json({ faq });
}));
adminRouter.delete("/faqs/:id", CONTENT, asyncHandler(async (req, res) => {
  const faq = await prisma.faq.delete({ where: { id: req.params.id } });
  await audit({ actorId: req.user!.id, action: "admin.faq_delete", entity: "Faq", entityId: faq.id, before: faq, ip: req.ip });
  res.json({ ok: true });
}));

// ---------- Settings ----------
adminRouter.get("/settings", CONTENT, asyncHandler(async (_req, res) => {
  const rows = await prisma.setting.findMany();
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
}));
adminRouter.put("/settings/:key", CONTENT, asyncHandler(async (req, res) => {
  const key = parse(z.enum(["contact", "company"]), req.params.key);
  const value = parse(z.record(z.string(), z.string().max(1000)), req.body);
  const before = await prisma.setting.findUnique({ where: { key } });
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  await audit({ actorId: req.user!.id, action: "admin.setting_update", entity: "Setting", entityId: key, before: before?.value ?? null, after: value, ip: req.ip });
  res.json({ ok: true });
}));

// ---------- Support tickets ----------
adminRouter.get("/tickets", SUPPORT, asyncHandler(async (req, res) => {
  const q = parse(z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional() }), req.query);
  const tickets = await prisma.supportTicket.findMany({
    where: { status: q.status },
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { memberId: true, fullName: true } } },
  });
  res.json({ tickets });
}));

adminRouter.get("/tickets/:id", SUPPORT, asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { memberId: true, fullName: true, email: true } }, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true } } } } },
  });
  if (!ticket) throw new HttpError(404, "Ticket not found");
  res.json({ ticket });
}));

adminRouter.post("/tickets/:id/reply", SUPPORT, asyncHandler(async (req, res) => {
  const body = parse(z.object({ body: z.string().trim().min(1).max(5000), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) }), req.body);
  const t = await prisma.supportTicket.findUniqueOrThrow({ where: { id: req.params.id } });
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId: t.id, authorId: req.user!.id, body: body.body, isStaff: true } }),
    prisma.supportTicket.update({ where: { id: t.id }, data: { status: body.status } }),
    prisma.notification.create({ data: { userId: t.userId, title: `Support reply: ${t.reference}`, body: t.subject } }),
  ]);
  await audit({ actorId: req.user!.id, action: "admin.ticket_reply", entity: "SupportTicket", entityId: t.id, after: { status: body.status }, ip: req.ip });
  res.json({ ok: true });
}));

// ---------- Compensation module register (specification only) ----------
adminRouter.get("/modules", SUPER, asyncHandler(async (_req, res) => {
  res.json({ modules: await prisma.moduleConfig.findMany({ orderBy: { key: "asc" } }) });
}));

adminRouter.patch("/modules/:key", SUPER, asyncHandler(async (req, res) => {
  // Status can only move between non-active states; there is no payout engine to switch on.
  const body = parse(z.object({ status: z.enum(["PENDING_OWNER_APPROVAL", "PENDING_LEGAL_REVIEW", "WITHDRAWN"]), ownerNotes: z.string().max(10000) }), req.body);
  const before = await prisma.moduleConfig.findUniqueOrThrow({ where: { key: req.params.key } });
  await prisma.moduleConfig.update({ where: { key: before.key }, data: body });
  await audit({ actorId: req.user!.id, action: "admin.module_update", entity: "ModuleConfig", entityId: before.key, before: { status: before.status, ownerNotes: before.ownerNotes }, after: body, ip: req.ip });
  res.json({ ok: true });
}));

// ---------- Audit ----------
adminRouter.get("/audit", SUPER, asyncHandler(async (req, res) => {
  const q = parse(pageArgs.extend({ entity: z.string().optional() }), req.query);
  const where: Prisma.AuditLogWhereInput = {
    entity: q.entity,
    ...(q.q ? { OR: [{ action: { contains: q.q, mode: "insensitive" } }, { entityId: { contains: q.q } }] } : {}),
  };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { seq: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { actor: { select: { memberId: true, fullName: true } } } }),
  ]);
  res.json({ total, logs });
}));

adminRouter.get("/audit/verify", SUPER, asyncHandler(async (_req, res) => {
  res.json(await verifyAuditChain());
}));

// ---------- CSV reports ----------
function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // CSV formula-injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

adminRouter.get("/reports/:kind.csv", REPORTS, asyncHandler(async (req, res) => {
  const q = parse(z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }), req.query);
  const createdAt = { gte: q.from, lte: q.to };
  let rows: Record<string, unknown>[];
  switch (req.params.kind) {
    case "members":
      rows = (await prisma.user.findMany({ where: { role: "MEMBER", createdAt }, include: { sponsor: { select: { memberId: true } }, placementParent: { select: { memberId: true } } }, orderBy: { createdAt: "asc" } })).map((u) => ({
        memberId: u.memberId, fullName: u.fullName, email: u.email, mobile: u.mobile, country: u.country, status: u.status,
        sponsor: u.sponsor?.memberId, placementParent: u.placementParent?.memberId, side: u.placementSide, joinedAt: u.createdAt,
      }));
      break;
    case "enquiries":
      rows = (await prisma.enquiry.findMany({ where: { createdAt }, include: { package: true, course: true }, orderBy: { createdAt: "asc" } })).map((e) => ({
        reference: e.reference, type: e.type, item: e.package?.name ?? e.course?.title ?? "", name: e.name, email: e.email, phone: e.phone,
        travellers: e.travellers, preferredDate: e.preferredDate, status: e.status, createdAt: e.createdAt,
      }));
      break;
    case "payments":
      if (!["SUPER_ADMIN", "FINANCE_ADMIN"].includes(req.user!.role)) throw new HttpError(403, "Finance or Super Admin only");
      rows = (await prisma.payment.findMany({ where: { createdAt }, include: { enquiry: { select: { reference: true } } }, orderBy: { createdAt: "asc" } })).map((p) => ({
        reference: p.reference, purpose: p.purpose, enquiry: p.enquiry?.reference, payer: p.payerName, email: p.payerEmail, description: p.description,
        amount: p.amount.toString(), currency: p.currency, status: p.status, razorpayOrder: p.providerOrderId, razorpayPayment: p.providerPaymentId, paidAt: p.paidAt, createdAt: p.createdAt,
      }));
      break;
    case "audit":
      if (req.user!.role !== "SUPER_ADMIN") throw new HttpError(403, "Super Admin only");
      rows = (await prisma.auditLog.findMany({ where: { createdAt }, orderBy: { seq: "asc" } })).map((a) => ({
        seq: a.seq, at: a.createdAt, actorId: a.actorId, action: a.action, entity: a.entity, entityId: a.entityId, reason: a.reason, hash: a.hash,
      }));
      break;
    default:
      throw new HttpError(404, "Unknown report");
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv(rows));
}));
