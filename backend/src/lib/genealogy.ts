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
