"use client";
import clsx from "clsx";
import type { TreeNode } from "@/lib/types";

function Node({ node, onSelect, depth }: { node: TreeNode | null | undefined; onSelect?: (memberId: string) => void; depth: number }) {
  if (node === undefined) return null;
  if (node === null) {
    return <div className="mx-auto w-28 rounded-xl border border-dashed border-slate-300 px-2 py-3 text-center text-xs text-slate-400">Open slot</div>;
  }
  const hasKids = node.left !== undefined || node.right !== undefined;
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => onSelect?.(node.memberId)}
        className={clsx(
          "w-32 rounded-xl border px-2 py-2.5 text-center transition hover:shadow-card",
          depth === 0 ? "border-gold-500 bg-navy-900 text-white" : "border-slate-200 bg-white",
        )}
        title={`View ${node.memberId}'s tree`}
      >
        <div className={clsx("text-[11px] font-semibold", depth === 0 ? "text-gold-300" : "text-navy-700")}>{node.memberId}</div>
        <div className="truncate text-xs">{node.fullName}</div>
        <div className={clsx("mt-1 text-[10px]", node.status === "ACTIVE" ? "text-emerald-500" : "text-amber-500")}>{node.status.replace(/_/g, " ").toLowerCase()}</div>
      </button>
      {hasKids && (
        <div className="mt-4 grid w-full grid-cols-2 gap-3 border-t border-slate-200 pt-4">
          <div>
            <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Left</div>
            <Node node={node.left} onSelect={onSelect} depth={depth + 1} />
          </div>
          <div>
            <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Right</div>
            <Node node={node.right} onSelect={onSelect} depth={depth + 1} />
          </div>
        </div>
      )}
    </div>
  );
}

export function BinaryTree({ tree, onSelect }: { tree: TreeNode; onSelect?: (memberId: string) => void }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[640px]">
        <Node node={tree} onSelect={onSelect} depth={0} />
      </div>
    </div>
  );
}
