import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { reference } from "../lib/ids";
import { sendMail } from "../lib/mailer";
import { optionalAuth } from "../middleware/auth";
import { features } from "../lib/env";
import { sendWhatsApp } from "../lib/whatsapp";

export const publicRouter = Router();

publicRouter.get(
  "/packages",
  asyncHandler(async (_req, res) => {
    const packages = await prisma.tourPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    res.json({ packages });
  }),
);

publicRouter.get(
  "/packages/:slug",
  asyncHandler(async (req, res) => {
    const pkg = await prisma.tourPackage.findFirst({ where: { slug: req.params.slug, active: true } });
    if (!pkg) throw new HttpError(404, "Package not found");
    res.json({ package: pkg });
  }),
);

publicRouter.get(
  "/courses",
  asyncHandler(async (_req, res) => {
    const courses = await prisma.course.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
    res.json({ courses });
  }),
);

publicRouter.get(
  "/faqs",
  asyncHandler(async (_req, res) => {
    const faqs = await prisma.faq.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    res.json({ faqs });
  }),
);

publicRouter.get(
  "/pages/:slug",
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findFirst({ where: { slug: req.params.slug, published: true } });
    if (!page) throw new HttpError(404, "Page not found");
    res.json({ page });
  }),
);

publicRouter.get("/config", (_req, res) => {
  res.json({ payments: features.payments });
});

const PUBLIC_SETTINGS = ["contact", "company"];
publicRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_SETTINGS } } });
    res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }),
);

const enquiryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

publicRouter.post(
  "/enquiries",
  enquiryLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        type: z.enum(["TOUR", "COURSE", "GENERAL"]),
        packageId: z.string().optional(),
        courseId: z.string().optional(),
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        phone: z.string().trim().max(20).optional(),
        travellers: z.coerce.number().int().min(1).max(50).optional(),
        preferredDate: z.coerce.date().optional(),
        message: z.string().trim().max(2000).default(""),
        website: z.string().max(0).optional(), // honeypot
      }),
      req.body,
    );
    if (body.type === "TOUR" && !body.packageId) throw new HttpError(400, "Choose a package");
    if (body.packageId && !(await prisma.tourPackage.findFirst({ where: { id: body.packageId, active: true } }))) {
      throw new HttpError(400, "Package not available");
    }
    const { website: _hp, ...data } = body;
    const enquiry = await prisma.enquiry.create({
      data: { ...data, reference: reference("ENQ"), userId: req.user?.id },
      include: { package: true },
    });
    await sendMail(
      enquiry.email,
      `We received your enquiry ${enquiry.reference}`,
      `Hi ${enquiry.name},\n\nThank you for contacting World Vista${enquiry.package ? ` about ${enquiry.package.name}` : ""}. Our travel team will reply within 1–2 business days.\n\nReference: ${enquiry.reference}`,
    );
    await sendWhatsApp(enquiry.phone, `World Vista: thank you, ${enquiry.name}! We received your enquiry ${enquiry.reference}. Our team will contact you within 1–2 business days.`);
    res.status(201).json({ reference: enquiry.reference });
  }),
);
