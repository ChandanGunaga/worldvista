import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { issueOtp, verifyOtp } from "../lib/otp";
import { audit } from "../lib/audit";
import { sendMail } from "../lib/mailer";
import { reference } from "../lib/ids";
import { legCounts, loadBinaryTree, isInDownline } from "../lib/genealogy";
import { env } from "../lib/env";
import { requireAuth, setSession } from "../middleware/auth";
import { createPayment, payLink } from "../lib/payments";
import { features } from "../lib/env";

export const memberRouter = Router();
memberRouter.use(requireAuth);

memberRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const id = req.user!.id;
    const [user, directs, legs, enquiries, enrollments, openTickets, notifications] = await Promise.all([
      prisma.user.findUnique({ where: { id }, include: { sponsor: { select: { memberId: true, fullName: true } } } }),
      prisma.user.count({ where: { sponsorId: id } }),
      legCounts(prisma, id),
      prisma.enquiry.count({ where: { userId: id } }),
      prisma.enrollment.count({ where: { userId: id } }),
      prisma.supportTicket.count({ where: { userId: id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    res.json({
      memberId: user!.memberId,
      fullName: user!.fullName,
      status: user!.status,
      joinedAt: user!.createdAt,
      sponsor: user!.sponsor,
      stats: { directs, leftTeam: legs.LEFT, rightTeam: legs.RIGHT, enquiries, enrollments, openTickets },
      notifications,
    });
  }),
);

// ---------- Profile & security ----------
memberRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        memberId: true, fullName: true, email: true, mobile: true, country: true, address: true,
        status: true, emailVerifiedAt: true, notifyEmail: true, createdAt: true, lastLoginAt: true,
      },
    });
    res.json({ profile: u });
  }),
);

memberRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        fullName: z.string().trim().min(2).max(120).optional(),
        mobile: z.string().trim().min(6).max(20).optional(),
        country: z.string().trim().min(2).max(80).optional(),
        address: z.string().trim().max(300).optional(),
        notifyEmail: z.boolean().optional(),
      }),
      req.body,
    );
    const before = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true, mobile: true, country: true, address: true } });
    await prisma.user.update({ where: { id: req.user!.id }, data: body });
    await audit({ actorId: req.user!.id, action: "member.profile_update", entity: "User", entityId: req.user!.id, before, after: body, ip: req.ip });
    res.json({ ok: true });
  }),
);

memberRouter.post(
  "/change-password",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
      }),
      req.body,
    );
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(body.currentPassword, u.passwordHash))) throw new HttpError(400, "Current password is incorrect");
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 12), tokenVersion: { increment: 1 } },
    });
    setSession(res, updated);
    await audit({ actorId: u.id, action: "member.password_change", entity: "User", entityId: u.id, ip: req.ip });
    await sendMail(u.email, "Your World Vista password was changed", "Your password was just changed. If this wasn't you, contact support immediately.");
    res.json({ ok: true });
  }),
);

memberRouter.post(
  "/change-email/request",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ newEmail: z.string().trim().toLowerCase().email(), password: z.string().min(1) }), req.body);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(body.password, u.passwordHash))) throw new HttpError(400, "Password is incorrect");
    if (await prisma.user.findUnique({ where: { email: body.newEmail } })) throw new HttpError(409, "That email is already in use");
    await issueOtp({ email: body.newEmail, purpose: "CHANGE_EMAIL", userId: u.id, payload: u.id });
    res.json({ message: `A code was sent to ${body.newEmail}` });
  }),
);

memberRouter.post(
  "/change-email/confirm",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ newEmail: z.string().trim().toLowerCase().email(), code: z.string().regex(/^\d{6}$/) }), req.body);
    const otp = await verifyOtp(body.newEmail, "CHANGE_EMAIL", body.code);
    if (otp.payload !== req.user!.id) throw new HttpError(400, "Code does not match this account");
    const oldEmail = req.user!.email;
    const u = await prisma.user.update({ where: { id: req.user!.id }, data: { email: body.newEmail, tokenVersion: { increment: 1 } } });
    setSession(res, u);
    await audit({ actorId: u.id, action: "member.email_change", entity: "User", entityId: u.id, before: { email: oldEmail }, after: { email: body.newEmail }, ip: req.ip });
    await sendMail(oldEmail, "Your World Vista email was changed", `Your account email was changed to ${body.newEmail}. If this wasn't you, contact support immediately.`);
    await sendMail(body.newEmail, "Your World Vista email was changed", "This address is now the sign-in email for your World Vista account.");
    res.json({ ok: true });
  }),
);

// ---------- Referral & team ----------
memberRouter.get(
  "/referral",
  asyncHandler(async (req, res) => {
    res.json({
      memberId: req.user!.memberId,
      leftLink: `${env.frontendUrl}/register?ref=${req.user!.memberId}&side=LEFT`,
      rightLink: `${env.frontendUrl}/register?ref=${req.user!.memberId}&side=RIGHT`,
    });
  }),
);

memberRouter.get(
  "/team/direct",
  asyncHandler(async (req, res) => {
    const directs = await prisma.user.findMany({
      where: { sponsorId: req.user!.id },
      select: { memberId: true, fullName: true, status: true, placementSide: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ directs });
  }),
);

memberRouter.get(
  "/team/binary",
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ root: z.string().optional(), depth: z.coerce.number().int().min(1).max(5).default(3) }), req.query);
    let rootId = req.user!.id;
    if (q.root) {
      const target = await prisma.user.findUnique({ where: { memberId: q.root.toUpperCase() } });
      if (!target) throw new HttpError(404, "Member not found");
      // Members may only browse their own downline
      if (target.id !== req.user!.id && !(await isInDownline(prisma, req.user!.id, target.id))) {
        throw new HttpError(403, "That member is not in your team");
      }
      rootId = target.id;
    }
    const [tree, legs] = await Promise.all([loadBinaryTree(prisma, rootId, q.depth), legCounts(prisma, rootId)]);
    res.json({ tree, legs });
  }),
);

// ---------- Tourism & education ----------
memberRouter.get(
  "/enquiries",
  asyncHandler(async (req, res) => {
    const enquiries = await prisma.enquiry.findMany({
      where: { OR: [{ userId: req.user!.id }, { email: req.user!.email }] },
      include: { package: { select: { name: true } }, course: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ enquiries });
  }),
);

memberRouter.get(
  "/enrollments",
  asyncHandler(async (req, res) => {
    const enrollments = await prisma.enrollment.findMany({ where: { userId: req.user!.id }, include: { course: true } });
    res.json({ enrollments });
  }),
);

memberRouter.post(
  "/enrollments",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ courseId: z.string() }), req.body);
    const course = await prisma.course.findFirst({ where: { id: body.courseId, active: true } });
    if (!course) throw new HttpError(404, "Course not found");
    if (!course.enrollmentOpen) throw new HttpError(400, "Enrolment is currently closed for this course");
    const enr = await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
      update: {},
      create: { userId: req.user!.id, courseId: course.id },
    });
    res.status(201).json({ enrollment: enr });
  }),
);

memberRouter.post(
  "/enrollments/:id/pay",
  asyncHandler(async (req, res) => {
    if (!features.payments) throw new HttpError(503, "Online payments are not available yet. Our team will contact you.");
    const enr = await prisma.enrollment.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { course: true, user: true } });
    if (!enr) throw new HttpError(404, "Enrolment not found");
    if (enr.status !== "REQUESTED") throw new HttpError(400, "This enrolment does not need payment");
    const open = await prisma.payment.findFirst({ where: { enrollmentId: enr.id, status: { in: ["CREATED", "FAILED"] }, expiresAt: { gt: new Date() } } });
    const p =
      open ??
      (await createPayment({
        purpose: "COURSE_FEE",
        amount: Number(enr.course.tuition),
        currency: enr.course.currency,
        description: `${enr.course.title} — tuition`,
        payerName: enr.user.fullName,
        payerEmail: enr.user.email,
        payerPhone: enr.user.mobile,
        enrollmentId: enr.id,
        userId: enr.userId,
      }));
    res.json({ token: p.publicToken, url: payLink(p.publicToken) });
  }),
);

memberRouter.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: { OR: [{ userId: req.user!.id }, { payerEmail: req.user!.email }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, publicToken: true, description: true, amount: true, currency: true, status: true, paidAt: true, createdAt: true, expiresAt: true },
    });
    res.json({ payments });
  }),
);

// ---------- Support ----------
memberRouter.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    const tickets = await prisma.supportTicket.findMany({ where: { userId: req.user!.id }, orderBy: { updatedAt: "desc" } });
    res.json({ tickets });
  }),
);

memberRouter.get(
  "/tickets/:id",
  asyncHandler(async (req, res) => {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true } } } } },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found");
    res.json({ ticket });
  }),
);

const ticketMsg = z.object({
  body: z.string().trim().min(2).max(5000),
  attachmentUrl: z.string().url().max(500).optional().or(z.literal("")),
});

memberRouter.post(
  "/tickets",
  asyncHandler(async (req, res) => {
    const body = parse(
      ticketMsg.extend({ subject: z.string().trim().min(3).max(150), category: z.enum(["Account", "Tourism", "Education", "Technical", "Other"]) }),
      req.body,
    );
    const ticket = await prisma.supportTicket.create({
      data: {
        reference: reference("TKT"),
        userId: req.user!.id,
        subject: body.subject,
        category: body.category,
        messages: { create: { authorId: req.user!.id, body: body.body, attachmentUrl: body.attachmentUrl || null } },
      },
    });
    res.status(201).json({ ticket });
  }),
);

memberRouter.post(
  "/tickets/:id/messages",
  asyncHandler(async (req, res) => {
    const body = parse(ticketMsg, req.body);
    const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!ticket) throw new HttpError(404, "Ticket not found");
    if (ticket.status === "CLOSED") throw new HttpError(400, "This ticket is closed");
    await prisma.$transaction([
      prisma.ticketMessage.create({ data: { ticketId: ticket.id, authorId: req.user!.id, body: body.body, attachmentUrl: body.attachmentUrl || null } }),
      prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } }),
    ]);
    res.status(201).json({ ok: true });
  }),
);

// ---------- Notifications ----------
memberRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ notifications });
  }),
);

memberRouter.post(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  }),
);

// ---------- Compensation modules (status only; no engine) ----------
memberRouter.get(
  "/modules",
  asyncHandler(async (_req, res) => {
    const modules = await prisma.moduleConfig.findMany({ select: { key: true, name: true, category: true, status: true } });
    res.json({ modules });
  }),
);
