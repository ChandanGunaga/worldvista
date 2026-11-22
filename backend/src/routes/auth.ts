import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { issueOtp, verifyOtp } from "../lib/otp";
import { generateMemberId } from "../lib/ids";
import { findPlacement } from "../lib/genealogy";
import { audit } from "../lib/audit";
import { sendMail } from "../lib/mailer";
import { ADMIN_ROLES, clearSession, requireAuth, setSession } from "../middleware/auth";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
authRouter.use(limiter);

const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Must contain a letter")
  .regex(/[0-9]/, "Must contain a number");
const email = z.string().trim().toLowerCase().email();
const code = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

const publicUser = (u: { id: string; memberId: string; fullName: string; email: string; role: string; status: string }) => ({
  id: u.id,
  memberId: u.memberId,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  status: u.status,
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        fullName: z.string().trim().min(2).max(120),
        email,
        mobile: z.string().trim().min(6).max(20),
        password,
        country: z.string().trim().min(2).max(80),
        address: z.string().trim().max(300).optional(),
        sponsorId: z.string().trim().toUpperCase().optional().or(z.literal("")),
        side: z.enum(["LEFT", "RIGHT"]).default("LEFT"),
        consent: z.literal(true, { message: "You must accept the Terms and Privacy Policy" }),
      }),
      req.body,
    );

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, "An account with this email already exists");

    let sponsor = null;
    if (body.sponsorId) {
      sponsor = await prisma.user.findUnique({ where: { memberId: body.sponsorId } });
      if (!sponsor || sponsor.status !== "ACTIVE") throw new HttpError(400, "Sponsor ID not found or not active");
    }

    const memberId = await generateMemberId();
    const passwordHash = await bcrypt.hash(body.password, 12);

    const policyVersions = await prisma.policyVersion.findMany({
      where: { page: { slug: { in: ["terms", "privacy"] } } },
      orderBy: { version: "desc" },
      distinct: ["pageId"],
    });

    const user = await prisma.$transaction(
      async (tx) => {
        const placement = sponsor ? await findPlacement(tx, sponsor.id, body.side) : {};
        const u = await tx.user.create({
          data: {
            memberId,
            fullName: body.fullName,
            email: body.email,
            mobile: body.mobile,
            country: body.country,
            address: body.address,
            passwordHash,
            consentAt: new Date(),
            sponsorId: sponsor?.id,
            ...placement,
          },
        });
        for (const pv of policyVersions) {
          await tx.policyAcceptance.create({ data: { userId: u.id, policyVersionId: pv.id, ip: req.ip } });
        }
        return u;
      },
      { isolationLevel: "Serializable" },
    );

    await audit({ actorId: user.id, action: "member.register", entity: "User", entityId: user.id, after: { memberId, sponsor: sponsor?.memberId ?? null }, ip: req.ip });
    await issueOtp({ email: user.email, purpose: "VERIFY_EMAIL", userId: user.id });
    res.status(201).json({ message: "Account created. Check your email for a verification code.", email: user.email });
  }),
);

authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ email, code }), req.body);
    await verifyOtp(body.email, "VERIFY_EMAIL", body.code);
    const user = await prisma.user.update({
      where: { email: body.email },
      data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
    });
    await prisma.notification.create({
      data: { userId: user.id, title: "Welcome to World Vista", body: `Your member ID is ${user.memberId}.` },
    });
    setSession(res, user);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ email }), req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user && !user.emailVerifiedAt) await issueOtp({ email: user.email, purpose: "VERIFY_EMAIL", userId: user.id });
    res.json({ message: "If the account needs verification, a new code has been sent." });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ email, password: z.string().min(1) }), req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, "Incorrect email or password");
    }
    if (user.status === "SUSPENDED") throw new HttpError(403, "This account is suspended. Contact support.");
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Email not verified", needsVerification: true, email: user.email });
    }
    // Admin accounts require a second factor (email OTP)
    if (ADMIN_ROLES.includes(user.role)) {
      await issueOtp({ email: user.email, purpose: "ADMIN_LOGIN", userId: user.id });
      return res.json({ mfaRequired: true, email: user.email });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    setSession(res, user);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  "/login/mfa",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ email, code }), req.body);
    const otp = await verifyOtp(body.email, "ADMIN_LOGIN", body.code);
    const user = await prisma.user.update({ where: { id: otp.userId! }, data: { lastLoginAt: new Date() } });
    await audit({ actorId: user.id, action: "admin.login", entity: "User", entityId: user.id, ip: req.ip });
    setSession(res, user);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ email }), req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user) {
      try {
        await issueOtp({ email: user.email, purpose: "RESET_PASSWORD", userId: user.id });
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 429)) throw e;
      }
    }
    // Same response either way to avoid account enumeration
    res.json({ message: "If an account exists for that email, a reset code has been sent." });
  }),
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ email, code, password }), req.body);
    const otp = await verifyOtp(body.email, "RESET_PASSWORD", body.code);
    const user = await prisma.user.update({
      where: { id: otp.userId! },
      data: { passwordHash: await bcrypt.hash(body.password, 12), tokenVersion: { increment: 1 } },
    });
    await audit({ actorId: user.id, action: "member.password_reset", entity: "User", entityId: user.id, ip: req.ip });
    await sendMail(user.email, "Your World Vista password was changed", "Your password was just reset. If this wasn't you, contact support immediately.");
    res.json({ message: "Password updated. You can now sign in." });
  }),
);
