"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { api, fmtDate } from "@/lib/api";
import { Alert, Badge, Spinner } from "@/components/ui";

/**
 * Genealogy chart (spec §28): binary placement tree + sponsor tree, with lazy
 * expand/collapse, search, zoom & pan, node summary, and a mobile-friendly
 * vertical layout. `base` is "/member/genealogy" or "/admin/genealogy".
 */

export type GNode = {
  id: string; memberId: string; fullName: string; status: string; side: "LEFT" | "RIGHT" | null; joinedAt: string;
  left?: GNode | null; right?: GNode | null; more?: boolean;
};
type SponsorKid = { id: string; memberId: string; fullName: string; status: string; side: string | null; joinedAt: string; referrals: number };
type Summary = {
  memberId: string; fullName: string; email?: string; mobile?: string | null; status: string; side: string | null; joinedAt: string; country: string | null;
  sponsorId: string | null; placementParentId: string | null; directReferrals: number; legs: { LEFT: number; RIGHT: number };
  packageStatus: string; activePackages: number; confirmedTrips: number; courses: number;
};

const statusDot = (s: string) => (s === "ACTIVE" ? "bg-emerald-400" : s === "SUSPENDED" ? "bg-red-400" : "bg-amber-400");

function NodeCard({ n, root, selected, onClick }: { n: GNode; root?: boolean; selected?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group relative w-36 rounded-2xl border px-3 py-2.5 text-center transition duration-300 hover:-translate-y-0.5",
        root ? "border-gold-400/70 bg-gradient-to-b from-gold-400/20 to-onyx-800 shadow-glow" : "border-white/10 bg-onyx-800 hover:border-gold-400/50",
        selected && "ring-2 ring-gold-400/70",
      )}
    >
      <span className={clsx("absolute right-2.5 top-2.5 h-2 w-2 rounded-full", statusDot(n.status))} title={n.status} />
      <div className="font-mono text-[11px] font-semibold tracking-wider text-gold-300">{n.memberId}</div>
      <div className="truncate text-xs text-white">{n.fullName}</div>
      {n.side && <div className="mt-1 text-[10px] uppercase tracking-widest text-white/35">{n.side === "LEFT" ? "Left leg" : "Right leg"}</div>}
    </button>
  );
}

function OpenSlot({ side }: { side: string }) {
  return <div className="w-36 rounded-2xl border border-dashed border-white/15 px-3 py-3 text-center text-[11px] text-white/30">Open {side} slot</div>;
}

export function GenealogyChart({ base, me, initialRoot, extraActions }: { base: string; me?: string; initialRoot?: string; extraActions?: (memberId: string) => ReactNode }) {
  const [view, setView] = useState<"binary" | "sponsor">("binary");
  const [layout, setLayout] = useState<"chart" | "list">("chart");
  const [root, setRoot] = useState<string>(initialRoot ?? "");
  const [tree, setTree] = useState<GNode | null>(null);
  const [legs, setLegs] = useState<{ LEFT: number; RIGHT: number } | null>(null);
  const [path, setPath] = useState<{ memberId: string; side: string | null }[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) setLayout("list");
  }, []);

  const load = useCallback(async (r: string) => {
    setLoading(true);
    setErr("");
    try {
      const d = await api<{ tree: GNode; legs: { LEFT: number; RIGHT: number }; path: { memberId: string; side: string | null }[] | null }>(
        `${base}/binary?depth=3${r ? `&root=${encodeURIComponent(r)}` : ""}`,
      );
      setTree(d.tree);
      setLegs(d.legs);
      setPath(d.path);
      setCollapsed(new Set());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(root); }, [root, load]);

  /** Lazy-load 2 more levels under a leaf and graft them into the tree. */
  const expand = async (memberId: string) => {
    try {
      const d = await api<{ tree: GNode }>(`${base}/binary?depth=2&root=${encodeURIComponent(memberId)}`);
      const graft = (n: GNode | null | undefined): GNode | null | undefined => {
        if (!n) return n;
        if (n.memberId === memberId) return { ...n, left: d.tree.left, right: d.tree.right, more: false };
        return { ...n, left: graft(n.left), right: graft(n.right) };
      };
      setTree((t) => (t ? (graft(t) as GNode) : t));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // ---------- zoom & pan ----------
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /** Fit the whole loaded tree into the frame (never upscale past 100%). */
  const fit = useCallback(() => {
    const f = frameRef.current, c = contentRef.current;
    if (!f || !c) return;
    const scale = Math.max(0.4, Math.min(1, (f.clientWidth - 24) / c.scrollWidth));
    setZ(scale);
    setPan({ x: (f.clientWidth - c.scrollWidth * scale) / 2, y: 0 });
  }, []);
  const resetView = fit;
  useEffect(() => { const t = setTimeout(fit, 30); return () => clearTimeout(t); }, [tree, collapsed, layout, view, fit]);

  // ---------- binary renderers ----------
  const renderChart = (n: GNode, depth: number): ReactNode => {
    const loaded = n.left !== undefined || n.right !== undefined;
    const isCollapsed = collapsed.has(n.id);
    return (
      <li key={n.id}>
        <div className="inline-flex flex-col items-center gap-1.5">
          <NodeCard n={n} root={depth === 0} selected={selected === n.memberId} onClick={() => setSelected(n.memberId)} />
          {loaded && (n.left || n.right) && (
            <button type="button" onClick={() => toggle(n.id)} className="rounded-full border border-white/10 px-2 text-[10px] text-white/50 hover:border-gold-400/50 hover:text-gold-300">
              {isCollapsed ? "＋ expand" : "－ collapse"}
            </button>
          )}
          {!loaded && n.more && (
            <button type="button" onClick={() => expand(n.memberId)} className="rounded-full border border-gold-400/40 px-2 text-[10px] text-gold-300 hover:bg-gold-400/10">＋ load team</button>
          )}
        </div>
        {loaded && !isCollapsed && (
          <ul>
            {n.left ? renderChart(n.left, depth + 1) : <li key="l"><OpenSlot side="left" /></li>}
            {n.right ? renderChart(n.right, depth + 1) : <li key="r"><OpenSlot side="right" /></li>}
          </ul>
        )}
      </li>
    );
  };

  const renderList = (n: GNode | null | undefined, label: string, depth: number): ReactNode => {
    if (n === undefined) return null;
    if (n === null) return <div className="py-1.5 pl-3 text-xs text-white/25">{label}: open slot</div>;
    const loaded = n.left !== undefined || n.right !== undefined;
    const isCollapsed = collapsed.has(n.id);
    return (
      <div className={clsx(depth > 0 && "ml-3 border-l border-gold-400/20 pl-3")}>
        <div className="flex items-center gap-2 py-1.5">
          {loaded && (n.left || n.right) ? (
            <button type="button" onClick={() => toggle(n.id)} className="grid h-5 w-5 place-items-center rounded-md border border-white/10 text-[10px] text-white/50">{isCollapsed ? "+" : "−"}</button>
          ) : !loaded && n.more ? (
            <button type="button" onClick={() => expand(n.memberId)} className="grid h-5 w-5 place-items-center rounded-md border border-gold-400/40 text-[10px] text-gold-300">+</button>
          ) : <span className="w-5" />}
          <button type="button" onClick={() => setSelected(n.memberId)} className={clsx("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/5", selected === n.memberId && "bg-gold-400/10")}>
            <span className={clsx("h-2 w-2 shrink-0 rounded-full", statusDot(n.status))} />
            {depth > 0 && <span className="text-[10px] uppercase tracking-wider text-white/35">{label}</span>}
            <span className="font-mono text-xs text-gold-300">{n.memberId}</span>
            <span className="truncate text-sm text-white/80">{n.fullName}</span>
          </button>
        </div>
        {loaded && !isCollapsed && (<>{renderList(n.left, "L", depth + 1)}{renderList(n.right, "R", depth + 1)}</>)}
      </div>
    );
  };

  // ---------- search ----------
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ memberId: string; fullName: string; status: string; side: string | null }[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      try { setResults((await api<{ results: typeof results }>(`${base}/search?q=${encodeURIComponent(q.trim())}`)).results); } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, base]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="lux-card min-w-0 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-white/10 p-1 text-xs">
            {(["binary", "sponsor"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={clsx("rounded-full px-3.5 py-1.5 font-semibold transition", view === v ? "bg-gold-grad text-onyx-950" : "text-white/60 hover:text-white")}>
                {v === "binary" ? "Binary placement" : "Sponsor tree"}
              </button>
            ))}
          </div>
          {view === "binary" && (
            <div className="flex rounded-full border border-white/10 p-1 text-xs">
              {(["chart", "list"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setLayout(v)} className={clsx("rounded-full px-3 py-1.5 transition", layout === v ? "bg-white/10 text-white" : "text-white/50 hover:text-white")}>
                  {v === "chart" ? "Chart" : "Vertical"}
                </button>
              ))}
            </div>
          )}
          <div className="relative ml-auto w-full sm:w-64">
            <input className="input !rounded-full !py-2 text-xs" placeholder="Search Member ID or name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search team" />
            {results && (
              <div className="absolute right-0 top-11 z-20 w-full overflow-hidden rounded-2xl border border-white/10 bg-onyx-850 shadow-2xl">
                {results.length ? results.map((r) => (
                  <button key={r.memberId} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5"
                    onClick={() => { setSelected(r.memberId); setView("binary"); setRoot(r.memberId); setQ(""); }}>
                    <span className={clsx("h-2 w-2 rounded-full", statusDot(r.status))} /><span className="font-mono text-gold-300">{r.memberId}</span><span className="truncate text-white/70">{r.fullName}</span>
                  </button>
                )) : <div className="px-3 py-3 text-xs text-white/40">No matches in this team.</div>}
              </div>
            )}
          </div>
        </div>

        {view === "binary" ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/50">
              {root && root !== initialRoot ? (
                <>
                  <button type="button" className="btn-outline btn-sm" onClick={() => setRoot(initialRoot ?? "")}>← {me ? "Back to me" : "Back to top"}</button>
                  {path && <span className="font-mono">{path.map((p) => p.memberId + (p.side ? ` (${p.side[0]})` : "")).join(" › ")}</span>}
                </>
              ) : <span>Showing 3 levels. Use “load team” on a member to go deeper.</span>}
              {legs && <span className="ml-auto flex gap-2"><span className="chip !px-3 !py-1 !tracking-[0.15em]">Left {legs.LEFT}</span><span className="chip !px-3 !py-1 !tracking-[0.15em]">Right {legs.RIGHT}</span></span>}
            </div>
            {err && <Alert>{err}</Alert>}
            {loading ? <Spinner /> : tree && (layout === "list" ? (
              <div className="max-h-[640px] overflow-auto rounded-2xl border border-white/[0.06] bg-onyx-950/40 p-3">{renderList(tree, "", 0)}</div>
            ) : (
              <div className="relative">
                <div className="absolute right-2 top-2 z-10 flex gap-1">
                  <button type="button" className="btn-outline btn-sm !px-2.5" onClick={() => setZ((v) => Math.min(2, v + 0.15))} aria-label="Zoom in">＋</button>
                  <button type="button" className="btn-outline btn-sm !px-2.5" onClick={() => setZ((v) => Math.max(0.4, v - 0.15))} aria-label="Zoom out">－</button>
                  <button type="button" className="btn-outline btn-sm" onClick={resetView}>Fit</button>
                </div>
                <div
                  ref={frameRef}
                  className="h-[560px] cursor-grab touch-none overflow-hidden rounded-2xl border border-white/[0.06] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:22px_22px] active:cursor-grabbing"
                  onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                  onPointerMove={(e) => { if (drag.current) setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }}
                  onPointerUp={() => { drag.current = null; }}
                  onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZ((v) => Math.min(2, Math.max(0.4, v - e.deltaY * 0.002))); } }}
                >
                  <div ref={contentRef} className="gtree w-max origin-top-left pt-10 transition-transform duration-200" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})` }}>
                    <ul>{renderChart(tree, 0)}</ul>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-white/35">Drag to pan · Ctrl/⌘ + scroll or the buttons to zoom · Click a member for details</p>
              </div>
            ))}
          </>
        ) : (
          <SponsorTree base={base} rootLabel={me ?? "Top"} selected={selected} onSelect={setSelected} />
        )}

        <div className="mt-5 flex flex-wrap gap-4 border-t border-white/[0.06] pt-4 text-[11px] text-white/45">
          <span><b className="text-white/70">Sponsor tree</b>: who referred whom (direct referrals).</span>
          <span><b className="text-white/70">Binary placement</b>: left/right position in the team structure.</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400" />Active</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" />Pending verification</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-400" />Suspended</span>
        </div>
      </section>

      <NodePanel base={base} memberId={selected} onFocus={(m) => { setView("binary"); setRoot(m); }} extraActions={extraActions} />
    </div>
  );
}

function SponsorTree({ base, rootLabel, selected, onSelect }: { base: string; rootLabel: string; selected: string | null; onSelect: (m: string) => void }) {
  const [kids, setKids] = useState<Record<string, SponsorKid[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set(["__root"]));
  const [err, setErr] = useState("");
  const fetchKids = useCallback(async (key: string, memberId?: string) => {
    try {
      const d = await api<{ children: SponsorKid[] }>(`${base}/sponsor${memberId ? `?root=${encodeURIComponent(memberId)}` : ""}`);
      setKids((k) => ({ ...k, [key]: d.children }));
    } catch (e) { setErr((e as Error).message); }
  }, [base]);
  useEffect(() => { fetchKids("__root"); }, [fetchKids]);

  const render = (key: string, depth: number): ReactNode => {
    const list = kids[key];
    if (!list) return <div className="py-2 pl-3 text-xs text-white/35">Loading…</div>;
    if (!list.length) return <div className="py-2 pl-3 text-xs text-white/30">No direct referrals.</div>;
    return list.map((k) => (
      <div key={k.id} className={clsx(depth > 0 && "ml-3 border-l border-gold-400/20 pl-3")}>
        <div className="flex items-center gap-2 py-1.5">
          {k.referrals > 0 ? (
            <button type="button" className="grid h-5 w-5 place-items-center rounded-md border border-gold-400/40 text-[10px] text-gold-300"
              onClick={() => { const n = new Set(open); if (n.has(k.id)) n.delete(k.id); else { n.add(k.id); if (!kids[k.id]) fetchKids(k.id, k.memberId); } setOpen(n); }}>
              {open.has(k.id) ? "−" : "+"}
            </button>
          ) : <span className="w-5" />}
          <button type="button" onClick={() => onSelect(k.memberId)} className={clsx("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/5", selected === k.memberId && "bg-gold-400/10")}>
            <span className={clsx("h-2 w-2 shrink-0 rounded-full", statusDot(k.status))} />
            <span className="font-mono text-xs text-gold-300">{k.memberId}</span>
            <span className="truncate text-sm text-white/80">{k.fullName}</span>
            <span className="ml-auto shrink-0 text-[10px] text-white/35">{k.side ? `${k.side.toLowerCase()} leg · ` : ""}{k.referrals} referral{k.referrals === 1 ? "" : "s"}</span>
          </button>
        </div>
        {open.has(k.id) && render(k.id, depth + 1)}
      </div>
    ));
  };
  return (
    <div className="max-h-[640px] overflow-auto rounded-2xl border border-white/[0.06] bg-onyx-950/40 p-3">
      {err && <Alert>{err}</Alert>}
      <div className="mb-2 flex items-center gap-2 px-2 text-xs text-white/50"><span className="chip !px-3 !py-1">{rootLabel}</span> direct referrals and their referrals</div>
      {render("__root", 0)}
    </div>
  );
}

function NodePanel({ base, memberId, onFocus, extraActions }: { base: string; memberId: string | null; onFocus: (m: string) => void; extraActions?: (m: string) => ReactNode }) {
  const [d, setD] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!memberId) { setD(null); return; }
    setErr("");
    api<{ node: Summary }>(`${base}/node/${encodeURIComponent(memberId)}`).then((r) => setD(r.node)).catch((e) => setErr((e as Error).message));
  }, [memberId, base]);

  const Row = ({ k, v }: { k: string; v: ReactNode }) => (
    <div className="flex justify-between gap-3 border-b border-white/[0.06] py-2 text-sm last:border-0"><span className="text-white/45">{k}</span><span className="text-right text-white/85">{v}</span></div>
  );
  return (
    <aside className="lux-card-gold h-fit p-5 xl:sticky xl:top-8">
      <div className="sec-no mb-3"><span>Member summary</span></div>
      {!memberId ? <p className="text-sm text-white/45">Select a member in the chart to see their details.</p> : err ? <Alert>{err}</Alert> : !d ? <Spinner /> : (
        <>
          <div className="font-mono text-lg tracking-wider text-gold-300">{d.memberId}</div>
          <div className="font-serif text-2xl text-white">{d.fullName}</div>
          <div className="mt-2"><Badge value={d.status} /></div>
          <div className="mt-4">
            {d.email && <Row k="Email" v={d.email} />}
            {d.mobile && <Row k="Mobile" v={d.mobile} />}
            <Row k="Sponsor ID" v={d.sponsorId ?? "—"} />
            <Row k="Placed under" v={d.placementParentId ? `${d.placementParentId} (${d.side?.toLowerCase()})` : "—"} />
            <Row k="Joined" v={fmtDate(d.joinedAt)} />
            {d.country && <Row k="Country" v={d.country} />}
            <Row k="Package status" v={d.packageStatus} />
            <Row k="Trips / courses" v={`${d.confirmedTrips} / ${d.courses}`} />
            <Row k="Direct referrals" v={d.directReferrals} />
            <Row k="Team left / right" v={`${d.legs.LEFT} / ${d.legs.RIGHT}`} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-lux !px-4 !py-2 text-xs" onClick={() => onFocus(d.memberId)}>View as top of tree</button>
            {extraActions?.(d.memberId)}
          </div>
        </>
      )}
    </aside>
  );
}
