import type { Prisma, Side } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Finds the binary placement slot for a new member.
 *
 * DEFAULT RULE (pending owner confirmation, spec §10): the new member is placed
 * on the sponsor's chosen side; if that slot is taken we follow the outermost
 * leg on that side until an empty slot is found ("extreme left / extreme right"
 * spillover). Because new members are always leaves, cycles are impossible.
 */
export async function findPlacement(tx: Tx, sponsorId: string, side: Side) {
  let parentId = sponsorId;
  for (let depth = 0; depth < 10000; depth++) {
    const child = await tx.user.findFirst({
      where: { placementParentId: parentId, placementSide: side },
      select: { id: true },
    });
    if (!child) return { placementParentId: parentId, placementSide: side };
    parentId = child.id;
  }
  throw new Error("Placement depth exceeded");
}

export type TreeNode = {
  id: string;
  memberId: string;
  fullName: string;
  status: string;
  side: Side | null;
  joinedAt: Date;
  left?: TreeNode | null;
  right?: TreeNode | null;
};

/** Loads a binary subtree to a limited depth (for expandable UI views). */
export async function loadBinaryTree(tx: Tx, rootId: string, depth = 3): Promise<TreeNode | null> {
  const root = await tx.user.findUnique({
    where: { id: rootId },
    select: { id: true, memberId: true, fullName: true, status: true, placementSide: true, createdAt: true },
  });
  if (!root) return null;
  const build = async (u: typeof root, d: number): Promise<TreeNode> => {
    const node: TreeNode = {
      id: u.id,
      memberId: u.memberId,
      fullName: u.fullName,
      status: u.status,
      side: u.placementSide,
      joinedAt: u.createdAt,
    };
    if (d > 0) {
      const kids = await tx.user.findMany({
        where: { placementParentId: u.id },
        select: { id: true, memberId: true, fullName: true, status: true, placementSide: true, createdAt: true },
      });
      const l = kids.find((k) => k.placementSide === "LEFT");
      const r = kids.find((k) => k.placementSide === "RIGHT");
      node.left = l ? await build(l, d - 1) : null;
      node.right = r ? await build(r, d - 1) : null;
    }
    return node;
  };
  return build(root, depth);
}

/** Counts members in each leg of the binary tree using a recursive CTE. */
export async function legCounts(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ side: Side; count: bigint }[]>`
    WITH RECURSIVE leg AS (
      SELECT id, "placementSide" AS root_side FROM "User" WHERE "placementParentId" = ${userId}
      UNION ALL
      SELECT u.id, leg.root_side FROM "User" u JOIN leg ON u."placementParentId" = leg.id
    )
    SELECT root_side AS side, COUNT(*)::bigint AS count FROM leg GROUP BY root_side`;
  const out = { LEFT: 0, RIGHT: 0 };
  for (const r of rows) out[r.side] = Number(r.count);
  return out;
}

/** True if candidateId is anywhere in userId's binary or sponsor downline. */
export async function isInDownline(tx: Tx, userId: string, candidateId: string) {
  const rows = await tx.$queryRaw<{ found: boolean }[]>`
    WITH RECURSIVE down AS (
      SELECT id FROM "User" WHERE "placementParentId" = ${userId} OR "sponsorId" = ${userId}
      UNION
      SELECT u.id FROM "User" u JOIN down ON u."placementParentId" = down.id OR u."sponsorId" = down.id
    )
    SELECT EXISTS (SELECT 1 FROM down WHERE id = ${candidateId}) AS found`;
  return rows[0]?.found ?? false;
}

/** "Priya Sharma" -> "Priya S." — members see masked names of other members. */
export function maskName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

const nodeSelect = { id: true, memberId: true, fullName: true, status: true, placementSide: true, createdAt: true } as const;

/** Binary subtree with `more` flags on leaf nodes so the UI can lazy-expand. */
export async function loadBinaryTreeLazy(tx: Tx, rootId: string, depth: number, mask: boolean) {
  const tree = await loadBinaryTree(tx, rootId, depth);
  if (!tree) return null;
  const leaves: TreeNode[] = [];
  const walk = (n: TreeNode | null | undefined, d: number) => {
    if (!n) return;
    if (mask && d > 0) n.fullName = maskName(n.fullName);
    if (n.left === undefined && n.right === undefined) leaves.push(n);
    walk(n.left, d + 1);
    walk(n.right, d + 1);
  };
  walk(tree, 0);
  if (leaves.length) {
    const kids = await tx.user.groupBy({ by: ["placementParentId"], where: { placementParentId: { in: leaves.map((l) => l.id) } }, _count: true });
    const has = new Set(kids.map((k) => k.placementParentId));
    for (const l of leaves) (l as TreeNode & { more?: boolean }).more = has.has(l.id);
  }
  return tree;
}

/** Direct sponsor children (sponsor tree), with their own referral counts for lazy expand. */
export async function sponsorChildren(tx: Tx, userId: string, mask: boolean) {
  const kids = await tx.user.findMany({ where: { sponsorId: userId }, select: { ...nodeSelect, _count: { select: { referrals: true } } }, orderBy: { createdAt: "asc" } });
  return kids.map((k) => ({
    id: k.id, memberId: k.memberId, fullName: mask ? maskName(k.fullName) : k.fullName, status: k.status,
    side: k.placementSide, joinedAt: k.createdAt, referrals: k._count.referrals,
  }));
}

/** Search a member's combined (sponsor + placement) downline by member ID or name. */
export async function searchDownline(tx: Tx, rootId: string | null, q: string, limit = 20) {
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  if (rootId === null) {
    return tx.user.findMany({
      where: { OR: [{ memberId: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      select: nodeSelect, take: limit, orderBy: { createdAt: "asc" },
    });
  }
  return tx.$queryRaw<{ id: string; memberId: string; fullName: string; status: string; placementSide: Side | null; createdAt: Date }[]>`
    WITH RECURSIVE down AS (
      SELECT id FROM "User" WHERE "placementParentId" = ${rootId} OR "sponsorId" = ${rootId}
      UNION
      SELECT u.id FROM "User" u JOIN down ON u."placementParentId" = down.id OR u."sponsorId" = down.id
    )
    SELECT u.id, u."memberId", u."fullName", u.status::text AS status, u."placementSide", u."createdAt"
    FROM "User" u JOIN down ON down.id = u.id
    WHERE u."memberId" ILIKE ${like} OR u."fullName" ILIKE ${like}
    ORDER BY u."createdAt" LIMIT ${limit}`;
}

/** Placement path from `rootId` down to `targetId` (inclusive), or null if not below root. */
export async function placementPath(tx: Tx, rootId: string, targetId: string) {
  const path: { memberId: string; side: Side | null }[] = [];
  let cur: string | null = targetId;
  for (let i = 0; cur && i < 10000; i++) {
    const u: { id: string; memberId: string; placementSide: Side | null; placementParentId: string | null } | null = await tx.user.findUnique({
      where: { id: cur }, select: { id: true, memberId: true, placementSide: true, placementParentId: true },
    });
    if (!u) return null;
    path.unshift({ memberId: u.memberId, side: u.placementSide });
    if (u.id === rootId) return path;
    cur = u.placementParentId;
  }
  return null;
}

/** True if candidateId is inside userId's binary placement subtree (or is userId). */
export async function inPlacementSubtree(tx: Tx, userId: string, candidateId: string) {
  if (userId === candidateId) return true;
  const rows = await tx.$queryRaw<{ found: boolean }[]>`
    WITH RECURSIVE down AS (
      SELECT id FROM "User" WHERE "placementParentId" = ${userId}
      UNION ALL
      SELECT u.id FROM "User" u JOIN down ON u."placementParentId" = down.id
    )
    SELECT EXISTS (SELECT 1 FROM down WHERE id = ${candidateId}) AS found`;
  return rows[0]?.found ?? false;
}
