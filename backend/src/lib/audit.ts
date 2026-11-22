import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Appends a hash-chained audit entry. Each hash covers the previous hash plus
 * this entry's content, so any edit or deletion breaks the chain (see verifyAuditChain).
 * Writes are serialized with a Postgres advisory lock to keep the chain linear.
 */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    const last = await tx.auditLog.findFirst({ orderBy: { seq: "desc" } });
    const prevHash = last?.hash ?? "GENESIS";
    const createdAt = new Date();
    // Normalize to plain JSON (Dates -> ISO strings, Decimals -> strings) so what we hash equals what is stored.
    const before = normalize(entry.before);
    const after = normalize(entry.after);
    const body = {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before,
      after,
      reason: entry.reason ?? null,
      ip: entry.ip ?? null,
    };
    const hash = hashEntry(prevHash, body, createdAt);
    await tx.auditLog.create({
      data: {
        ...body,
        before: before === null ? Prisma.DbNull : (before as Prisma.InputJsonValue),
        after: after === null ? Prisma.DbNull : (after as Prisma.InputJsonValue),
        createdAt,
        prevHash,
        hash,
      },
    });
  });
}

function normalize(v: unknown): unknown {
  return v === undefined || v === null ? null : JSON.parse(JSON.stringify(v));
}

/** Deterministic JSON: object keys sorted recursively (Postgres JSONB does not preserve key order). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function hashEntry(prevHash: string, body: object, createdAt: Date) {
  return crypto
    .createHash("sha256")
    .update(prevHash + canonical(body) + createdAt.toISOString())
    .digest("hex");
}

export async function verifyAuditChain() {
  const rows = await prisma.auditLog.findMany({ orderBy: { seq: "asc" } });
  let prev = "GENESIS";
  for (const r of rows) {
    const body = {
      actorId: r.actorId,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before ?? null,
      after: r.after ?? null,
      reason: r.reason,
      ip: r.ip,
    };
    if (r.prevHash !== prev || hashEntry(prev, body, r.createdAt) !== r.hash) {
      return { valid: false, brokenAtSeq: r.seq, checked: rows.length };
    }
    prev = r.hash;
  }
  return { valid: true, checked: rows.length };
}
