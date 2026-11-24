import crypto from "crypto";
import { Prisma, type IncomeType, type Side } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";

/**
 * Commission engine (requirements v1.1 §4, §5, §7, §15, §16).
 *
 * - Qualifying event: a PackageActivation (tour or course) becoming ACTIVE.
 *   Commission base = package price excluding service charges (configurable).
 * - Direct: sponsor receives directRate% of the base, immediately.
 * - Binary: base is posted as business volume to every placement upline on the
 *   buyer's leg. Weeks close at the configured boundary; matched (weaker-leg)
 *   volume × binaryRate, capped at weeklyCap. Excess over the cap is forfeited.
 * - Ranks: lifetime left/right volume thresholds → reward awaiting admin review.
 * - Cancellations create linked reversal entries; nothing is deleted.
 *
 * Shareholder packages and 15-level income are NOT implemented (spec §10, §22).
 */

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;
const ZERO = new D(0);

export type CompSettings = {
  enabled: boolean;
  approvedById: string | null;
  approvedAt: string | null;
  directRate: number;
  binaryRate: number;
  weeklyCap: number;
  /** WEAKER_LEG = matched volume = min(left, right) */
  binaryBasis: "WEAKER_LEG";
  /** Carry unmatched (stronger-leg) volume into next week */
  carryForwardVolume: boolean;
  /** Fixed per spec: excess commission above the weekly cap is NOT carried forward */
  capExcessCarryForward: false;
  /** 0 = Sunday … 1 = Monday */
  weekStartDay: number;
  /** Minutes east of UTC; 330 = IST (Asia/Kolkata) */
  tzOffsetMinutes: number;
  timezoneLabel: string;
  commissionBase: "PRICE_EXCL_SERVICE" | "TOTAL_INCL_SERVICE";
  autoCloseWeeks: boolean;
  withdrawal: { feePct: number; min: number; max: number; holdHours: number; enabled: boolean };
};

export const DEFAULT_SETTINGS: CompSettings = {
  enabled: false,
  approvedById: null,
  approvedAt: null,
  directRate: 10,
  binaryRate: 10,
  weeklyCap: 1500,
  binaryBasis: "WEAKER_LEG",
  carryForwardVolume: true,
  capExcessCarryForward: false,
  weekStartDay: 1,
  tzOffsetMinutes: 330,
  timezoneLabel: "Asia/Kolkata (IST)",
  commissionBase: "PRICE_EXCL_SERVICE",
  autoCloseWeeks: true,
  withdrawal: { feePct: 5, min: 10, max: 10000, holdHours: 48, enabled: true },
};

const SETTINGS_KEY = "compensation";
const CLOSED_KEY = "binaryClosedWeeks";

export async function getSettings(tx: Tx = prisma): Promise<CompSettings> {
  const row = await tx.setting.findUnique({ where: { key: SETTINGS_KEY } });
  const v = (row?.value ?? {}) as Partial<CompSettings>;
  return { ...DEFAULT_SETTINGS, ...v, withdrawal: { ...DEFAULT_SETTINGS.withdrawal, ...(v.withdrawal ?? {}) }, capExcessCarryForward: false, binaryBasis: "WEAKER_LEG" };
}

export async function saveSettings(s: CompSettings) {
  await prisma.setting.upsert({ where: { key: SETTINGS_KEY }, update: { value: s as unknown as Prisma.InputJsonValue }, create: { key: SETTINGS_KEY, value: s as unknown as Prisma.InputJsonValue } });
}

// ---------------- Week boundary ----------------

/** Week key = local start date of the week (YYYY-MM-DD) in the configured timezone. */
export function weekKeyFor(date: Date, s: CompSettings) {
  const local = new Date(date.getTime() + s.tzOffsetMinutes * 60e3);
  const diff = (local.getUTCDay() - s.weekStartDay + 7) % 7;
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diff));
  return start.toISOString().slice(0, 10);
}

/** UTC instants for [start, end) of a week key. */
export function weekRange(key: string, s: CompSettings) {
  const startLocal = new Date(`${key}T00:00:00.000Z`).getTime();
  const start = new Date(startLocal - s.tzOffsetMinutes * 60e3);
  return { start, end: new Date(start.getTime() + 7 * 864e5) };
}

export function previousWeekKey(key: string) {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() - 7 * 864e5).toISOString().slice(0, 10);
}

// ---------------- Income ledger ----------------

const txId = () => "INC-" + crypto.randomBytes(6).toString("hex").toUpperCase();

async function lock(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

export async function incomeBalance(tx: Tx, userId: string) {
  return (await tx.incomeEntry.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount ?? ZERO;
}

async function append(
  tx: Tx,
  e: {
    userId: string; type: IncomeType; amount: Prisma.Decimal; idemKey?: string; activationId?: string; weekKey?: string; withdrawalId?: string;
    achievementId?: string; reversesId?: string; calc?: object; memo?: string; actorId?: string | null; allowNegative?: boolean;
  },
) {
  if (e.idemKey) {
    const dup = await tx.incomeEntry.findUnique({ where: { idemKey: e.idemKey } });
    if (dup) return dup; // duplicate-payout guard
  }
  await lock(tx, e.userId);
  const after = (await incomeBalance(tx, e.userId)).add(e.amount);
  if (after.isNegative() && !e.allowNegative) throw new HttpError(400, "Insufficient available balance");
  return tx.incomeEntry.create({
    data: {
      txId: txId(), userId: e.userId, type: e.type, amount: e.amount.toDecimalPlaces(2), balanceAfter: after.toDecimalPlaces(2),
      idemKey: e.idemKey, activationId: e.activationId, weekKey: e.weekKey, withdrawalId: e.withdrawalId, achievementId: e.achievementId,
      reversesId: e.reversesId, calc: e.calc as Prisma.InputJsonValue | undefined, memo: e.memo ?? "", actorId: e.actorId ?? null,
    },
  });
}

// ---------------- Sale → volume + direct commission ----------------

function baseOf(a: { unitPrice: Prisma.Decimal; serviceCharge: Prisma.Decimal; travellers: number; total: Prisma.Decimal }, s: CompSettings) {
  return s.commissionBase === "TOTAL_INCL_SERVICE" ? new D(a.total) : new D(a.unitPrice).mul(a.travellers);
}

/** Idempotent. Call when an activation becomes ACTIVE (or on backfill). */
export async function processActivation(activationId: string) {
  const s = await getSettings();
  if (!s.enabled) return { skipped: "engine disabled" };
  const a = await prisma.packageActivation.findUnique({ where: { id: activationId }, include: { user: { include: { sponsor: true } } } });
  if (!a || a.status !== "ACTIVE") return { skipped: "not active" };
  const base = baseOf(a, s);
  const when = a.reviewedAt ?? a.createdAt;
  const weekKey = weekKeyFor(when > new Date() ? new Date() : when, s);
  const closed = await closedWeeks();
  // A sale activated after its week was closed counts in the current week.
  const effectiveWeek = closed.has(weekKey) ? weekKeyFor(new Date(), s) : weekKey;
  const beneficiaries: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Volume: walk the placement chain upward
    let child: { id: string; placementParentId: string | null; placementSide: Side | null } | null = a.user;
    let depth = 1;
    const rows: Prisma.VolumeEntryCreateManyInput[] = [];
    while (child?.placementParentId && child.placementSide && depth < 100000) {
      rows.push({ beneficiaryId: child.placementParentId, leg: child.placementSide, amount: base, weekKey: effectiveWeek, activationId: a.id, sourceUserId: a.userId, depth });
      beneficiaries.push(child.placementParentId);
      child = await tx.user.findUnique({ where: { id: child.placementParentId }, select: { id: true, placementParentId: true, placementSide: true } });
      depth++;
    }
    if (rows.length) await tx.volumeEntry.createMany({ data: rows, skipDuplicates: true });

    // Direct sponsor commission
    const sp = a.user.sponsor;
    if (sp && sp.role === "MEMBER") {
      const eligible = sp.status === "ACTIVE";
      const amount = eligible ? base.mul(s.directRate).div(100).toDecimalPlaces(2) : ZERO;
      if (eligible && amount.greaterThan(0)) {
        await append(tx, {
          userId: sp.id, type: "DIRECT", amount, idemKey: `DIRECT:${a.id}`, activationId: a.id,
          calc: { rule: "direct", base: base.toFixed(2), rate: s.directRate, amount: amount.toFixed(2), buyer: a.user.memberId, receipt: a.receiptNo, basis: s.commissionBase },
          memo: `Direct commission: ${a.user.memberId} · ${a.itemName}`,
        });
      }
    }
  }, { timeout: 60000 });

  for (const b of beneficiaries) await checkRanks(b);
  return { base: base.toFixed(2), beneficiaries: beneficiaries.length };
}

/** Idempotent. Call when an ACTIVE activation is cancelled/refunded. */
export async function reverseActivation(activationId: string, actorId: string | null, reason: string) {
  const s = await getSettings();
  const current = weekKeyFor(new Date(), s);
  await prisma.$transaction(async (tx) => {
    const vols = await tx.volumeEntry.findMany({ where: { activationId, reversal: false } });
    if (vols.length) {
      await tx.volumeEntry.createMany({
        data: vols.map((v) => ({ beneficiaryId: v.beneficiaryId, leg: v.leg, amount: new D(v.amount).neg(), weekKey: current, activationId, sourceUserId: v.sourceUserId, depth: v.depth, reversal: true })),
        skipDuplicates: true,
      });
    }
    const direct = await tx.incomeEntry.findUnique({ where: { idemKey: `DIRECT:${activationId}` } });
    if (direct) {
      await append(tx, {
        userId: direct.userId, type: "REVERSAL", amount: new D(direct.amount).neg(), idemKey: `REV:DIRECT:${activationId}`, activationId, reversesId: direct.id,
        calc: { reverses: direct.txId, reason }, memo: `Reversal of direct commission ${direct.txId}: ${reason}`, actorId, allowNegative: true,
      });
    }
  });
}

// ---------------- Weekly binary close ----------------

async function closedWeeks() {
  const row = await prisma.setting.findUnique({ where: { key: CLOSED_KEY } });
  return new Set<string>((row?.value as string[] | undefined) ?? []);
}

/** Closes every past week that has volume and is not yet closed, oldest first. */
export async function closeDueWeeks(actorId: string | null = null) {
  const s = await getSettings();
  if (!s.enabled) return { closed: [] as string[] };
  const current = weekKeyFor(new Date(), s);
  const done = await closedWeeks();
  const weeks = (await prisma.volumeEntry.findMany({ where: { weekKey: { lt: current } }, distinct: ["weekKey"], select: { weekKey: true }, orderBy: { weekKey: "asc" } }))
    .map((w) => w.weekKey)
    .filter((w) => !done.has(w));
  for (const w of weeks) await closeWeek(w, s, actorId);
  return { closed: weeks };
}

async function carryIn(tx: Tx, userId: string, weekKey: string) {
  const prev = await tx.binaryWeek.findFirst({ where: { userId, weekKey: { lt: weekKey } }, orderBy: { weekKey: "desc" } });
  return { L: prev ? new D(prev.leftCarryOut) : ZERO, R: prev ? new D(prev.rightCarryOut) : ZERO };
}

async function weekVolumes(tx: Tx, userId: string, weekKey: string) {
  const g = await tx.volumeEntry.groupBy({ by: ["leg"], where: { beneficiaryId: userId, weekKey }, _sum: { amount: true } });
  const get = (leg: Side) => g.find((x) => x.leg === leg)?._sum.amount ?? ZERO;
  return { L: new D(get("LEFT")), R: new D(get("RIGHT")) };
}

/** Pure binary calculation for one member-week (also used for live previews). */
export function binaryCalc(cin: { L: Prisma.Decimal; R: Prisma.Decimal }, vol: { L: Prisma.Decimal; R: Prisma.Decimal }, s: CompSettings, eligible = true) {
  const L = D.max(ZERO, cin.L.add(vol.L));
  const R = D.max(ZERO, cin.R.add(vol.R));
  const matched = D.min(L, R);
  const calculated = matched.mul(s.binaryRate).div(100).toDecimalPlaces(2);
  const cap = new D(s.weeklyCap);
  const payable = eligible ? D.min(calculated, cap) : ZERO;
  const capped = eligible ? calculated.sub(payable) : ZERO;
  return {
    L, R, matched, calculated, payable, capped, cap,
    leftCarryOut: s.carryForwardVolume ? L.sub(matched) : ZERO,
    rightCarryOut: s.carryForwardVolume ? R.sub(matched) : ZERO,
  };
}

async function closeWeek(weekKey: string, s: CompSettings, actorId: string | null) {
  const members = (await prisma.volumeEntry.findMany({ where: { weekKey }, distinct: ["beneficiaryId"], select: { beneficiaryId: true } })).map((m) => m.beneficiaryId);
  for (const userId of members) {
    await prisma.$transaction(async (tx) => {
      if (await tx.binaryWeek.findUnique({ where: { userId_weekKey: { userId, weekKey } } })) return; // already closed
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, memberId: true } });
      const cin = await carryIn(tx, userId, weekKey);
      const vol = await weekVolumes(tx, userId, weekKey);
      const c = binaryCalc(cin, vol, s, u.status === "ACTIVE");
      await tx.binaryWeek.create({
        data: {
          userId, weekKey, leftCarryIn: cin.L, rightCarryIn: cin.R, leftVolume: vol.L, rightVolume: vol.R, matched: c.matched, rate: s.binaryRate,
          calculated: c.calculated, payable: c.payable, capped: c.capped, cap: c.cap, leftCarryOut: c.leftCarryOut, rightCarryOut: c.rightCarryOut,
          eligible: u.status === "ACTIVE", closedById: actorId,
        },
      });
      if (c.payable.greaterThan(0)) {
        await append(tx, {
          userId, type: "BINARY", amount: c.payable, idemKey: `BINARY:${userId}:${weekKey}`, weekKey,
          calc: {
            rule: "binary", basis: s.binaryBasis, week: weekKey, timezone: s.timezoneLabel,
            leftCarryIn: cin.L.toFixed(2), rightCarryIn: cin.R.toFixed(2), leftVolume: vol.L.toFixed(2), rightVolume: vol.R.toFixed(2),
            matched: c.matched.toFixed(2), rate: s.binaryRate, calculated: c.calculated.toFixed(2), cap: c.cap.toFixed(2),
            payable: c.payable.toFixed(2), cappedExcess: c.capped.toFixed(2), excessCarriedForward: false,
          },
          memo: `Binary commission · week of ${weekKey}${c.capped.greaterThan(0) ? ` (cap reached, ${c.capped.toFixed(2)} not payable)` : ""}`,
        });
      }
    });
  }
  const done = await closedWeeks();
  done.add(weekKey);
  await prisma.setting.upsert({ where: { key: CLOSED_KEY }, update: { value: [...done].sort() }, create: { key: CLOSED_KEY, value: [...done].sort() } });
}

/** Live (not yet credited) figures for the current week. */
export async function currentWeekPreview(userId: string) {
  const s = await getSettings();
  const weekKey = weekKeyFor(new Date(), s);
  const [cin, vol, u] = await Promise.all([carryIn(prisma, userId, weekKey), weekVolumes(prisma, userId, weekKey), prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true } })]);
  const c = binaryCalc(cin, vol, s, u.status === "ACTIVE");
  const { start, end } = weekRange(weekKey, s);
  return {
    weekKey, start, end, timezone: s.timezoneLabel,
    leftCarryIn: cin.L.toFixed(2), rightCarryIn: cin.R.toFixed(2), leftVolume: vol.L.toFixed(2), rightVolume: vol.R.toFixed(2),
    matched: c.matched.toFixed(2), calculated: c.calculated.toFixed(2), payable: c.payable.toFixed(2), capped: c.capped.toFixed(2),
    cap: c.cap.toFixed(2), capRemaining: D.max(ZERO, c.cap.sub(c.payable)).toFixed(2),
    leftCarryOut: c.leftCarryOut.toFixed(2), rightCarryOut: c.rightCarryOut.toFixed(2), rate: s.binaryRate,
  };
}

// ---------------- Ranks ----------------

export async function lifetimeVolume(tx: Tx, userId: string) {
  const g = await tx.volumeEntry.groupBy({ by: ["leg"], where: { beneficiaryId: userId }, _sum: { amount: true } });
  const get = (leg: Side) => new D(g.find((x) => x.leg === leg)?._sum.amount ?? 0);
  return { L: get("LEFT"), R: get("RIGHT") };
}

export async function checkRanks(userId: string) {
  const [ranks, vol, have] = await Promise.all([
    prisma.rank.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    lifetimeVolume(prisma, userId),
    prisma.rankAchievement.findMany({ where: { userId }, select: { rankId: true } }),
  ]);
  const got = new Set(have.map((h) => h.rankId));
  for (const r of ranks) {
    if (got.has(r.id)) continue;
    if (vol.L.greaterThanOrEqualTo(r.leftVolume) && vol.R.greaterThanOrEqualTo(r.rightVolume)) {
      await prisma.rankAchievement.create({ data: { userId, rankId: r.id, leftVolume: vol.L, rightVolume: vol.R, reward: r.reward } }).catch(() => undefined);
      await prisma.notification.create({ data: { userId, title: `Rank achieved: ${r.name}`, body: `Congratulations! Your ${r.name} rank reward is awaiting review.` } });
    }
  }
}

export async function reviewRankReward(achievementId: string, actorId: string, approve: boolean, note?: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.rankAchievement.findUnique({ where: { id: achievementId }, include: { rank: true } });
    if (!a) throw new HttpError(404, "Achievement not found");
    const upd = await tx.rankAchievement.updateMany({
      where: { id: a.id, rewardStatus: "PENDING_REVIEW" },
      data: { rewardStatus: approve ? "APPROVED" : "REJECTED", reviewedById: actorId, reviewedAt: new Date(), reviewNote: note },
    });
    if (upd.count !== 1) throw new HttpError(409, "This reward has already been reviewed");
    if (approve && new D(a.reward).greaterThan(0)) {
      await append(tx, {
        userId: a.userId, type: "RANK", amount: new D(a.reward), idemKey: `RANK:${a.id}`, achievementId: a.id, actorId,
        calc: { rule: "rank", rank: a.rank.name, leftVolume: a.leftVolume.toString(), rightVolume: a.rightVolume.toString(), reward: a.reward.toString() },
        memo: `Rank reward: ${a.rank.name}`,
      });
    }
    return a;
  });
}

// ---------------- Withdrawals ----------------

export const BEP20_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
export const TX_HASH = /^0x[a-fA-F0-9]{64}$/;

export async function incomeSummary(userId: string) {
  const [byType, pending, paid, user, s] = await Promise.all([
    prisma.incomeEntry.groupBy({ by: ["type"], where: { userId }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { userId, status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true }, _count: true }),
    prisma.withdrawal.aggregate({ where: { userId, status: "COMPLETED" }, _sum: { amount: true, net: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { walletAddress: true, walletChangedAt: true } }),
    getSettings(),
  ]);
  const t = (k: IncomeType) => new D(byType.find((b) => b.type === k)?._sum.amount ?? 0);
  const available = byType.reduce((acc, b) => acc.add(b._sum.amount ?? 0), ZERO);
  const holdUntil = user.walletChangedAt ? new Date(user.walletChangedAt.getTime() + s.withdrawal.holdHours * 3600e3) : null;
  return {
    available: available.toFixed(2),
    pendingWithdrawals: new D(pending._sum.amount ?? 0).toFixed(2),
    pendingCount: pending._count,
    paid: new D(paid._sum.amount ?? 0).toFixed(2),
    paidNet: new D(paid._sum.net ?? 0).toFixed(2),
    earned: { direct: t("DIRECT").toFixed(2), binary: t("BINARY").toFixed(2), rank: t("RANK").toFixed(2), level: "0.00", reversals: t("REVERSAL").toFixed(2) },
    totalEarned: t("DIRECT").add(t("BINARY")).add(t("RANK")).add(t("REVERSAL")).toFixed(2),
    walletAddress: user.walletAddress,
    securityHoldUntil: holdUntil && holdUntil > new Date() ? holdUntil : null,
    withdrawal: s.withdrawal,
  };
}

export async function requestWithdrawal(userId: string, amount: number, confirmAddress: string) {
  const s = await getSettings();
  if (!s.enabled || !s.withdrawal.enabled) throw new HttpError(403, "Withdrawals are not open yet");
  const amt = new D(amount).toDecimalPlaces(2);
  if (amt.lessThan(s.withdrawal.min) || amt.greaterThan(s.withdrawal.max)) throw new HttpError(400, `Amount must be between ${s.withdrawal.min} and ${s.withdrawal.max} USD`);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.status !== "ACTIVE") throw new HttpError(403, "Your account is not active");
  if (!u.walletAddress) throw new HttpError(400, "Add a USDT (BEP20) withdrawal address first");
  if (confirmAddress.toLowerCase() !== u.walletAddress.toLowerCase()) throw new HttpError(400, "Destination address confirmation does not match your saved address");
  if (u.walletChangedAt && u.walletChangedAt.getTime() + s.withdrawal.holdHours * 3600e3 > Date.now()) {
    throw new HttpError(403, `Security hold: withdrawals are paused for ${s.withdrawal.holdHours} hours after an address change`);
  }
  const fee = amt.mul(s.withdrawal.feePct).div(100).toDecimalPlaces(2);
  return prisma.$transaction(async (tx) => {
    await lock(tx, userId);
    const open = await tx.withdrawal.count({ where: { userId, status: { in: ["PENDING", "PROCESSING"] } } });
    if (open >= 3) throw new HttpError(429, "You already have 3 open withdrawal requests");
    const w = await tx.withdrawal.create({
      data: { reference: `WD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`, userId, amount: amt, fee, net: amt.sub(fee), address: u.walletAddress! },
    });
    // Reserve the balance (append refuses if insufficient → whole transaction rolls back)
    await append(tx, { userId, type: "WITHDRAWAL_HOLD", amount: amt.neg(), withdrawalId: w.id, idemKey: `WDHOLD:${w.id}`, memo: `Withdrawal ${w.reference} (pending)` });
    return w;
  });
}

export async function reviewWithdrawal(id: string, actorId: string, action: "processing" | "complete" | "reject", opts: { txHash?: string; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const w = await tx.withdrawal.findUnique({ where: { id } });
    if (!w) throw new HttpError(404, "Withdrawal not found");
    if (action === "processing") {
      const u = await tx.withdrawal.updateMany({ where: { id, status: "PENDING" }, data: { status: "PROCESSING", reviewedById: actorId, reviewedAt: new Date() } });
      if (u.count !== 1) throw new HttpError(409, "Only pending requests can move to processing");
    } else if (action === "complete") {
      if (!opts.txHash || !TX_HASH.test(opts.txHash)) throw new HttpError(400, "A valid BEP20 transaction hash (0x + 64 hex characters) is required");
      if (await tx.withdrawal.findUnique({ where: { txHash: opts.txHash } })) throw new HttpError(409, "This transaction hash is already recorded on another withdrawal");
      const u = await tx.withdrawal.updateMany({
        where: { id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "COMPLETED", txHash: opts.txHash, reviewedById: actorId, reviewedAt: new Date(), completedAt: new Date() },
      });
      if (u.count !== 1) throw new HttpError(409, "This request is already completed or rejected");
    } else {
      const u = await tx.withdrawal.updateMany({ where: { id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "REJECTED", rejectReason: opts.reason, reviewedById: actorId, reviewedAt: new Date() } });
      if (u.count !== 1) throw new HttpError(409, "This request is already completed or rejected");
      const hold = await tx.incomeEntry.findUnique({ where: { idemKey: `WDHOLD:${id}` } });
      await append(tx, { userId: w.userId, type: "WITHDRAWAL_RELEASE", amount: new D(w.amount), withdrawalId: id, reversesId: hold?.id, idemKey: `WDREL:${id}`, actorId, memo: `Withdrawal ${w.reference} rejected: ${opts.reason}` });
    }
    return w;
  });
}
