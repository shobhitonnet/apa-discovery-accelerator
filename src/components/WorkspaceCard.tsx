"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_PILLS: Record<string, { bg: string; color: string; label: string }> = {
  created:   { bg: "rgba(26,90,255,0.10)",  color: "#1A5AFF", label: "Created" },
  uploading: { bg: "rgba(255,172,9,0.12)",  color: "#B07800", label: "Uploading" },
  analyzing: { bg: "rgba(38,188,113,0.12)", color: "#1F8F5A", label: "Analyzing" },
  completed: { bg: "rgba(46,204,113,0.15)", color: "#1F8F5A", label: "Completed" },
};

export type WorkspaceCardProps = {
  id: string;
  clientName: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  country?: string | null;
  caseCount: number;
  eventCount: number;
  variantCount: number;
  avgCycleDays: number | null;
  leakUsd: number;
  processCount: number;
  hasProcessMap: boolean;
  hasDataRequest: boolean;
  hasFindings: boolean;
};

export function WorkspaceCard(props: WorkspaceCardProps) {
  const router = useRouter();
  const pill = STATUS_PILLS[props.status] ?? STATUS_PILLS.created;
  const empty = props.eventCount === 0;
  const [deleting, setDeleting] = useState(false);

  const cycleLabel = props.avgCycleDays !== null
    ? props.avgCycleDays >= 1
      ? `${props.avgCycleDays.toFixed(1)}d`
      : `${(props.avgCycleDays * 24).toFixed(1)}h`
    : "—";

  const leakLabel = props.leakUsd > 0
    ? props.leakUsd >= 1_000_000
      ? `$${(props.leakUsd / 1_000_000).toFixed(1)}M`
      : `$${Math.round(props.leakUsd / 1000)}K`
    : "—";

  const updatedAgo = ((): string => {
    const ms = Date.now() - new Date(props.updatedAt).getTime();
    const h = ms / 3600_000;
    if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
    if (h < 24) return `${Math.round(h)}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  })();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${props.name}"?\n\nThis removes the engagement and all processes, uploads, and events. Cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/engagements/${props.id}`, { method: "DELETE" });
    if (!res.ok) { setDeleting(false); alert("Delete failed."); return; }
    router.refresh();
  }

  return (
    <div
      onClick={() => router.push(`/engagements/${props.id}`)}
      style={{
        background: "#fff",
        border: "1px solid #DDE3EC",
        borderRadius: 12,
        padding: 20,
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
        opacity: deleting ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#1A5AFF";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(9,28,53,0.06)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#DDE3EC";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ minWidth: 0, paddingRight: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#091C35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.clientName}</div>
          <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.name}{props.country ? ` · ${props.country}` : ""}</div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.06em", textTransform: "uppercase", background: pill.bg, color: pill.color, flexShrink: 0 }}>
          {pill.label}
        </span>
      </div>

      {/* Mini variant graph thumbnail */}
      <div style={{ background: "#FAFBFC", border: "1px solid #EEF2F8", borderRadius: 8, height: 80, marginBottom: 14, padding: 8, position: "relative" }}>
        <MiniGraph seed={props.id} variantCount={props.variantCount} hasFindings={props.hasFindings} empty={empty} hasProcessMap={props.hasProcessMap} />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <Stat v={empty ? "—" : props.caseCount.toLocaleString()} l="Cases" />
        <Stat v={empty ? "—" : cycleLabel} l="Cycle" />
        <Stat v={empty ? "—" : leakLabel} l="Leak" />
        <Stat v={empty ? "—" : props.variantCount.toString()} l="Variants" />
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #EEF2F8", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "#9AAABB" }}>
        <div style={{ display: "flex", gap: 14 }}>
          <span>{props.processCount} {props.processCount === 1 ? "process" : "processes"}</span>
          <span>{empty ? "Process map pending" : `${props.eventCount.toLocaleString()} events`}</span>
        </div>
        <button
          onClick={handleDelete}
          style={{ background: "none", border: "none", color: "#9AAABB", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}
          title="Delete engagement"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EF4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#9AAABB"; }}
        >
          {updatedAgo}
        </button>
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#091C35", fontFeatureSettings: '"tnum"' }}>{v}</div>
      <div style={{ fontSize: 9, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{l}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mini variant graph — deterministic seeded SVG per engagement
// ──────────────────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function MiniGraph({ seed, variantCount, hasFindings, empty, hasProcessMap }: { seed: string; variantCount: number; hasFindings: boolean; empty: boolean; hasProcessMap: boolean }) {
  if (empty) {
    if (!hasProcessMap) {
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9AAABB", fontSize: 10, fontStyle: "italic" }}>
          Process map pending
        </div>
      );
    }
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9AAABB", fontSize: 10, fontStyle: "italic" }}>
        Awaiting data ingestion
      </div>
    );
  }

  // Deterministic layout from seed
  const h = hashString(seed);
  const rng = mulberry32(h);
  const columns = 6;
  const width = 400;
  const height = 64;
  const padX = 20;
  const padY = 14;
  const colWidth = (width - padX * 2) / (columns - 1);
  const numLevels = Math.min(3, Math.max(1, Math.floor(variantCount / 8))); // visual richness scaler

  // Build a stylised lattice. Each column has 1–3 nodes; edges connect adjacent columns.
  const nodes: Array<{ x: number; y: number; r: number; deviation: boolean }> = [];
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number; thick: boolean; deviation: boolean }> = [];

  const colNodes: Array<Array<number>> = [];
  for (let c = 0; c < columns; c++) {
    const x = padX + c * colWidth;
    const lanes = c === 0 || c === columns - 1 ? 1 : 1 + Math.floor(rng() * (numLevels + 1));
    const idx: number[] = [];
    for (let l = 0; l < lanes; l++) {
      const span = height - padY * 2;
      const y = lanes === 1
        ? height / 2
        : padY + (l / (lanes - 1)) * span;
      const r = c === 0 || c === columns - 1 ? 4 : (l === 0 ? 5 : 3.5);
      const deviation = c > 0 && c < columns - 1 && lanes > 1 && l === lanes - 1 && rng() < 0.55;
      idx.push(nodes.length);
      nodes.push({ x, y, r, deviation });
    }
    colNodes.push(idx);
  }

  // Edges: each node in col c connects to 1–2 nodes in col c+1.
  for (let c = 0; c < columns - 1; c++) {
    const left = colNodes[c];
    const right = colNodes[c + 1];
    for (const l of left) {
      const fromNode = nodes[l];
      // Pick the closest 1 or 2 nodes in the next column.
      const candidates = right.map((r, ri) => ({ ri, dist: Math.abs(nodes[r].y - fromNode.y) })).sort((a, b) => a.dist - b.dist);
      const numConn = Math.min(right.length, fromNode.deviation ? 1 : 1 + (rng() < 0.35 ? 1 : 0));
      for (let i = 0; i < numConn; i++) {
        const target = nodes[right[candidates[i].ri]];
        const thick = !fromNode.deviation && !target.deviation && i === 0;
        const deviation = fromNode.deviation || target.deviation;
        edges.push({ x1: fromNode.x, y1: fromNode.y, x2: target.x, y2: target.y, thick, deviation });
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {edges.map((e, i) => (
        <line key={i}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke={e.deviation ? "#EF4444" : (e.thick ? "#1A5AFF" : "#C5D1E0")}
          strokeWidth={e.thick ? 2.5 : e.deviation ? 1.5 : 1.5}
          strokeDasharray={e.deviation ? "3 2" : undefined}
          fill="none"
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r}
          fill={n.deviation ? "#EF4444" : "#1A5AFF"}
        />
      ))}
      {hasFindings && (
        <text x={width - 4} y={11} fontSize="8" fontWeight="700" fill="#26BC71" textAnchor="end">
          ✓ findings
        </text>
      )}
    </svg>
  );
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
