import crypto from "crypto";
import { prisma } from "./prisma";

/** Generates a unique member ID like WV482913. */
export async function generateMemberId(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const id = "WV" + crypto.randomInt(100000, 999999).toString();
    const exists = await prisma.user.findUnique({ where: { memberId: id } });
    if (!exists) return id;
  }
  throw new Error("Could not allocate member ID");
}

/** Human-friendly reference, e.g. ENQ-20261122-7K3F9Q */
export function reference(prefix: string): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = crypto.randomBytes(4).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 6);
  return `${prefix}-${d}-${r}`;
}
