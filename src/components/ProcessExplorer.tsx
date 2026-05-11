"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow, Background, Controls, type Node, type Edge, type NodeProps,
  Handle, Position, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import {
  START_NODE, END_NODE, ALL_OUTCOMES, ALL_DURATION_BUCKETS, ALL_CONFORMANCE_BUCKETS,
  type ProcessGraphSummary, type GraphActivity, type GraphEdge,
  type Outcome, type DurationBucket, type ConformanceBucket,
} from "@/lib/processGraph.types";
import { DEVIATION_LIBRARY, type DeviationReason } from "@/lib/deviationLibrary";
import type { VariantsSummary } from "@/lib/variants";

type OutcomeFilter = "all" | Outcome;
const OUTCOME_META: Record<OutcomeFilter, { label: string; color: string; bg: string }> = {
  all:         { label: "All",         color: "#001C3D", bg: "rgba(0,28,61,0.06)" },
  approved:    { label: "Approved",    color: "#1A8F4F", bg: "rgba(38,188,113,0.10)" },
  declined:    { label: "Declined",    color: "#C0392B", bg: "rgba(239,68,68,0.10)" },
  withdrawn:   { label: "Withdrawn",   color: "#B07800", bg: "rgba(255,172,9,0.12)" },
  in_progress: { label: "In progress", color: "#5C6E84", bg: "#EEF2F8" },
};

type DurationFilter = "all" | DurationBucket;
const DURATION_META: Record<DurationFilter, { label: string; color: string; bg: string }> = {
  all:         { label: "All",         color: "#001C3D", bg: "rgba(0,28,61,0.06)" },
  fastest_25:  { label: "Fastest 25%", color: "#1A8F4F", bg: "rgba(38,188,113,0.10)" },
  q2:          { label: "Q2",          color: "#5C6E84", bg: "#EEF2F8" },
  q3:          { label: "Q3",          color: "#B07800", bg: "rgba(255,172,9,0.10)" },
  slowest_25:  { label: "Slowest 25%", color: "#C0392B", bg: "rgba(239,68,68,0.10)" },
};

type ConformanceFilter = "all" | ConformanceBucket;
const CONFORMANCE_META: Record<ConformanceFilter, { label: string; color: string; bg: string }> = {
  all:        { label: "All",        color: "#001C3D", bg: "rgba(0,28,61,0.06)" },
  conforming: { label: "Conforming", color: "#1A5AFF", bg: "rgba(26,90,255,0.08)" },
  deviating:  { label: "Deviating",  color: "#C0392B", bg: "rgba(239,68,68,0.10)" },
};

type EdgeDetail = {
  from: string;
  to: string;
  caseCount: number;
  totalCases: number;
  durationMs: { avg: number | null; min: number | null; max: number | null; median: number | null };
  source: { system: string; actors: Array<{ name: string; count: number }> };
  target: { system: string; actors: Array<{ name: string; count: number }> };
  exampleCaseIds: string[];
};

type ActivityDetail = {
  name: string;
  caseCount: number;
  eventCount: number;
  totalCases: number;
  durationMs: { avg: number | null; min: number | null; max: number | null; median: number | null };
  positionInCase: { avgEventIndex: number | null; avgPctThroughCase: number | null };
  systems: Array<{ name: string; count: number }>;
  actors: Array<{ name: string; count: number }>;
  inbound:  Array<{ from: string; count: number }>;
  outbound: Array<{ to: string; count: number }>;
  exampleCaseIds: string[];
};

// ──────────────────────────────────────────────────────────────────────────
// Custom nodes
// ──────────────────────────────────────────────────────────────────────────

type ActivityNodeData = {
  label: string;
  caseCount: number;
  totalCases: number;
  system: string;
  isOnHappyPath: boolean;
  // Heat-map mode shows duration colour. Frequency mode shows happy-path colour only.
  mode: "frequency" | "duration";
  avgDurationToNextMs: number | null;
  durationHeatColor: string | null; // pre-computed by parent based on global min/max
  metricLabel: string;             // "X cases · Y%" or "Y avg" depending on mode
  // Hover/selection focus state — driven by edge interaction in the parent.
  dim?: boolean;
  highlight?: boolean;
};

function ActivityNode({ data }: NodeProps & { data: ActivityNodeData }) {
  const happy = data.isOnHappyPath;
  const isDurationMode = data.mode === "duration";

  // In duration mode, the left bar is coloured by heat. In frequency mode, by happy-path.
  const accentColor = isDurationMode
    ? (data.durationHeatColor ?? "#CBD5E1")
    : (happy ? "#1A5AFF" : "#CBD5E1");
  const borderColor = isDurationMode
    ? (data.durationHeatColor ?? "#DDE3EC")
    : (happy ? "#1A5AFF" : "#DDE3EC");

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 8,
      padding: "8px 12px",
      minWidth: 180,
      maxWidth: 230,
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: data.highlight
        ? "0 0 0 3px rgba(255,172,9,0.45), 0 4px 12px rgba(0,0,0,0.08)"
        : (happy && !isDurationMode ? "0 2px 6px rgba(26,90,255,0.08)" : "0 1px 2px rgba(0,0,0,0.03)"),
      opacity: data.dim ? 0.35 : 1,
      transition: "opacity 0.15s, box-shadow 0.15s",
    }}>
      <Handle type="target" position={Position.Top} style={{ background: "#CBD5E1", width: 6, height: 6 }} />
      <span style={{
        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
        background: accentColor,
        transform: "rotate(45deg)",
        opacity: isDurationMode ? 1 : (happy ? 1 : 0.35),
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#001C3D", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {data.label}
        </div>
        <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 2, fontFamily: "monospace" }}>
          {data.metricLabel}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#CBD5E1", width: 6, height: 6 }} />
    </div>
  );
}

function StartNode() {
  return (
    <div style={{
      width: 50, height: 50, borderRadius: "50%",
      background: "#26BC71", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 800, boxShadow: "0 2px 8px rgba(38,188,113,0.35)",
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: "#fff", width: 6, height: 6 }} />
      START
    </div>
  );
}

function EndNode() {
  return (
    <div style={{
      width: 50, height: 50, borderRadius: "50%",
      background: "#fff", color: "#001C3D",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 800, border: "2.5px solid #001C3D",
    }}>
      <Handle type="target" position={Position.Top} style={{ background: "#001C3D", width: 6, height: 6 }} />
      END
    </div>
  );
}

const nodeTypes = { activity: ActivityNode, start: StartNode, end: EndNode };

// ──────────────────────────────────────────────────────────────────────────
// Layout via dagre — top-down
// ──────────────────────────────────────────────────────────────────────────

function layout(nodes: Node[], edges: Edge[], happyPathSet: Set<string>): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 70,
    marginx: 30,
    marginy: 30,
    align: "UL", // align nodes within rank
  });

  for (const n of nodes) {
    const isTerminal = n.type === "start" || n.type === "end";
    g.setNode(n.id, { width: isTerminal ? 50 : 210, height: isTerminal ? 50 : 50 });
  }

  // Higher weight → dagre tries to keep these edges short and straight.
  // We give the happy-path spine 10× weight so it stays in a clean vertical column,
  // and exception edges naturally bend out to the side.
  for (const e of edges) {
    const isHappy = happyPathSet.has(`${e.source}→${e.target}`);
    g.setEdge(e.source, e.target, {
      weight: isHappy ? 10 : 1,
      minlen: 1,
    });
  }

  dagre.layout(g);

  const laidOut = nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
    };
  });

  return { nodes: laidOut, edges };
}

// ──────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────

export function ProcessExplorer({ graph: initialGraph, variants, engagementId, processId }: {
  graph: ProcessGraphSummary;
  variants?: VariantsSummary;
  engagementId?: string;
  processId?: string;
}) {
  // Variant slider — discrete steps. Each step adds the next most frequent
  // case variant to the visible set. The last position ("all") falls back to
  // the full graph (useful when the long-tail matters).
  const variantCount = variants?.topVariants.length ?? 0;
  const variantSliderMax = variantCount + 1; // last position = "all variants"
  const [topNVariants, setTopNVariants] = useState(1);

  const [colorMode, setColorMode] = useState<"frequency" | "duration">("frequency");

  // Lens filters — restrict the graph to a slice of cases.
  // Multi-select within a dimension; mutual exclusion across dimensions.
  // Empty array = no filter applied for that dimension.
  const [outcomeFilter, setOutcomeFilter] = useState<Outcome[]>([]);
  const [durationFilter, setDurationFilter] = useState<DurationBucket[]>([]);
  const [conformanceFilter, setConformanceFilter] = useState<ConformanceBucket[]>([]);

  // Independent toggles — filters compose (AND/intersection across dimensions).
  const toggleOutcome = (o: Outcome) => {
    setOutcomeFilter((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]);
  };
  const toggleDuration = (d: DurationBucket) => {
    setDurationFilter((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };
  const toggleConformance = (c: ConformanceBucket) => {
    setConformanceFilter((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  // Time-period filter — fromDate/toDate. When changed, the graph is refetched
  // with these params. Stored as ISO strings for stable equality.
  const [fromDateIso, setFromDateIso] = useState<string | null>(null);
  const [toDateIso, setToDateIso] = useState<string | null>(null);

  // Aggregate count of active lens filters (used for the "Clear all" affordance).
  const activeAdvancedFilterCount =
    (outcomeFilter.length > 0 ? 1 : 0) +
    (durationFilter.length > 0 ? 1 : 0) +
    (conformanceFilter.length > 0 ? 1 : 0) +
    ((fromDateIso || toDateIso) ? 1 : 0);
  const clearAllAdvancedFilters = () => {
    setOutcomeFilter([]);
    setDurationFilter([]);
    setConformanceFilter([]);
    setFromDateIso(null);
    setToDateIso(null);
  };
  const [graphOverride, setGraphOverride] = useState<ProcessGraphSummary | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  // Server-refetched graph supersedes the prop when present.
  const graph: ProcessGraphSummary = graphOverride ?? initialGraph;

  // Edge interaction state — hover highlights one path; click pins a callout.
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [edgeDetail, setEdgeDetail] = useState<EdgeDetail | null>(null);
  const [edgeDetailLoading, setEdgeDetailLoading] = useState(false);

  // Activity-node interaction state — click an activity for its own callout.
  const [selectedActivityName, setSelectedActivityName] = useState<string | null>(null);
  const [activityDetail, setActivityDetail] = useState<ActivityDetail | null>(null);
  const [activityDetailLoading, setActivityDetailLoading] = useState(false);

  const happyPathSet = useMemo(
    () => new Set(graph.happyPathEdges.map((e) => `${e.from}→${e.to}`)),
    [graph.happyPathEdges]
  );

  const happyActivitySet = useMemo(() => {
    const s = new Set<string>();
    for (const e of graph.happyPathEdges) {
      if (e.from !== START_NODE) s.add(e.from);
      if (e.to !== END_NODE) s.add(e.to);
    }
    return s;
  }, [graph.happyPathEdges]);

  // Variant-driven inclusion sets — when topNVariants <= variantCount we filter
  // to the union of activities + edges from the top-N case variants. When the
  // slider is at its rightmost ("all") position, these sets are null and we
  // fall through to the activity-frequency filter below.
  const variantInclusion = useMemo<{
    activities: Set<string>;
    edgeKeys: Set<string>;
    coveragePct: number;
  } | null>(() => {
    if (!variants || variantCount === 0) return null;
    if (topNVariants > variantCount) return null; // "all" mode

    const activities = new Set<string>();
    const edgeKeys = new Set<string>();
    let coveredCases = 0;

    const slice = variants.topVariants.slice(0, topNVariants);
    for (const v of slice) {
      coveredCases += v.caseCount;
      const seq = v.activities;
      if (seq.length === 0) continue;
      // Collect activities in this variant
      for (const a of seq) activities.add(a);
      // START → first
      edgeKeys.add(`${START_NODE}→${seq[0]}`);
      // Consecutive transitions
      for (let i = 0; i < seq.length - 1; i++) edgeKeys.add(`${seq[i]}→${seq[i + 1]}`);
      // last → END
      edgeKeys.add(`${seq[seq.length - 1]}→${END_NODE}`);
    }

    const total = variants.totalCases || graph.totalCases || 1;
    return { activities, edgeKeys, coveragePct: (coveredCases / total) * 100 };
  }, [variants, variantCount, topNVariants, graph.totalCases]);

  // Helper: how many cases of an entity are in the current lens scope.
  // Filters compose (intersection across dimensions). Each dimension's per-bucket
  // counts are summed for multi-select within it. Because we only have per-bucket
  // breakdowns (not per-bucket-COMBINATION), the intersection across dimensions
  // is approximated as MIN of the per-dimension counts — the upper bound.
  const hasOutcomeFilter = outcomeFilter.length > 0;
  const hasDurationFilter = durationFilter.length > 0;
  const hasConformanceFilter = conformanceFilter.length > 0;
  const hasAnyDimensionFilter = hasOutcomeFilter || hasDurationFilter || hasConformanceFilter;

  const lensCaseCount = (entity: { caseCount: number; caseCountByOutcome: GraphActivity["caseCountByOutcome"]; caseCountByDuration: GraphActivity["caseCountByDuration"]; caseCountByConformance: GraphActivity["caseCountByConformance"] }): number => {
    if (!hasAnyDimensionFilter) return entity.caseCount;
    let count = entity.caseCount;
    if (hasOutcomeFilter) {
      const c = outcomeFilter.reduce((s, o) => s + (entity.caseCountByOutcome[o] ?? 0), 0);
      if (c === 0) return 0;
      count = Math.min(count, c);
    }
    if (hasDurationFilter) {
      const c = durationFilter.reduce((s, d) => s + (entity.caseCountByDuration[d] ?? 0), 0);
      if (c === 0) return 0;
      count = Math.min(count, c);
    }
    if (hasConformanceFilter) {
      const c = conformanceFilter.reduce((s, c2) => s + (entity.caseCountByConformance[c2] ?? 0), 0);
      if (c === 0) return 0;
      count = Math.min(count, c);
    }
    return count;
  };

  const scopedTotalCases = (() => {
    if (!hasAnyDimensionFilter) return graph.totalCases;
    let total = graph.totalCases;
    if (hasOutcomeFilter) {
      total = Math.min(total, outcomeFilter.reduce((s, o) => s + (graph.outcomeBreakdown[o] ?? 0), 0));
    }
    if (hasDurationFilter) {
      total = Math.min(total, durationFilter.reduce((s, d) => s + (graph.durationBreakdown[d] ?? 0), 0));
    }
    if (hasConformanceFilter) {
      total = Math.min(total, conformanceFilter.reduce((s, c) => s + (graph.conformanceBreakdown[c] ?? 0), 0));
    }
    return total;
  })();

  // Activity-coverage filter — driven by variant inclusion + current lens.
  const allowedActivities = useMemo(() => {
    const s = new Set<string>();
    for (const a of graph.activities) {
      const cases = lensCaseCount(a);
      if (cases <= 0) continue; // current lens excludes this activity entirely
      if (variantInclusion) {
        if (variantInclusion.activities.has(a.name)) s.add(a.name);
      } else {
        // All-variants mode — include every activity with at least one case in scope.
        s.add(a.name);
      }
    }
    return s;
    // lensCaseCount captures outcomeFilter / durationFilter / conformanceFilter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.activities, variantInclusion, outcomeFilter, durationFilter, conformanceFilter]);

  const baseFilteredEdges = useMemo(
    () => graph.edges.filter((e) => {
      const fromOk = e.from === START_NODE || allowedActivities.has(e.from);
      const toOk = e.to === END_NODE || allowedActivities.has(e.to);
      if (!fromOk || !toOk) return false;
      // Lens filter — drop edges with zero cases in the current lens.
      const cases = lensCaseCount(e);
      if (cases <= 0) return false;
      if (variantInclusion) {
        return variantInclusion.edgeKeys.has(`${e.from}→${e.to}`);
      }
      return true;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph.edges, allowedActivities, variantInclusion, outcomeFilter, durationFilter, conformanceFilter]
  );

  // Connectivity safety: every visible activity needs at least one inbound and
  // one outbound edge, otherwise it shows as an orphan (e.g. Reject Application
  // with no incoming edge from Initial Review). Top inbound/outbound edges are
  // force-added even if they're below the path threshold.
  const filteredEdges = useMemo(() => {
    const hasInbound = new Set<string>();
    const hasOutbound = new Set<string>();
    for (const e of baseFilteredEdges) {
      if (e.to !== END_NODE) hasInbound.add(e.to);
      if (e.from !== START_NODE) hasOutbound.add(e.from);
    }
    const visible = new Set<string>([...hasInbound, ...hasOutbound]);

    const keyOf = (e: { from: string; to: string }) => `${e.from}→${e.to}`;
    const haveKeys = new Set(baseFilteredEdges.map(keyOf));
    const extras: typeof baseFilteredEdges = [];

    for (const name of visible) {
      // Add top inbound if missing
      if (!hasInbound.has(name)) {
        const top = graph.edges
          .filter((e) => e.to === name && (e.from === START_NODE || allowedActivities.has(e.from)))
          .sort((a, b) => b.caseCount - a.caseCount)[0];
        if (top && !haveKeys.has(keyOf(top))) {
          extras.push(top);
          haveKeys.add(keyOf(top));
        }
      }
      // Add top outbound if missing
      if (!hasOutbound.has(name)) {
        const top = graph.edges
          .filter((e) => e.from === name && (e.to === END_NODE || allowedActivities.has(e.to)))
          .sort((a, b) => b.caseCount - a.caseCount)[0];
        if (top && !haveKeys.has(keyOf(top))) {
          extras.push(top);
          haveKeys.add(keyOf(top));
        }
      }
    }
    return [...baseFilteredEdges, ...extras];
  }, [baseFilteredEdges, graph.edges, allowedActivities]);

  const visibleActivities = useMemo(() => {
    const s = new Set<string>();
    for (const e of filteredEdges) {
      if (e.from !== START_NODE) s.add(e.from);
      if (e.to !== END_NODE) s.add(e.to);
    }
    return s;
  }, [filteredEdges]);

  // For duration heat-map: compute global min/max so colour scaling is consistent
  const { durationMinMs, durationMaxMs } = useMemo(() => {
    const durs = graph.activities
      .filter((a) => visibleActivities.has(a.name) && a.avgDurationToNextMs !== null)
      .map((a) => a.avgDurationToNextMs as number);
    if (durs.length === 0) return { durationMinMs: 0, durationMaxMs: 0 };
    return { durationMinMs: Math.min(...durs), durationMaxMs: Math.max(...durs) };
  }, [graph.activities, visibleActivities]);

  // Base layout — does not depend on hover/selection so dagre only re-runs when the
  // graph or filters change.
  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => {
    const nodes: Node[] = [
      { id: START_NODE, type: "start", position: { x: 0, y: 0 }, data: {} },
      { id: END_NODE, type: "end", position: { x: 0, y: 0 }, data: {} },
    ];
    for (const a of graph.activities) {
      if (!visibleActivities.has(a.name)) continue;

      const heatColor = colorMode === "duration" && a.avgDurationToNextMs !== null && durationMaxMs > durationMinMs
        ? heatColorFor((a.avgDurationToNextMs - durationMinMs) / (durationMaxMs - durationMinMs))
        : null;

      const scopedCases = lensCaseCount(a);
      const pct = scopedTotalCases > 0 ? (scopedCases / scopedTotalCases) * 100 : 0;
      const metricLabel = colorMode === "duration"
        ? (a.avgDurationToNextMs !== null ? `${formatDuration(a.avgDurationToNextMs)} to next · ${pct.toFixed(0)}%` : `— · ${pct.toFixed(0)}%`)
        : `${scopedCases.toLocaleString()} · ${pct.toFixed(0)}%`;

      nodes.push({
        id: a.name,
        type: "activity",
        position: { x: 0, y: 0 },
        data: {
          label: a.name,
          caseCount: scopedCases,
          totalCases: scopedTotalCases,
          system: a.system,
          isOnHappyPath: happyActivitySet.has(a.name),
          mode: colorMode,
          avgDurationToNextMs: a.avgDurationToNextMs,
          durationHeatColor: heatColor,
          metricLabel,
        } satisfies ActivityNodeData,
      });
    }

    const maxEdgeCount = Math.max(...filteredEdges.map((e) => lensCaseCount(e)), 1);
    const EXCEPTION_PINK = "#EC4899";
    const HAPPY_BLUE = "#1A5AFF";
    const edges: Edge[] = filteredEdges.map((e) => {
      const isHappy = happyPathSet.has(`${e.from}→${e.to}`);
      const scopedCases = lensCaseCount(e);
      const weight = scopedCases / maxEdgeCount;
      const strokeWidth = Math.max(1, Math.min(6, weight * 6));
      const stroke = isHappy ? HAPPY_BLUE : EXCEPTION_PINK;
      const label = e.avgDurationMs !== null
        ? `${scopedCases.toLocaleString()}  ·  ${formatDuration(e.avgDurationMs)}`
        : scopedCases.toLocaleString();
      return {
        id: `${e.from}->${e.to}`,
        source: e.from, target: e.to,
        type: "smoothstep",
        animated: false,
        label,
        labelStyle: { fontSize: 10, fontWeight: 700, fill: stroke, cursor: "pointer" },
        labelBgStyle: { fill: "#fff", cursor: "pointer" },
        labelBgPadding: [4, 6],
        labelBgBorderRadius: 4,
        data: { isHappy, baseStrokeWidth: strokeWidth, baseStroke: stroke, baseOpacity: isHappy ? 1 : 0.55 + weight * 0.45 },
        style: {
          stroke,
          strokeWidth,
          strokeDasharray: isHappy ? undefined : weight < 0.3 ? "4 4" : undefined,
          opacity: isHappy ? 1 : 0.55 + weight * 0.45,
          cursor: "pointer",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
      };
    });

    return layout(nodes, edges, happyPathSet);
    // lensCaseCount captures outcome / duration / conformance filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, filteredEdges, visibleActivities, happyPathSet, happyActivitySet, colorMode, durationMinMs, durationMaxMs, outcomeFilter, durationFilter, conformanceFilter]);

  // Display pass — overlays hover/selection styling on the laid-out base.
  const focusedEndpoints = useMemo<{ source: string; target: string } | null>(() => {
    const id = hoveredEdgeId ?? selectedEdgeKey;
    if (!id) return null;
    const e = baseEdges.find((be) => be.id === id);
    return e ? { source: e.source, target: e.target } : null;
  }, [hoveredEdgeId, selectedEdgeKey, baseEdges]);

  const rfNodes = useMemo(() => {
    if (!focusedEndpoints && !selectedActivityName) return baseNodes;
    return baseNodes.map((n) => {
      if (n.type !== "activity") return n;
      const isEdgeEndpoint = focusedEndpoints && (n.id === focusedEndpoints.source || n.id === focusedEndpoints.target);
      const isSelectedActivity = selectedActivityName !== null && n.id === selectedActivityName;
      const isFocused = isEdgeEndpoint || isSelectedActivity;
      const someActivityFocused = focusedEndpoints !== null || selectedActivityName !== null;
      return {
        ...n,
        data: { ...(n.data as ActivityNodeData), dim: someActivityFocused && !isFocused, highlight: isFocused },
      };
    });
  }, [baseNodes, focusedEndpoints, selectedActivityName]);

  const rfEdges = useMemo(() => {
    const focusId = hoveredEdgeId ?? selectedEdgeKey;
    const HAPPY_DARK = "#0033CC";
    const EXCEPTION_DARK = "#9D174D";

    // Activity-focus mode — dim edges that don't touch the selected activity.
    if (!focusId && selectedActivityName) {
      return baseEdges.map((e) => {
        const baseStyle = e.style ?? {};
        const baseStrokeWidth = (e.data as { baseStrokeWidth?: number } | undefined)?.baseStrokeWidth ?? 1;
        const baseStroke = (e.data as { baseStroke?: string } | undefined)?.baseStroke ?? "#EC4899";
        const incident = e.source === selectedActivityName || e.target === selectedActivityName;
        if (incident) {
          return { ...e, style: { ...baseStyle, opacity: 1, stroke: baseStroke, strokeWidth: Math.max(2, baseStrokeWidth) } };
        }
        return { ...e, style: { ...baseStyle, opacity: 0.12, stroke: baseStroke, strokeWidth: baseStrokeWidth } };
      });
    }

    if (!focusId) return baseEdges;

    return baseEdges.map((e) => {
      const isFocus = e.id === focusId;
      const baseStyle = e.style ?? {};
      const isHappy = (e.data as { isHappy?: boolean } | undefined)?.isHappy ?? false;
      const baseStrokeWidth = (e.data as { baseStrokeWidth?: number } | undefined)?.baseStrokeWidth ?? 1;
      const baseStroke = (e.data as { baseStroke?: string } | undefined)?.baseStroke ?? "#EC4899";
      if (isFocus) {
        const stroke = isHappy ? HAPPY_DARK : EXCEPTION_DARK;
        return {
          ...e,
          zIndex: 10,
          animated: !isHappy,
          style: { ...baseStyle, stroke, strokeWidth: Math.max(3, baseStrokeWidth + 2), opacity: 1, strokeDasharray: undefined },
          labelStyle: { ...e.labelStyle, fill: stroke, fontSize: 11, fontWeight: 800 },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 },
        };
      }
      return {
        ...e,
        style: { ...baseStyle, opacity: 0.12, stroke: baseStroke, strokeWidth: baseStrokeWidth },
      };
    });
  }, [baseEdges, hoveredEdgeId, selectedEdgeKey, selectedActivityName]);

  // Fetch detail for the currently-selected edge.
  useEffect(() => {
    if (!selectedEdgeKey || !engagementId || !processId) {
      setEdgeDetail(null);
      return;
    }
    const sel = baseEdges.find((e) => e.id === selectedEdgeKey);
    if (!sel) return;

    let cancelled = false;
    setEdgeDetailLoading(true);
    setEdgeDetail(null);
    const url = `/api/engagements/${engagementId}/processes/${processId}/edge-detail?from=${encodeURIComponent(sel.source)}&to=${encodeURIComponent(sel.target)}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d: EdgeDetail | null) => { if (!cancelled) setEdgeDetail(d); })
      .catch(() => { if (!cancelled) setEdgeDetail(null); })
      .finally(() => { if (!cancelled) setEdgeDetailLoading(false); });

    return () => { cancelled = true; };
  }, [selectedEdgeKey, engagementId, processId, baseEdges]);

  // Selected edge — derived for callout rendering.
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeKey) return null;
    return baseEdges.find((e) => e.id === selectedEdgeKey) ?? null;
  }, [selectedEdgeKey, baseEdges]);

  // Fetch detail for the currently-selected activity.
  useEffect(() => {
    if (!selectedActivityName || !engagementId || !processId) {
      setActivityDetail(null);
      return;
    }
    let cancelled = false;
    setActivityDetailLoading(true);
    setActivityDetail(null);
    const url = `/api/engagements/${engagementId}/processes/${processId}/activity-detail?name=${encodeURIComponent(selectedActivityName)}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d: ActivityDetail | null) => { if (!cancelled) setActivityDetail(d); })
      .catch(() => { if (!cancelled) setActivityDetail(null); })
      .finally(() => { if (!cancelled) setActivityDetailLoading(false); });

    return () => { cancelled = true; };
  }, [selectedActivityName, engagementId, processId]);

  // Selected activity — also pull system info from graph.activities for the header.
  const selectedActivity = useMemo<GraphActivity | null>(() => {
    if (!selectedActivityName) return null;
    return graph.activities.find((a) => a.name === selectedActivityName) ?? null;
  }, [selectedActivityName, graph.activities]);

  // Refetch the graph when the time-period window changes. Debounced 250ms.
  useEffect(() => {
    if (!engagementId || !processId) return;
    if (fromDateIso === null && toDateIso === null) {
      setGraphOverride(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (fromDateIso) params.set("fromDate", fromDateIso);
      if (toDateIso) params.set("toDate", toDateIso);
      const url = `/api/engagements/${engagementId}/processes/${processId}/process-graph?${params.toString()}`;
      setGraphLoading(true);
      fetch(url)
        .then((r) => r.ok ? r.json() : null)
        .then((d: ProcessGraphSummary | null) => { if (!cancelled && d) setGraphOverride(d); })
        .catch(() => { /* keep prior */ })
        .finally(() => { if (!cancelled) setGraphLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [fromDateIso, toDateIso, engagementId, processId]);

  // Banking-grounded candidate root causes for the selected target step.
  const candidateReasons = useMemo<DeviationReason[]>(() => {
    if (!selectedEdge) return [];
    const target = selectedEdge.target;
    if (target === END_NODE) return [];
    const matches = DEVIATION_LIBRARY.filter((p) => p.stepKeyword.test(target));
    return matches.flatMap((m) => m.reasons);
  }, [selectedEdge]);

  if (!graph.computed) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#9AAABB", fontSize: 12 }}>
        Build the activity table first to see the process graph.
      </div>
    );
  }

  // KPI strip values
  const kpiCases = graph.totalCases;
  const kpiActivities = graph.activities.length;
  const kpiVariants = variants?.totalVariants ?? 0;
  const kpiMedianMs = graph.durationQuartiles.p50Ms ?? 0;
  const kpiConformingPct = graph.totalCases > 0
    ? (graph.conformanceBreakdown.conforming / graph.totalCases) * 100
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Top KPI strip — Celonis-style at-a-glance numbers */}
      <div style={{
        display: "flex", gap: 8, padding: "16px 18px",
        background: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFC 100%)",
        border: "1px solid #DDE3EC", borderRadius: 12,
        flexWrap: "wrap", rowGap: 14, alignItems: "center",
      }}>
        <Kpi label="Cases"            value={kpiCases.toLocaleString()} />
        <KpiDivider />
        <Kpi label="Activities"       value={kpiActivities.toString()} />
        <KpiDivider />
        <Kpi label="Variants"         value={kpiVariants.toString()} sub={variants && variants.totalCases > 0 ? `top covers ${(variants.topVariants[0]?.pct ?? 0).toFixed(0)}%` : undefined} />
        <KpiDivider />
        <Kpi label="Median cycle"     value={formatDuration(kpiMedianMs)} sub={`p25 ${formatDuration(graph.durationQuartiles.p25Ms)} · p75 ${formatDuration(graph.durationQuartiles.p75Ms)}`} />
        <KpiDivider />
        <Kpi label="Conformance"      value={`${kpiConformingPct.toFixed(0)}%`} sub={`${graph.conformanceBreakdown.deviating.toLocaleString()} cases deviate`} accent={kpiConformingPct >= 75 ? "#1A8F4F" : kpiConformingPct >= 50 ? "#B07800" : "#C0392B"} />
      </div>

      {/* FilterPanel is now rendered inside the canvas-row as a right rail (below). */}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", background: "#FAFBFC", border: "1px solid #EEF2F8", borderRadius: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 3, background: "#1A5AFF", borderRadius: 2 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: "#5C6E84" }}>Happy path</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 2, background: "#EC4899", borderRadius: 2 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: "#5C6E84" }}>Exceptions</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Color mode toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #DDE3EC", borderRadius: 16, padding: 2 }}>
          <button
            onClick={() => setColorMode("frequency")}
            style={{
              fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 14, cursor: "pointer", border: "none",
              background: colorMode === "frequency" ? "#1A5AFF" : "transparent",
              color: colorMode === "frequency" ? "#fff" : "#5C6E84",
            }}
          >Frequency</button>
          <button
            onClick={() => setColorMode("duration")}
            style={{
              fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 14, cursor: "pointer", border: "none",
              background: colorMode === "duration" ? "#1A5AFF" : "transparent",
              color: colorMode === "duration" ? "#fff" : "#5C6E84",
            }}
          >Cycle Time</button>
        </div>

        {/* Variants slider moved into the canvas as a vertical control (see below). */}
      </div>

      {/* Heat-map gradient legend (only shown in duration mode) */}
      {colorMode === "duration" && durationMaxMs > durationMinMs && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", fontSize: 10, color: "#5C6E84" }}>
          <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Avg time to next:</span>
          <span style={{ fontFamily: "monospace" }}>{formatDuration(durationMinMs)}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "linear-gradient(to right, #10B981, #FBBF24, #EF4444)", maxWidth: 240 }} />
          <span style={{ fontFamily: "monospace" }}>{formatDuration(durationMaxMs)}</span>
        </div>
      )}

      {/* Canvas + right-rail filter panel */}
      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0, height: 680, borderRadius: 12, border: "1px solid #DDE3EC", background: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Horizontal time-period slider — top strip of the canvas */}
        {graph.caseTimeRange.earliestIso && graph.caseTimeRange.latestIso && (
          <div style={{ padding: "8px 14px", borderBottom: "1px solid #EEF2F8", background: "#FAFBFC" }}>
            <TimePeriodRow
              earliestIso={graph.caseTimeRange.earliestIso}
              latestIso={graph.caseTimeRange.latestIso}
              fromIso={fromDateIso}
              toIso={toDateIso}
              loading={graphLoading}
              onChange={(from, to) => { setFromDateIso(from); setToDateIso(to); }}
              onReset={() => { setFromDateIso(null); setToDateIso(null); }}
            />
          </div>
        )}

        {/* Variants slider (left) + Graph (right) */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Vertical variants slider — drag up to reveal more variants */}
        {variantCount > 0 && (
          <VerticalVariantSlider
            value={topNVariants}
            sliderMax={variantSliderMax}
            variantCount={variantCount}
            totalVariants={variants?.totalVariants ?? variantCount}
            coveragePct={variantInclusion ? variantInclusion.coveragePct : 100}
            onChange={setTopNVariants}
          />
        )}

        {/* Graph + overlays */}
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onEdgeMouseEnter={(_e, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onEdgeClick={(_e, edge) => {
            setSelectedActivityName(null);
            setSelectedEdgeKey(edge.id);
          }}
          onNodeClick={(_e, node) => {
            if (node.type !== "activity") return;
            setSelectedEdgeKey(null);
            setHoveredEdgeId(null);
            setSelectedActivityName(node.id);
          }}
          onPaneClick={() => {
            setSelectedEdgeKey(null);
            setSelectedActivityName(null);
          }}
        >
          <Background color="rgba(0,0,0,0.04)" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Hover tooltip — small floating cue when hovering but not yet clicked */}
        {hoveredEdgeId && !selectedEdgeKey && (() => {
          const e = baseEdges.find((be) => be.id === hoveredEdgeId);
          if (!e) return null;
          const fromLabel = e.source === START_NODE ? "Start" : e.source;
          const toLabel = e.target === END_NODE ? "End" : e.target;
          return (
            <div style={{
              position: "absolute", top: 12, left: 12, zIndex: 20,
              background: "rgba(0,28,61,0.92)", color: "#fff",
              padding: "8px 12px", borderRadius: 8, fontSize: 11,
              pointerEvents: "none", maxWidth: 360,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
                Click for details
              </div>
              <div style={{ fontWeight: 700, fontFamily: "monospace" }}>
                {fromLabel} <span style={{ color: "#EC4899" }}>→</span> {toLabel}
              </div>
            </div>
          );
        })()}

        {/* Click-pinned callout — full detail with metrics, apps, actors, root causes */}
        {selectedEdgeKey && selectedEdge && (
          <EdgeCallout
            edge={selectedEdge}
            detail={edgeDetail}
            loading={edgeDetailLoading}
            candidateReasons={candidateReasons}
            onClose={() => setSelectedEdgeKey(null)}
          />
        )}

        {/* Activity callout — shown when a node is clicked */}
        {selectedActivityName && selectedActivity && (
          <ActivityCallout
            activity={selectedActivity}
            detail={activityDetail}
            loading={activityDetailLoading}
            totalCases={graph.totalCases}
            isOnHappyPath={happyActivitySet.has(selectedActivityName)}
            onClose={() => setSelectedActivityName(null)}
          />
        )}
        </div>
        </div>
      </div>

      {/* Right-rail filter panel */}
      <div style={{ width: 360, flexShrink: 0 }}>
        <FilterPanel
          graph={graph}
          outcomeFilter={outcomeFilter}
          durationFilter={durationFilter}
          conformanceFilter={conformanceFilter}
          onToggleOutcome={toggleOutcome}
          onToggleDuration={toggleDuration}
          onToggleConformance={toggleConformance}
          clearAll={clearAllAdvancedFilters}
          activeCount={activeAdvancedFilterCount}
        />
      </div>
      </div>

      {/* Stats footer */}
      <div style={{ display: "flex", gap: 16, padding: "8px 4px", fontSize: 11, color: "#5C6E84" }}>
        <span><strong style={{ color: "#001C3D" }}>{graph.totalCases.toLocaleString()}</strong> cases</span>
        <span><strong style={{ color: "#001C3D" }}>{graph.activities.length}</strong> activities</span>
        <span><strong style={{ color: "#001C3D" }}>{graph.edges.length}</strong> distinct transitions</span>
        {variantInclusion && (
          <span style={{ marginLeft: "auto", color: "#B07800" }}>
            Top {topNVariants} of {variantCount} variants · {variantInclusion.coveragePct.toFixed(0)}% of cases · {filteredEdges.length}/{graph.edges.length} transitions
          </span>
        )}
      </div>
    </div>
  );
}

// Re-export types so consumers can import from one place
export type { ProcessGraphSummary, GraphActivity, GraphEdge };

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

// Linear interpolation green → yellow → red for heat-map
function heatColorFor(t: number): string {
  const v = Math.max(0, Math.min(1, t));
  // Two-segment gradient: 0→0.5 green→yellow, 0.5→1 yellow→red
  if (v < 0.5) {
    const u = v * 2;
    // green (16,185,129) → yellow (251,191,36)
    const r = Math.round(16 + (251 - 16) * u);
    const g = Math.round(185 + (191 - 185) * u);
    const b = Math.round(129 + (36 - 129) * u);
    return `rgb(${r},${g},${b})`;
  } else {
    const u = (v - 0.5) * 2;
    // yellow (251,191,36) → red (239,68,68)
    const r = Math.round(251 + (239 - 251) * u);
    const g = Math.round(191 + (68 - 191) * u);
    const b = Math.round(36 + (68 - 36) * u);
    return `rgb(${r},${g},${b})`;
  }
}

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "—";
  const sec = ms / 1000;
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = sec / 60;
  if (min < 60) return `${Math.round(min)}m`;
  const hr = min / 60;
  if (hr < 24) return `${hr.toFixed(1)}h`;
  const d = hr / 24;
  return `${d.toFixed(1)}d`;
}

// ──────────────────────────────────────────────────────────────────────────
// KPI strip — Celonis-style numbers at the top of the explorer
// ──────────────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800, lineHeight: 1,
        color: accent ?? "#001C3D", fontFamily: "monospace",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function KpiDivider() {
  return <div style={{ width: 1, alignSelf: "stretch", background: "#EEF2F8", margin: "0 4px" }} />;
}

// ──────────────────────────────────────────────────────────────────────────
// Vertical variants slider — sits on the left edge of the canvas
// Bottom = top 1 variant (happy path only); drag up to reveal more.
// ──────────────────────────────────────────────────────────────────────────

function VerticalVariantSlider({
  value, sliderMax, variantCount, totalVariants, coveragePct, onChange,
}: {
  value: number;          // currently shown: 1..variantCount+1 (+1 = "all")
  sliderMax: number;      // variantCount + 1
  variantCount: number;   // number of top variants we have data for
  totalVariants: number;  // total variants in the dataset (incl. long tail)
  coveragePct: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const setFromClientY = useCallback((clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    // Bottom of track = value 1; top = value sliderMax.
    const pct = 1 - (clientY - rect.top) / rect.height;
    const clamped = Math.max(0, Math.min(1, pct));
    const newValue = Math.round(1 + clamped * (sliderMax - 1));
    onChange(newValue);
  }, [sliderMax, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setFromClientY(e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, setFromClientY]);

  const fillPct = ((value - 1) / Math.max(1, sliderMax - 1)) * 100;
  const isAll = value > variantCount;

  return (
    <div style={{
      width: 78, flexShrink: 0,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "12px 4px",
      borderRight: "1px solid #EEF2F8",
      background: "#FAFBFC",
    }}>
      {/* Header */}
      <div style={{ fontSize: 9, fontWeight: 800, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        Variants
      </div>
      <div style={{ fontSize: 12, color: "#1A5AFF", fontFamily: "monospace", fontWeight: 800, lineHeight: 1.1 }}>
        {isAll ? "all" : `${value}/${variantCount}`}
      </div>
      <div style={{ fontSize: 9, color: "#9AAABB", marginTop: 2 }}>
        {coveragePct.toFixed(0)}% cases
      </div>

      {/* Top label — all variants */}
      <div style={{ fontSize: 9, color: "#9AAABB", marginTop: 14, textAlign: "center", lineHeight: 1.2 }}>
        all<br />
        <span style={{ fontFamily: "monospace" }}>({totalVariants})</span>
      </div>

      {/* Vertical track */}
      <div
        ref={trackRef}
        onMouseDown={(e) => { setDragging(true); setFromClientY(e.clientY); }}
        style={{
          position: "relative",
          width: 8,
          flex: 1,
          minHeight: 200,
          marginTop: 6, marginBottom: 6,
          background: "#EEF2F8",
          borderRadius: 4,
          cursor: dragging ? "grabbing" : "pointer",
        }}
      >
        {/* Filled portion (from bottom) */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: `${fillPct}%`,
          background: "linear-gradient(180deg, #06B6D4 0%, #1A5AFF 100%)",
          borderRadius: 4,
          transition: dragging ? "none" : "height 0.15s",
        }} />
        {/* Thumb */}
        <div style={{
          position: "absolute", left: "50%",
          bottom: `calc(${fillPct}% - 9px)`,
          transform: "translateX(-50%)",
          width: 18, height: 18,
          borderRadius: "50%",
          background: "#fff",
          border: "2.5px solid #1A5AFF",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          cursor: dragging ? "grabbing" : "grab",
          transition: dragging ? "none" : "bottom 0.15s",
        }} />
      </div>

      {/* Bottom label — top variant */}
      <div style={{ fontSize: 9, color: "#9AAABB", textAlign: "center", lineHeight: 1.2 }}>
        top<br />variant
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Throughput-time histogram — distribution of case cycle times
// ──────────────────────────────────────────────────────────────────────────

function ThroughputHistogram({
  buckets,
  quartiles,
  totalCases,
}: {
  buckets: Array<{ fromMs: number; toMs: number; caseCount: number }>;
  quartiles: { p25Ms: number; p50Ms: number; p75Ms: number };
  totalCases: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const maxCount = Math.max(...buckets.map((b) => b.caseCount), 1);

  // Width range — used for the marker positions (p25 / p50 / p75)
  const minMs = buckets[0]?.fromMs ?? 0;
  const maxMs = buckets[buckets.length - 1]?.toMs ?? 1;
  const totalRangeMs = Math.max(1, maxMs - minMs);
  const markerPct = (ms: number) => Math.max(0, Math.min(100, ((ms - minMs) / totalRangeMs) * 100));

  return (
    <div style={{ background: "#fff", border: "1px solid #DDE3EC", borderRadius: 12, padding: "10px 14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: collapsed ? 0 : 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Throughput time
        </span>
        <span style={{ fontSize: 10, color: "#9AAABB" }}>
          {totalCases.toLocaleString()} cases · median {formatDuration(quartiles.p50Ms)}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setCollapsed((s) => !s)}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 10, fontWeight: 700, color: "#5C6E84",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          {collapsed ? "Expand" : "Collapse"}
          <span style={{ fontSize: 9, transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.15s" }}>▾</span>
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Bars */}
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 4, height: 80, paddingBottom: 4 }}>
            {buckets.map((b, i) => {
              const heightPct = (b.caseCount / maxCount) * 100;
              const pct = totalCases > 0 ? (b.caseCount / totalCases) * 100 : 0;
              return (
                <div
                  key={i}
                  title={`${formatDuration(b.fromMs)} – ${formatDuration(b.toMs)} · ${b.caseCount.toLocaleString()} cases (${pct.toFixed(1)}%)`}
                  style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", position: "relative" }}
                >
                  <div style={{
                    width: "100%",
                    height: `${heightPct}%`,
                    minHeight: b.caseCount > 0 ? 2 : 0,
                    background: "linear-gradient(180deg, #FFAC09 0%, #FBBF24 100%)",
                    borderRadius: "3px 3px 0 0",
                  }} />
                </div>
              );
            })}

            {/* Quartile markers — vertical dashed lines */}
            {[
              { label: "p25", ms: quartiles.p25Ms, color: "#26BC71" },
              { label: "p50", ms: quartiles.p50Ms, color: "#1A5AFF" },
              { label: "p75", ms: quartiles.p75Ms, color: "#EF4444" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  position: "absolute", top: 0, bottom: 0, left: `${markerPct(m.ms)}%`,
                  borderLeft: `1.5px dashed ${m.color}`, pointerEvents: "none",
                }}
              />
            ))}
          </div>

          {/* X-axis labels — first / median / last */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9AAABB", fontFamily: "monospace", marginTop: 4 }}>
            <span>{formatDuration(buckets[0].fromMs)}</span>
            <span>{formatDuration(buckets[Math.floor(buckets.length / 2)].fromMs)}</span>
            <span>{formatDuration(buckets[buckets.length - 1].toMs)}</span>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 9, color: "#5C6E84" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 0, borderTop: "1.5px dashed #26BC71" }} />
              p25 {formatDuration(quartiles.p25Ms)}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 0, borderTop: "1.5px dashed #1A5AFF" }} />
              median {formatDuration(quartiles.p50Ms)}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 0, borderTop: "1.5px dashed #EF4444" }} />
              p75 {formatDuration(quartiles.p75Ms)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Unified filter panel — dropdown + horizontal bar list (Celonis-style)
// ──────────────────────────────────────────────────────────────────────────

function FilterPanel({
  graph,
  outcomeFilter,
  durationFilter,
  conformanceFilter,
  onToggleOutcome,
  onToggleDuration,
  onToggleConformance,
  clearAll,
  activeCount,
}: {
  graph: ProcessGraphSummary;
  outcomeFilter: Outcome[];
  durationFilter: DurationBucket[];
  conformanceFilter: ConformanceBucket[];
  onToggleOutcome: (v: Outcome) => void;
  onToggleDuration: (v: DurationBucket) => void;
  onToggleConformance: (v: ConformanceBucket) => void;
  clearAll: () => void;
  activeCount: number;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #DDE3EC", borderRadius: 12, padding: "12px 14px", height: 680, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#001C3D", letterSpacing: "0.02em" }}>
          Filters
        </span>
        <span style={{ fontSize: 10, color: "#9AAABB" }}>
          combine across dimensions
        </span>
        <div style={{ flex: 1 }} />
        {activeCount > 0 && (
          <button onClick={clearAll}
            style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>
            Clear ({activeCount})
          </button>
        )}
      </div>

      {/* All four sections, stacked, scrollable */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 2 }}>
        <FilterSection title="Outcome">
          <BarList
            items={ALL_OUTCOMES.map((o) => ({
              key: o,
              label: OUTCOME_META[o].label,
              color: OUTCOME_META[o].color,
              count: graph.outcomeBreakdown[o] ?? 0,
            }))}
            totalCases={graph.totalCases}
            activeKeys={outcomeFilter}
            onToggle={(k) => onToggleOutcome(k as Outcome)}
          />
        </FilterSection>

        <FilterSection title="Duration" subtitle={`p25 ${formatDuration(graph.durationQuartiles.p25Ms)} · p50 ${formatDuration(graph.durationQuartiles.p50Ms)} · p75 ${formatDuration(graph.durationQuartiles.p75Ms)}`}>
          <BarList
            items={ALL_DURATION_BUCKETS.map((d) => ({
              key: d,
              label: DURATION_META[d].label,
              color: DURATION_META[d].color,
              count: graph.durationBreakdown[d] ?? 0,
            }))}
            totalCases={graph.totalCases}
            activeKeys={durationFilter}
            onToggle={(k) => onToggleDuration(k as DurationBucket)}
          />
        </FilterSection>

        <FilterSection title="Conformance" subtitle="conforming = follows happy path exactly">
          <BarList
            items={ALL_CONFORMANCE_BUCKETS.map((c) => ({
              key: c,
              label: CONFORMANCE_META[c].label,
              color: CONFORMANCE_META[c].color,
              count: graph.conformanceBreakdown[c] ?? 0,
            }))}
            totalCases={graph.totalCases}
            activeKeys={conformanceFilter}
            onToggle={(k) => onToggleConformance(k as ConformanceBucket)}
          />
        </FilterSection>

      </div>

      {/* Footer — active filter count */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #EEF2F8", fontSize: 10, color: "#9AAABB", lineHeight: 1.6 }}>
        {activeCount === 0 ? (
          <div>No filters active — showing all <strong style={{ color: "#001C3D" }}>{graph.totalCases.toLocaleString()}</strong> cases</div>
        ) : (
          <>
            <div><strong style={{ color: "#001C3D" }}>{activeCount}</strong> filter{activeCount !== 1 ? "s" : ""} active across dimensions</div>
            <div style={{ marginTop: 2 }}>Combined as <strong style={{ color: "#1A5AFF" }}>AND</strong> — graph shows cases matching every active filter</div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 9, color: "#9AAABB", marginTop: 1 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function BarList({
  items, totalCases, activeKeys, onToggle, subtitle,
}: {
  items: Array<{ key: string; label: string; color: string; count: number }>;
  totalCases: number;
  activeKeys: string[];
  onToggle: (key: string) => void;
  subtitle?: string;
}) {
  // Bar width is the SHARE of total cases, not relative-to-max. This makes
  // a 60% bucket clearly larger than a 10% one (and even quartiles show as ~25%).
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {subtitle && (
        <div style={{ fontSize: 10, color: "#9AAABB", marginBottom: 4, lineHeight: 1.5 }}>{subtitle}</div>
      )}
      {items.map((it) => {
        const sharePct = totalCases > 0 ? (it.count / totalCases) * 100 : 0;
        const isActive = activeKeys.includes(it.key);
        const isEmpty = it.count === 0;
        return (
          <button
            key={it.key}
            onClick={() => !isEmpty && onToggle(it.key)}
            disabled={isEmpty}
            style={{
              display: "flex", flexDirection: "column", gap: 4,
              background: isActive ? `${it.color}14` : "transparent",
              border: `1px solid ${isActive ? it.color : "transparent"}`,
              borderRadius: 6, padding: "6px 8px",
              cursor: isEmpty ? "not-allowed" : "pointer", textAlign: "left",
              opacity: isEmpty ? 0.4 : 1,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { if (!isActive && !isEmpty) (e.currentTarget as HTMLElement).style.background = "#F5F7FB"; }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {/* Top row: label + count/% */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: isActive ? it.color : "#001C3D",
                display: "inline-flex", alignItems: "center", gap: 6,
                flex: 1, minWidth: 0,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.color, opacity: isEmpty ? 0.3 : 1, flexShrink: 0 }} />
                {it.label}
              </span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: isActive ? it.color : "#5C6E84", whiteSpace: "nowrap", flexShrink: 0 }}>
                <strong>{it.count.toLocaleString()}</strong>
                <span style={{ marginLeft: 4, color: "#9AAABB" }}>· {sharePct.toFixed(0)}%</span>
              </span>
            </div>

            {/* Bar — share of total */}
            <div style={{ position: "relative", height: 8, background: "#F5F7FB", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${sharePct}%`,
                background: isActive
                  ? `linear-gradient(90deg, ${it.color}, ${it.color}CC)`
                  : `linear-gradient(90deg, ${it.color}88, ${it.color}55)`,
                borderRadius: 2,
                transition: "width 0.18s, background 0.12s",
              }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Toolbar — chip rows + time-period range slider
// ──────────────────────────────────────────────────────────────────────────

function ChipRow<V extends string>({
  label, values, active, meta, countOf, totalCases, onPick, tooltip,
}: {
  label: string;
  values: V[];
  active: V;
  meta: Record<V, { label: string; color: string; bg: string }>;
  countOf: (v: V) => number;
  totalCases: number;
  onPick: (v: V) => void;
  tooltip?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span title={tooltip} style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4, minWidth: 88, cursor: tooltip ? "help" : "default" }}>
        {label}
      </span>
      {values.map((v) => {
        const m = meta[v];
        const count = countOf(v);
        const pct = totalCases > 0 ? (count / totalCases) * 100 : 0;
        const isActive = active === v;
        const isEmpty = v !== "all" && count === 0;
        return (
          <button
            key={v}
            onClick={() => !isEmpty && onPick(v)}
            disabled={isEmpty}
            style={{
              fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 14, cursor: isEmpty ? "not-allowed" : "pointer",
              border: `1px solid ${isActive ? m.color : "transparent"}`,
              background: isActive ? m.bg : "transparent",
              color: isEmpty ? "#CBD5E1" : (isActive ? m.color : "#5C6E84"),
              display: "inline-flex", alignItems: "center", gap: 5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, opacity: isEmpty ? 0.3 : 1 }} />
            {m.label}
            <span style={{ fontFamily: "monospace", fontSize: 9, color: isActive ? m.color : "#9AAABB", marginLeft: 2 }}>
              {count.toLocaleString()}{v !== "all" && pct > 0 ? ` · ${pct.toFixed(0)}%` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TimePeriodRow({
  earliestIso, latestIso, fromIso, toIso, loading, onChange, onReset,
}: {
  earliestIso: string;
  latestIso: string;
  fromIso: string | null;
  toIso: string | null;
  loading: boolean;
  onChange: (from: string | null, to: string | null) => void;
  onReset: () => void;
}) {
  const earliestMs = new Date(earliestIso).getTime();
  const latestMs = new Date(latestIso).getTime();
  if (latestMs <= earliestMs) return null;

  const span = latestMs - earliestMs;
  const fromMs = fromIso ? new Date(fromIso).getTime() : earliestMs;
  const toMs = toIso ? new Date(toIso).getTime() : latestMs;

  const fromPct = ((fromMs - earliestMs) / span) * 100;
  const toPct = ((toMs - earliestMs) / span) * 100;

  const fmtDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleFrom = (pct: number) => {
    const ms = earliestMs + (pct / 100) * span;
    const clamped = Math.min(ms, toMs - 24 * 3600_000);
    onChange(new Date(clamped).toISOString(), toIso ?? new Date(latestMs).toISOString());
  };
  const handleTo = (pct: number) => {
    const ms = earliestMs + (pct / 100) * span;
    const clamped = Math.max(ms, fromMs + 24 * 3600_000);
    onChange(fromIso ?? new Date(earliestMs).toISOString(), new Date(clamped).toISOString());
  };

  const isFiltered = fromIso !== null || toIso !== null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span title="Filter cases by their start timestamp. Refetches the graph from the server."
        style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 88, cursor: "help" }}>
        Time period
      </span>

      <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "#5C6E84", fontFamily: "monospace", minWidth: 72 }}>{fmtDate(fromMs)}</span>

        <div style={{ position: "relative", flex: 1, height: 28 }}>
          {/* Track */}
          <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 4, background: "#EEF2F8", borderRadius: 2 }} />
          {/* Selected range */}
          <div style={{
            position: "absolute", top: 12, height: 4,
            left: `${fromPct}%`, width: `${toPct - fromPct}%`,
            background: "#1A5AFF", borderRadius: 2,
          }} />
          {/* From thumb */}
          <input
            type="range" min={0} max={100} step={0.5}
            value={fromPct}
            onChange={(e) => handleFrom(Number(e.target.value))}
            style={{
              position: "absolute", inset: 0, width: "100%",
              background: "transparent", pointerEvents: "auto",
              WebkitAppearance: "none", appearance: "none",
            }}
            className="dual-range-thumb"
          />
          <input
            type="range" min={0} max={100} step={0.5}
            value={toPct}
            onChange={(e) => handleTo(Number(e.target.value))}
            style={{
              position: "absolute", inset: 0, width: "100%",
              background: "transparent", pointerEvents: "auto",
              WebkitAppearance: "none", appearance: "none",
            }}
            className="dual-range-thumb"
          />
        </div>

        <span style={{ fontSize: 10, color: "#5C6E84", fontFamily: "monospace", minWidth: 72, textAlign: "right" }}>{fmtDate(toMs)}</span>
      </div>

      {loading && (
        <span style={{ fontSize: 10, color: "#1A5AFF", fontWeight: 700 }}>Refreshing…</span>
      )}
      {isFiltered && !loading && (
        <button onClick={onReset}
          style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>
          Reset
        </button>
      )}

      <style>{`
        .dual-range-thumb { -webkit-appearance: none; appearance: none; outline: none; background: transparent; height: 28px; }
        .dual-range-thumb::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid #1A5AFF; cursor: pointer; pointer-events: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
        .dual-range-thumb::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid #1A5AFF; cursor: pointer; pointer-events: auto; }
        .dual-range-thumb::-webkit-slider-runnable-track { background: transparent; }
        .dual-range-thumb::-moz-range-track { background: transparent; }
      `}</style>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Callout — pinned panel that opens when an edge is clicked
// ──────────────────────────────────────────────────────────────────────────

const CATEGORY_BG: Record<DeviationReason["category"], { bg: string; text: string; label: string }> = {
  legitimate:   { bg: "rgba(38,188,113,0.12)", text: "#1A8F4F", label: "Legitimate" },
  operational:  { bg: "rgba(255,172,9,0.15)",  text: "#B07800", label: "Operational" },
  compliance:   { bg: "rgba(239,68,68,0.12)",  text: "#C0392B", label: "Compliance" },
  data_quality: { bg: "rgba(124,58,237,0.12)", text: "#5B21B6", label: "Data quality" },
};

const SEVERITY_BG: Record<DeviationReason["severity"], { bg: string; text: string }> = {
  low:      { bg: "#F5F7F9",                text: "#5C6E84" },
  medium:   { bg: "rgba(255,172,9,0.12)",  text: "#B07800" },
  high:     { bg: "rgba(239,68,68,0.12)",  text: "#C0392B" },
  critical: { bg: "rgba(190,18,60,0.18)",  text: "#9D174D" },
};

function EdgeCallout({
  edge,
  detail,
  loading,
  candidateReasons,
  onClose,
}: {
  edge: Edge;
  detail: EdgeDetail | null;
  loading: boolean;
  candidateReasons: DeviationReason[];
  onClose: () => void;
}) {
  const fromLabel = edge.source === START_NODE ? "Start" : edge.source;
  const toLabel = edge.target === END_NODE ? "End" : edge.target;
  const isHappy = (edge.data as { isHappy?: boolean } | undefined)?.isHappy ?? false;
  const accent = isHappy ? "#1A5AFF" : "#EC4899";

  const apps = (() => {
    if (!detail) return [];
    const set = new Set<string>();
    if (detail.source.system && detail.source.system !== "—") set.add(detail.source.system);
    if (detail.target.system && detail.target.system !== "—") set.add(detail.target.system);
    return [...set];
  })();

  const allActors = (() => {
    if (!detail) return [];
    const m = new Map<string, number>();
    for (const a of detail.source.actors) m.set(a.name, (m.get(a.name) ?? 0) + a.count);
    for (const a of detail.target.actors) m.set(a.name, (m.get(a.name) ?? 0) + a.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  })();

  const totalActorCount = allActors.reduce((s, a) => s + a.count, 0);

  return (
    <div style={{
      position: "absolute", top: 12, right: 12, bottom: 12, zIndex: 30,
      width: 380, background: "#fff",
      border: "1px solid #DDE3EC", borderRadius: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #EEF2F8",
        background: isHappy ? "rgba(26,90,255,0.04)" : "rgba(236,72,153,0.05)",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, marginBottom: 4 }}>
            {isHappy ? "Happy path transition" : "Exception transition"}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#001C3D", lineHeight: 1.3 }}>
            {fromLabel}
          </div>
          <div style={{ fontSize: 16, color: accent, margin: "2px 0", lineHeight: 1 }}>↓</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#001C3D", lineHeight: 1.3 }}>
            {toLabel}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 18, color: "#9AAABB", padding: "0 4px", lineHeight: 1,
        }}>×</button>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {loading && (
          <div style={{ fontSize: 11, color: "#9AAABB", textAlign: "center", padding: "20px 0" }}>
            Loading transition detail…
          </div>
        )}

        {!loading && detail && (
          <>
            {/* Metric block */}
            <Section title="Transition metrics">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Stat label="Cases on this path" value={detail.caseCount.toLocaleString()} sub={detail.totalCases > 0 ? `${((detail.caseCount / detail.totalCases) * 100).toFixed(1)}% of total` : undefined} />
                <Stat label="Avg time" value={detail.durationMs.avg !== null ? formatDuration(detail.durationMs.avg) : "—"} />
                <Stat label="Median time" value={detail.durationMs.median !== null ? formatDuration(detail.durationMs.median) : "—"} />
                <Stat label="Min · Max" value={detail.durationMs.min !== null && detail.durationMs.max !== null ? `${formatDuration(detail.durationMs.min)} · ${formatDuration(detail.durationMs.max)}` : "—"} />
              </div>
            </Section>

            {/* Apps involved */}
            <Section title="Applications involved">
              {apps.length === 0 ? (
                <div style={{ fontSize: 11, color: "#9AAABB" }}>No system info on these events.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {apps.map((app) => (
                    <span key={app} style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                      background: "rgba(26,90,255,0.08)", color: "#1A5AFF",
                    }}>{app}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 6, lineHeight: 1.4 }}>
                Source <strong style={{ color: "#5C6E84" }}>{detail.source.system}</strong> → Target <strong style={{ color: "#5C6E84" }}>{detail.target.system}</strong>
              </div>
            </Section>

            {/* Actors impacted */}
            <Section title="Actors impacted" hint={totalActorCount > 0 ? `${allActors.length} distinct actor${allActors.length !== 1 ? "s" : ""}` : undefined}>
              {allActors.length === 0 ? (
                <div style={{ fontSize: 11, color: "#9AAABB" }}>No actor recorded on these events.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {allActors.slice(0, 8).map((a) => {
                    const pct = totalActorCount > 0 ? (a.count / totalActorCount) * 100 : 0;
                    return (
                      <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                        <span style={{ flex: 1, color: "#001C3D", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                        <div style={{ flex: 1.5, height: 6, background: "#EEF2F8", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#1A5AFF" }} />
                        </div>
                        <span style={{ width: 56, textAlign: "right", fontFamily: "monospace", color: "#5C6E84" }}>
                          {a.count} · {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Example case IDs */}
            {detail.exampleCaseIds.length > 0 && (
              <Section title="Example cases">
                <div style={{ fontSize: 10, color: "#5C6E84", fontFamily: "monospace", lineHeight: 1.6, wordBreak: "break-all" }}>
                  {detail.exampleCaseIds.join(", ")}
                </div>
              </Section>
            )}
          </>
        )}

        {/* Candidate root causes — banking-grounded */}
        {!isHappy && (
          <Section title="Potential root causes" hint={candidateReasons.length > 0 ? `${candidateReasons.length} candidate${candidateReasons.length !== 1 ? "s" : ""} from banking library` : undefined}>
            {candidateReasons.length === 0 ? (
              <div style={{ fontSize: 11, color: "#9AAABB", lineHeight: 1.5 }}>
                No banking patterns matched this step. The Stage 5 findings agent will apply general process-mining judgment.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {candidateReasons
                  .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])
                  .map((r, i) => {
                    const cat = CATEGORY_BG[r.category];
                    const sev = SEVERITY_BG[r.severity];
                    return (
                      <div key={i} style={{ padding: 10, borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF2F8" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3, background: cat.bg, color: cat.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {cat.label}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3, background: sev.bg, color: sev.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {r.severity}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", marginBottom: 4 }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#374D6C", lineHeight: 1.5, marginBottom: 6 }}>
                          {r.description}
                        </div>
                        <div style={{ fontSize: 10, color: "#5C6E84", lineHeight: 1.5 }}>
                          <strong style={{ color: "#001C3D" }}>How to investigate:</strong> {r.investigationHint}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

const SEV_RANK: Record<DeviationReason["severity"], number> = { critical: 4, high: 3, medium: 2, low: 1 };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}
        </span>
        {hint && <span style={{ fontSize: 10, color: "#9AAABB" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#FAFBFC", border: "1px solid #EEF2F8", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", fontFamily: "monospace", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Activity callout — pinned panel that opens when an activity node is clicked
// ──────────────────────────────────────────────────────────────────────────

function ActivityCallout({
  activity,
  detail,
  loading,
  totalCases,
  isOnHappyPath,
  onClose,
}: {
  activity: GraphActivity;
  detail: ActivityDetail | null;
  loading: boolean;
  totalCases: number;
  isOnHappyPath: boolean;
  onClose: () => void;
}) {
  const accent = isOnHappyPath ? "#1A5AFF" : "#5C6E84";
  const tagBg = isOnHappyPath ? "rgba(26,90,255,0.04)" : "#FAFBFC";

  const pctOfCases = detail && detail.totalCases > 0 ? (detail.caseCount / detail.totalCases) * 100 : 0;
  const eventsPerCase = detail && detail.caseCount > 0 ? detail.eventCount / detail.caseCount : 0;
  const positionPct = detail?.positionInCase.avgPctThroughCase !== null && detail?.positionInCase.avgPctThroughCase !== undefined
    ? Math.round(detail.positionInCase.avgPctThroughCase * 100)
    : null;

  const totalActorEvents = detail?.actors.reduce((s, a) => s + a.count, 0) ?? 0;
  const totalSystemEvents = detail?.systems.reduce((s, x) => s + x.count, 0) ?? 0;

  return (
    <div style={{
      position: "absolute", top: 12, right: 12, bottom: 12, zIndex: 30,
      width: 380, background: "#fff",
      border: "1px solid #DDE3EC", borderRadius: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #EEF2F8",
        background: tagBg,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, marginBottom: 4 }}>
            {isOnHappyPath ? "Activity · Happy path" : "Activity"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", lineHeight: 1.3 }}>
            {activity.name}
          </div>
          <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 4 }}>
            {totalCases > 0 ? (
              <>Touches <strong style={{ color: "#001C3D" }}>{activity.caseCount.toLocaleString()}</strong> of {totalCases.toLocaleString()} cases</>
            ) : "—"}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 18, color: "#9AAABB", padding: "0 4px", lineHeight: 1,
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {loading && (
          <div style={{ fontSize: 11, color: "#9AAABB", textAlign: "center", padding: "20px 0" }}>
            Loading activity detail…
          </div>
        )}

        {!loading && detail && (
          <>
            {/* Activity metrics */}
            <Section title="Activity metrics">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Stat label="Cases" value={detail.caseCount.toLocaleString()} sub={`${pctOfCases.toFixed(1)}% of total`} />
                <Stat label="Events" value={detail.eventCount.toLocaleString()} sub={eventsPerCase > 1.05 ? `${eventsPerCase.toFixed(2)} per case (rework)` : "1 per case (no loops)"} />
                <Stat label="Avg time at activity" value={detail.durationMs.avg !== null ? formatDuration(detail.durationMs.avg) : "—"} />
                <Stat label="Median · max" value={detail.durationMs.median !== null && detail.durationMs.max !== null ? `${formatDuration(detail.durationMs.median)} · ${formatDuration(detail.durationMs.max)}` : "—"} />
                {positionPct !== null && (
                  <Stat label="Position in case" value={`${positionPct}%`} sub="avg through the journey" />
                )}
                {detail.positionInCase.avgEventIndex !== null && (
                  <Stat label="Avg event #" value={`#${(detail.positionInCase.avgEventIndex + 1).toFixed(1)}`} />
                )}
              </div>
            </Section>

            {/* Applications */}
            <Section title="Applications involved" hint={detail.systems.length > 0 ? `${detail.systems.length} system${detail.systems.length !== 1 ? "s" : ""}` : undefined}>
              {detail.systems.length === 0 ? (
                <div style={{ fontSize: 11, color: "#9AAABB" }}>No system info on these events.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {detail.systems.map((s) => {
                    const pct = totalSystemEvents > 0 ? (s.count / totalSystemEvents) * 100 : 0;
                    return (
                      <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                        <span style={{ flex: 1, color: "#001C3D", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                        <div style={{ flex: 1.5, height: 6, background: "#EEF2F8", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#1A5AFF" }} />
                        </div>
                        <span style={{ width: 56, textAlign: "right", fontFamily: "monospace", color: "#5C6E84" }}>
                          {s.count} · {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Actors — explicit handling of the "no actor data" case */}
            {(() => {
              const realActors = detail.actors.filter((a) => a.name !== "(unknown)");
              const unknownCount = detail.actors.find((a) => a.name === "(unknown)")?.count ?? 0;
              const hasAnyRealActors = realActors.length > 0;
              const allUnknown = !hasAnyRealActors && detail.actors.length > 0;
              const hasNoActorData = detail.actors.length === 0 || allUnknown;
              const unknownPct = totalActorEvents > 0 ? (unknownCount / totalActorEvents) * 100 : 0;
              const realActorEvents = totalActorEvents - unknownCount;

              if (hasNoActorData) {
                return (
                  <Section title="Actors performing this activity">
                    <div style={{ padding: 10, borderRadius: 8, background: "#FAFBFC", border: "1px dashed #DDE3EC" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#5C6E84", marginBottom: 4 }}>
                        No actor identified
                      </div>
                      <div style={{ fontSize: 10, color: "#9AAABB", lineHeight: 1.5 }}>
                        The uploaded data does not include an actor / user / performed-by column for these events. Common in bank exports — the field may be absent in the source system, anonymised for GDPR, or only captured at service-account level.
                      </div>
                    </div>
                  </Section>
                );
              }

              return (
                <Section title="Actors performing this activity" hint={`${realActors.length} distinct actor${realActors.length !== 1 ? "s" : ""}${unknownCount > 0 ? ` · ${unknownPct.toFixed(0)}% unattributed` : ""}`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {realActors.map((a) => {
                      const pct = realActorEvents > 0 ? (a.count / realActorEvents) * 100 : 0;
                      return (
                        <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                          <span style={{ flex: 1, color: "#001C3D", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                          <div style={{ flex: 1.5, height: 6, background: "#EEF2F8", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "#26BC71" }} />
                          </div>
                          <span style={{ width: 56, textAlign: "right", fontFamily: "monospace", color: "#5C6E84" }}>
                            {a.count} · {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {unknownCount > 0 && (
                    <div style={{ marginTop: 6, fontSize: 10, color: "#B07800", fontStyle: "italic" }}>
                      {unknownCount.toLocaleString()} of {totalActorEvents.toLocaleString()} events ({unknownPct.toFixed(0)}%) had no actor recorded — actor analysis is partial.
                    </div>
                  )}
                </Section>
              );
            })()}

            {/* Where cases come from / go to */}
            <Section title="Flow connections">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Came from</div>
                  {detail.inbound.length === 0 ? (
                    <div style={{ fontSize: 10, color: "#9AAABB" }}>—</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {detail.inbound.map((x, i) => (
                        <div key={i} style={{ fontSize: 10, color: "#374D6C", lineHeight: 1.4 }}>
                          <span style={{ color: "#9AAABB" }}>↑</span> {x.from} <span style={{ color: "#9AAABB", fontFamily: "monospace" }}>· {x.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Goes to</div>
                  {detail.outbound.length === 0 ? (
                    <div style={{ fontSize: 10, color: "#9AAABB" }}>—</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {detail.outbound.map((x, i) => (
                        <div key={i} style={{ fontSize: 10, color: "#374D6C", lineHeight: 1.4 }}>
                          <span style={{ color: "#9AAABB" }}>↓</span> {x.to} <span style={{ color: "#9AAABB", fontFamily: "monospace" }}>· {x.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* Example case IDs */}
            {detail.exampleCaseIds.length > 0 && (
              <Section title="Example cases">
                <div style={{ fontSize: 10, color: "#5C6E84", fontFamily: "monospace", lineHeight: 1.6, wordBreak: "break-all" }}>
                  {detail.exampleCaseIds.join(", ")}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
