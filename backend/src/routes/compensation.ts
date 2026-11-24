import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, HttpError, parse } from "../lib/http";
import { audit } from "../lib/audit";
import { issueOtp, verifyOtp } from "../lib/otp";
import { sendMail } from "../lib/mailer";
import { ADMIN_ROLES, requireAuth, requireRole } from "../middleware/auth";
import {
  BEP20_ADDRESS, DEFAULT_SETTINGS, closeDueWeeks, currentWeekPreview, getSettings, incomeSummary, lifetimeVolume, processActivation,
  requestWithdrawal, reviewRankReward, reviewWithdrawal, saveSettings, weekKeyFor, weekRange, type CompSettings,
} from "../lib/compensation";

async function checkPassword(req: Request) {
  const pw = typeof req.body?.password === "string" ? req.body.password : "";
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!pw || !(await bcrypt.compare(pw, u.passwordHash))) throw new HttpError(403, "Re-enter your password to confirm this action");
  return u;
}
const money = (d: Prisma.Decimal | number | string | null | undefined) => Number(d ?? 0).toFixed(2);

// ═══════════════════════ Member ═══════════════════════
export const memberCompRouter = Router();
memberCompRouter.use(requireAuth);

memberCompRouter.get(
  "/income",
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ type: z.enum(["DIRECT", "BINARY", "RANK", "REVERSAL", "WITHDRAWAL_HOLD", "WITHDRAWAL_RELEASE"]).optional() }), req.query);
    const [summary, ledger, week, s] = await Promise.all([
      incomeSummary(req.user!.id),
      prisma.incomeEntry.findMany({
        where: { userId: req.user!.id, type: q.type },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, txId: true, type: true, amount: true, balanceAfter: true, memo: true, calc: true, weekKey: true, createdAt: true, activation: { select: { receiptNo: true, itemName: true } }, withdrawal: { select: { reference: true } } },
      }),
      currentWeekPreview(req.user!.id),
      getSettings(),
    ]);
    res.json({ summary, ledger, week, engineEnabled: s.enabled });
  }),
);

memberCompRouter.get(
  "/volume",
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query);
    const [current, weeks, lifetime, s] = await Promise.all([
      currentWeekPreview(req.user!.id),
      prisma.binaryWeek.findMany({ where: { userId: req.user!.id, weekKey: { gte: q.from, lte: q.to } }, orderBy: { weekKey: "desc" }, take: 104 }),
      lifetimeVolume(prisma, req.user!.id),
      getSettings(),
    ]);
    res.json({
      current, weeks, lifetime: { left: lifetime.L.toFixed(2), right: lifetime.R.toFixed(2) },
      rules: { binaryRate: s.binaryRate, weeklyCap: s.weeklyCap, carryForwardVolume: s.carryForwardVolume, timezone: s.timezoneLabel, weekStartDay: s.weekStartDay, basis: s.binaryBasis },
    });
  }),
);

memberCompRouter.get(
  "/ranks",
  asyncHandler(async (req, res) => {
    const [ranks, vol, achievements] = await Promise.all([
      prisma.rank.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      lifetimeVolume(prisma, req.user!.id),
      prisma.rankAchievement.findMany({ where: { userId: req.user!.id }, include: { rank: true }, orderBy: { qualifiedAt: "asc" } }),
    ]);
    const got = new Set(achievements.map((a) => a.rankId));
    const current = [...achievements].sort((a, b) => b.rank.sortOrder - a.rank.sortOrder)[0]?.rank ?? null;
    const next = ranks.find((r) => !got.has(r.id)) ?? null;
    res.json({
      volume: { left: vol.L.toFixed(2), right: vol.R.toFixed(2) },
      current: current && { name: current.name },
      next: next && {
        name: next.name, leftTarget: money(next.leftVolume), rightTarget: money(next.rightVolume), reward: money(next.reward),
        leftPct: Math.min(100, Math.round((Number(vol.L) / Number(next.leftVolume)) * 100)), rightPct: Math.min(100, Math.round((Number(vol.R) / Number(next.rightVolume)) * 100)),
      },
      ranks: ranks.map((r) => ({ id: r.id, name: r.name, leftVolume: money(r.leftVolume), rightVolume: money(r.rightVolume), reward: money(r.reward), achieved: got.has(r.id) })),
      history: achievements.map((a) => ({ id: a.id, rank: a.rank.name, qualifiedAt: a.qualifiedAt, reward: money(a.reward), rewardStatus: a.rewardStatus, reviewedAt: a.reviewedAt })),
    });
  }),
);

memberCompRouter.get(
  "/plan",
  asyncHandler(async (_req, res) => {
    const [s, ranks] = await Promise.all([getSettings(), prisma.rank.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })]);
    res.json({
      enabled: s.enabled, directRate: s.directRate, binaryRate: s.binaryRate, weeklyCap: s.weeklyCap, carryForwardVolume: s.carryForwardVolume,
      timezone: s.timezoneLabel, weekStartDay: s.weekStartDay, commissionBase: s.commissionBase, withdrawal: s.withdrawal,
      ranks: ranks.map((r) => ({ name: r.name, leftVolume: money(r.leftVolume), rightVolume: money(r.rightVolume), reward: money(r.reward) })),
    });
  }),
);

memberCompRouter.get(
  "/withdrawals",
  asyncHandler(async (req, res) => {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, amount: true, fee: true, net: true, network: true, address: true, status: true, txHash: true, rejectReason: true, createdAt: true, completedAt: true },
    });
    // Member-facing status per spec §24: Processing is internal → shown as Pending
    res.json({ withdrawals: withdrawals.map((w) => ({ ...w, status: w.status === "PROCESSING" ? "PENDING" : w.status })) });
  }),
);

memberCompRouter.post(
  "/withdrawals",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ amount: z.coerce.number().positive(), confirmAddress: z.string().trim(), password: z.string() }), req.body);
    const u = await checkPassword(req);
    const w = await requestWithdrawal(req.user!.id, body.amount, body.confirmAddress);
    await audit({ actorId: u.id, action: "withdrawal.request", entity: "Withdrawal", entityId: w.id, after: { reference: w.reference, amount: money(w.amount), fee: money(w.fee), net: money(w.net), address: w.address }, ip: req.ip });
    await prisma.notification.create({ data: { userId: u.id, title: `Withdrawal ${w.reference} pending`, body: `USD ${money(w.amount)} requested (fee ${money(w.fee)}, net ${money(w.net)} USDT) to ${w.address}.` } });
    res.status(201).json({ withdrawal: w });
  }),
);

memberCompRouter.post(
  "/wallet/request",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ address: z.string().trim(), password: z.string() }), req.body);
    if (!BEP20_ADDRESS.test(body.address)) throw new HttpError(400, "Enter a valid BNB Smart Chain (BEP20) address: 0x followed by 40 hex characters");
    const u = await checkPassword(req);
    if (u.walletAddress?.toLowerCase() === body.address.toLowerCase()) throw new HttpError(400, "That is already your saved address");
    await issueOtp({ email: u.email, purpose: "CHANGE_WALLET", userId: u.id, payload: `${u.id}|${body.address}` });
    res.json({ message: `We sent a 6-digit code to ${u.email}` });
  }),
);

memberCompRouter.post(
  "/wallet/confirm",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ address: z.string().trim(), code: z.string().regex(/^\d{6}$/) }), req.body);
    const otp = await verifyOtp(req.user!.email, "CHANGE_WALLET", body.code);
    if (otp.payload !== `${req.user!.id}|${body.address}`) throw new HttpError(400, "The code was issued for a different address. Request a new code.");
    const before = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { walletAddress: true } });
    const s = await getSettings();
    await prisma.user.update({ where: { id: req.user!.id }, data: { walletAddress: body.address, walletChangedAt: new Date() } });
    await audit({ actorId: req.user!.id, action: "wallet.address_change", entity: "User", entityId: req.user!.id, before, after: { walletAddress: body.address }, ip: req.ip });
    const msg = `Your USDT (BEP20) withdrawal address was changed to ${body.address}. For your security, withdrawals are paused for ${s.withdrawal.holdHours} hours. If this wasn't you, contact support immediately.`;
    await sendMail(req.user!.email, "Your World Vista withdrawal address was changed", msg);
    await prisma.notification.create({ data: { userId: req.user!.id, title: "Withdrawal address changed", body: msg } });
    res.json({ ok: true });
  }),
);

// ═══════════════════════ Admin ═══════════════════════
export const adminCompRouter = Router();
adminCompRouter.use(requireAuth, requireRole(...ADMIN_ROLES));
const FINANCE = requireRole("FINANCE_ADMIN");
const SUPER = requireRole();

const settingsSchema = z.object({
  directRate: z.coerce.number().min(0).max(50),
  binaryRate: z.coerce.number().min(0).max(50),
  weeklyCap: z.coerce.number().min(0).max(1_000_000),
  carryForwardVolume: z.boolean(),
  weekStartDay: z.coerce.number().int().min(0).max(6),
  tzOffsetMinutes: z.coerce.number().int().min(-720).max(840),
  timezoneLabel: z.string().trim().min(2).max(60),
  commissionBase: z.enum(["PRICE_EXCL_SERVICE", "TOTAL_INCL_SERVICE"]),
  autoCloseWeeks: z.boolean(),
  withdrawal: z.object({
    feePct: z.coerce.number().min(0).max(50), min: z.coerce.number().min(0), max: z.coerce.number().min(1), holdHours: z.coerce.number().int().min(0).max(720), enabled: z.boolean(),
  }),
  enabled: z.boolean(),
  ownerApproval: z.boolean().optional(),
  password: z.string(),
});

adminCompRouter.get(
  "/compensation/settings",
  FINANCE,
  asyncHandler(async (_req, res) => {
    const s = await getSettings();
    const week = weekKeyFor(new Date(), s);
    const approver = s.approvedById ? await prisma.user.findUnique({ where: { id: s.approvedById }, select: { fullName: true } }) : null;
    res.json({ settings: { ...s, approvedByName: approver?.fullName ?? null }, defaults: DEFAULT_SETTINGS, currentWeek: week, currentWeekRange: weekRange(week, s) });
  }),
);

adminCompRouter.put(
  "/compensation/settings",
  SUPER,
  asyncHandler(async (req, res) => {
    const body = parse(settingsSchema, req.body);
    await checkPassword(req);
    const before = await getSettings();
    if (body.enabled && !before.enabled && !body.ownerApproval) throw new HttpError(400, "Tick the owner approval confirmation to switch the engine on");
    const { password: _pw, ownerApproval, ...rest } = body;
    void _pw;
    const next: CompSettings = {
      ...before, ...rest, capExcessCarryForward: false, binaryBasis: "WEAKER_LEG",
      approvedById: body.enabled && !before.enabled ? req.user!.id : before.approvedById,
      approvedAt: body.enabled && !before.enabled ? new Date().toISOString() : before.approvedAt,
    };
    await saveSettings(next);
    await audit({ actorId: req.user!.id, action: "compensation.settings", entity: "Setting", entityId: "compensation", before, after: next, reason: ownerApproval ? "Owner approval confirmed" : null, ip: req.ip });
    let backfilled = 0;
    if (next.enabled && !before.enabled) {
      const acts = await prisma.packageActivation.findMany({ where: { status: "ACTIVE" }, select: { id: true }, orderBy: { createdAt: "asc" } });
      for (const a of acts) { await processActivation(a.id); backfilled++; }
    }
    res.json({ settings: next, backfilled });
  }),
);

adminCompRouter.post(
  "/compensation/close-weeks",
  FINANCE,
  asyncHandler(async (req, res) => {
    const r = await closeDueWeeks(req.user!.id);
    await audit({ actorId: req.user!.id, action: "compensation.close_weeks", entity: "BinaryWeek", after: r, ip: req.ip });
    res.json(r);
  }),
);

adminCompRouter.get(
  "/compensation/weeks",
  FINANCE,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ week: z.string().optional(), capped: z.enum(["1", "0"]).optional(), q: z.string().trim().optional() }), req.query);
    const weekKeys = (await prisma.binaryWeek.findMany({ distinct: ["weekKey"], select: { weekKey: true }, orderBy: { weekKey: "desc" }, take: 104 })).map((w) => w.weekKey);
    const week = q.week ?? weekKeys[0];
    const rows = week
      ? await prisma.binaryWeek.findMany({
          where: { weekKey: week, ...(q.capped === "1" ? { capped: { gt: 0 } } : {}), ...(q.q ? { user: { OR: [{ memberId: { contains: q.q, mode: "insensitive" } }, { fullName: { contains: q.q, mode: "insensitive" } }] } } : {}) },
          include: { user: { select: { memberId: true, fullName: true } } },
          orderBy: { calculated: "desc" },
          take: 500,
        })
      : [];
    const totals = week ? await prisma.binaryWeek.aggregate({ where: { weekKey: week }, _sum: { calculated: true, payable: true, capped: true, matched: true }, _count: true }) : null;
    const cappedCount = week ? await prisma.binaryWeek.count({ where: { weekKey: week, capped: { gt: 0 } } }) : 0;
    res.json({ weeks: weekKeys, week: week ?? null, rows, totals, cappedCount });
  }),
);

adminCompRouter.get(
  "/compensation/ledger",
  FINANCE,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ q: z.string().trim().optional(), type: z.string().optional(), page: z.coerce.number().int().min(1).default(1) }), req.query);
    const where: Prisma.IncomeEntryWhereInput = {
      ...(q.type ? { type: q.type as Prisma.EnumIncomeTypeFilter["equals"] } : {}),
      ...(q.q ? { OR: [{ txId: { contains: q.q, mode: "insensitive" } }, { user: { memberId: { contains: q.q, mode: "insensitive" } } }, { activation: { receiptNo: { contains: q.q, mode: "insensitive" } } }] } : {}),
    };
    const [total, entries, byType] = await Promise.all([
      prisma.incomeEntry.count({ where }),
      prisma.incomeEntry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * 50, take: 50, include: { user: { select: { memberId: true, fullName: true } }, activation: { select: { receiptNo: true } } } }),
      prisma.incomeEntry.groupBy({ by: ["type"], _sum: { amount: true } }),
    ]);
    res.json({ total, entries, totals: Object.fromEntries(byType.map((b) => [b.type, money(b._sum.amount)])) });
  }),
);

// ----- Ranks -----
const rankSchema = z.object({
  name: z.string().trim().min(2).max(60), sortOrder: z.coerce.number().int(), leftVolume: z.coerce.number().min(0), rightVolume: z.coerce.number().min(0),
  reward: z.coerce.number().min(0), active: z.boolean().default(true),
});

adminCompRouter.get(
  "/ranks",
  FINANCE,
  asyncHandler(async (_req, res) => {
    const [ranks, achievements] = await Promise.all([
      prisma.rank.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { achievements: true } } } }),
      prisma.rankAchievement.findMany({ orderBy: { qualifiedAt: "desc" }, take: 300, include: { rank: { select: { name: true } }, user: { select: { memberId: true, fullName: true } } } }),
    ]);
    const warnings: string[] = [];
    for (let i = 1; i < ranks.length; i++) {
      if (Number(ranks[i].leftVolume) < Number(ranks[i - 1].leftVolume)) warnings.push(`${ranks[i].name} threshold is lower than ${ranks[i - 1].name} — confirm (spec §7).`);
    }
    res.json({ ranks, achievements, warnings });
  }),
);

adminCompRouter.post(
  "/ranks",
  SUPER,
  asyncHandler(async (req, res) => {
    const data = parse(rankSchema, req.body);
    const r = await prisma.rank.create({ data });
    await audit({ actorId: req.user!.id, action: "rank.create", entity: "Rank", entityId: r.id, after: data, ip: req.ip });
    res.status(201).json({ rank: r });
  }),
);

adminCompRouter.put(
  "/ranks/:id",
  SUPER,
  asyncHandler(async (req, res) => {
    const data = parse(rankSchema, req.body);
    const before = await prisma.rank.findUniqueOrThrow({ where: { id: req.params.id } });
    const r = await prisma.rank.update({ where: { id: before.id }, data });
    await audit({ actorId: req.user!.id, action: "rank.update", entity: "Rank", entityId: r.id, before, after: data, ip: req.ip });
    res.json({ rank: r });
  }),
);

adminCompRouter.post(
  "/rank-achievements/:id/review",
  FINANCE,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional(), password: z.string() }), req.body);
    await checkPassword(req);
    const a = await reviewRankReward(req.params.id, req.user!.id, body.approve, body.note);
    await audit({ actorId: req.user!.id, action: body.approve ? "rank.reward_approve" : "rank.reward_reject", entity: "RankAchievement", entityId: a.id, after: { reward: money(a.reward) }, reason: body.note, ip: req.ip });
    await prisma.notification.create({ data: { userId: a.userId, title: body.approve ? `${a.rank.name} reward credited` : `${a.rank.name} reward not approved`, body: body.approve ? `USD ${money(a.reward)} was added to your income balance.` : body.note ?? "Contact support for details." } });
    res.json({ ok: true });
  }),
);

// ----- Withdrawals (spec §13, §24) -----
adminCompRouter.get(
  "/withdrawals",
  FINANCE,
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "REJECTED"]).optional(), q: z.string().trim().optional() }), req.query);
    const withdrawals = await prisma.withdrawal.findMany({
      where: { status: q.status, ...(q.q ? { OR: [{ reference: { contains: q.q, mode: "insensitive" } }, { txHash: { contains: q.q, mode: "insensitive" } }, { user: { memberId: { contains: q.q, mode: "insensitive" } } }] } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { memberId: true, fullName: true, email: true, walletChangedAt: true } } },
    });
    const ids = [...new Set(withdrawals.map((w) => w.reviewedById).filter(Boolean) as string[])];
    const admins = Object.fromEntries((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })).map((a) => [a.id, a.fullName]));
    const totals = await prisma.withdrawal.groupBy({ by: ["status"], _sum: { amount: true, net: true }, _count: true });
    res.json({
      withdrawals: withdrawals.map((w) => ({ ...w, reviewedBy: w.reviewedById ? admins[w.reviewedById] : null })),
      totals: Object.fromEntries(totals.map((t) => [t.status, { count: t._count, amount: money(t._sum.amount), net: money(t._sum.net) }])),
    });
  }),
);

adminCompRouter.post(
  "/withdrawals/:id/review",
  FINANCE,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("processing") }),
        z.object({ action: z.literal("complete"), txHash: z.string().trim(), confirmPaid: z.literal(true, { message: "Confirm the USDT transfer has actually been sent" }), password: z.string() }),
        z.object({ action: z.literal("reject"), reason: z.string().trim().min(5).max(500), password: z.string() }),
      ]),
      req.body,
    );
    if (body.action !== "processing") await checkPassword(req);
    const w = await reviewWithdrawal(req.params.id, req.user!.id, body.action, { txHash: body.action === "complete" ? body.txHash : undefined, reason: body.action === "reject" ? body.reason : undefined });
    await audit({
      actorId: req.user!.id, action: `withdrawal.${body.action}`, entity: "Withdrawal", entityId: w.id, before: { status: w.status },
      after: { status: body.action === "complete" ? "COMPLETED" : body.action === "reject" ? "REJECTED" : "PROCESSING", txHash: body.action === "complete" ? body.txHash : undefined, amount: money(w.amount), address: w.address },
      reason: body.action === "reject" ? body.reason : null, ip: req.ip,
    });
    if (body.action !== "processing") {
      const u = await prisma.user.findUniqueOrThrow({ where: { id: w.userId } });
      const msg = body.action === "complete"
        ? `Withdrawal ${w.reference} is completed: ${money(w.net)} USDT sent to ${w.address}. Transaction hash: ${body.txHash}`
        : `Withdrawal ${w.reference} was rejected: ${body.reason}. USD ${money(w.amount)} was returned to your available balance.`;
      await prisma.notification.create({ data: { userId: u.id, title: body.action === "complete" ? "Withdrawal completed" : "Withdrawal rejected", body: msg } });
      await sendMail(u.email, `World Vista — withdrawal ${w.reference}`, msg);
    }
    res.json({ ok: true });
  }),
);

adminCompRouter.get(
  "/compensation/summary",
  FINANCE,
  asyncHandler(async (_req, res) => {
    const [income, pending, s, pendingRanks] = await Promise.all([
      prisma.incomeEntry.aggregate({ _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true }, _count: true }),
      getSettings(),
      prisma.rankAchievement.count({ where: { rewardStatus: "PENDING_REVIEW" } }),
    ]);
    res.json({
      engineEnabled: s.enabled,
      // Owed to members = available balances (ledger sum, holds already deducted) + amounts reserved for open withdrawals
      incomeLiability: money(Number(income._sum.amount ?? 0) + Number(pending._sum.amount ?? 0)),
      availableBalances: money(income._sum.amount),
      pendingWithdrawals: { count: pending._count, amount: money(pending._sum.amount) },
      pendingRankRewards: pendingRanks,
    });
  }),
);
