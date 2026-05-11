import { prisma } from "@/lib/db";
import {
  START_NODE, END_NODE, ZERO_OUTCOME_COUNTS, ZERO_DURATION_COUNTS, ZERO_CONFORMANCE_COUNTS,
  type GraphActivity, type GraphEdge, type ProcessGraphSummary,
  type Outcome, type OutcomeCounts, type DurationBucket, type DurationCounts,
  type ConformanceBucket, type ConformanceCounts,
} from "@/lib/processGraph.types";

export { START_NODE, END_NODE };
export type { GraphActivity, GraphEdge, ProcessGraphSummary };

// Heuristic outcome classifier — derived from the last activity in each case.
function classifyOutcome(lastActivity: string): Outcome {
  const a = lastActivity.toLowerCase();
  if (/(reject|declin|deny|fail)/i.test(a)) return "declined";
  if (/(withdraw|abandon|cancel|expir|drop)/i.test(a)) return "withdrawn";
  if (/(approv|grant|accept|fund|complete|welcom|onboard|account[\s_]*open|deposit|disburs|issu)/i.test(a)) return "approved";
  return "in_progress";
}

const cloneOutcomeCounts = (): OutcomeCounts => ({ ...ZERO_OUTCOME_COUNTS });
const cloneDurationCounts = (): DurationCounts => ({ ...ZERO_DURATION_COUNTS });
const cloneConformanceCounts = (): ConformanceCounts => ({ ...ZERO_CONFORMANCE_COUNTS });

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? rest * (sorted[base + 1] - sorted[base]) : 0);
}

function durationBucketFor(durationMs: number, p25: number, p50: number, p75: number): DurationBucket {
  if (durationMs <= p25) return "fastest_25";
  if (durationMs <= p50) return "q2";
  if (durationMs <= p75) return "q3";
  return "slowest_25";
}

function emptySummary(earliest: Date | null, latest: Date | null): ProcessGraphSummary {
  return {
    computed: false,
    totalCases: 0,
    totalEvents: 0,
    activities: [],
    edges: [],
    happyPathEdges: [],
    outcomeBreakdown: cloneOutcomeCounts(),
    durationBreakdown: cloneDurationCounts(),
    durationQuartiles: { p25Ms: 0, p50Ms: 0, p75Ms: 0 },
    durationHistogram: [],
    conformanceBreakdown: cloneConformanceCounts(),
    caseTimeRange: {
      earliestIso: earliest ? earliest.toISOString() : null,
      latestIso: latest ? latest.toISOString() : null,
    },
  };
}

/** Build a 10-bucket equal-width histogram of case cycle times. */
function buildDurationHistogram(durations: number[]): Array<{ fromMs: number; toMs: number; caseCount: number }> {
  if (durations.length === 0) return [];
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  if (max === min) {
    return [{ fromMs: min, toMs: max, caseCount: durations.length }];
  }
  const N = 10;
  const width = (max - min) / N;
  const buckets = Array.from({ length: N }, (_, i) => ({
    fromMs: min + i * width,
    toMs: min + (i + 1) * width,
    caseCount: 0,
  }));
  for (const d of durations) {
    let idx = Math.floor((d - min) / width);
    if (idx >= N) idx = N - 1; // include the max in the last bucket
    if (idx < 0) idx = 0;
    buckets[idx].caseCount++;
  }
  return buckets;
}

export async function getProcessGraph(
  processId: string,
  filter?: { fromDate?: Date | null; toDate?: Date | null }
): Promise<ProcessGraphSummary> {
  const events = await prisma.eventLog.findMany({
    where: { processId },
    select: { caseId: true, activity: true, system: true, timestamp: true },
    orderBy: [{ caseId: "asc" }, { timestamp: "asc" }],
  });

  if (events.length === 0) return emptySummary(null, null);

  // Group events by case. Sequence order is timestamp-ascending due to query orderBy.
  type CaseEvent = { activity: string; system: string; timestamp: Date };
  const caseSequencesAll = new Map<string, CaseEvent[]>();
  for (const e of events) {
    let seq = caseSequencesAll.get(e.caseId);
    if (!seq) { seq = []; caseSequencesAll.set(e.caseId, seq); }
    seq.push({ activity: e.activity, system: e.system, timestamp: e.timestamp });
  }

  // Time-period filter — keep only cases whose START timestamp falls in the window.
  const fromMs = filter?.fromDate?.getTime() ?? -Infinity;
  const toMs = filter?.toDate?.getTime() ?? Infinity;
  const caseSequences = new Map<string, CaseEvent[]>();
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const [caseId, seq] of caseSequencesAll) {
    const start = seq[0].timestamp;
    if (earliest === null || start < earliest) earliest = start;
    if (latest === null || start > latest) latest = start;
    if (start.getTime() >= fromMs && start.getTime() <= toMs) {
      caseSequences.set(caseId, seq);
    }
  }

  if (caseSequences.size === 0) return emptySummary(earliest, latest);

  // Per-activity stats
  type ActivityStats = {
    caseSet: Set<string>;
    eventCount: number;
    systemCounts: Map<string, number>;
    durationsToNextMs: number[];
    caseCountByOutcome: OutcomeCounts;
    caseCountByDuration: DurationCounts;
    caseCountByConformance: ConformanceCounts;
  };
  const actStats = new Map<string, ActivityStats>();

  // Edge stats
  type EdgeStats = {
    caseSet: Set<string>;
    durationsMs: number[];
    caseCountByOutcome: OutcomeCounts;
    caseCountByDuration: DurationCounts;
    caseCountByConformance: ConformanceCounts;
  };
  const edgeStats = new Map<string, EdgeStats>();

  const ensureAct = (name: string): ActivityStats => {
    let s = actStats.get(name);
    if (!s) {
      s = {
        caseSet: new Set(),
        eventCount: 0,
        systemCounts: new Map(),
        durationsToNextMs: [],
        caseCountByOutcome: cloneOutcomeCounts(),
        caseCountByDuration: cloneDurationCounts(),
        caseCountByConformance: cloneConformanceCounts(),
      };
      actStats.set(name, s);
    }
    return s;
  };

  const ensureEdge = (key: string): EdgeStats => {
    let s = edgeStats.get(key);
    if (!s) {
      s = {
        caseSet: new Set(),
        durationsMs: [],
        caseCountByOutcome: cloneOutcomeCounts(),
        caseCountByDuration: cloneDurationCounts(),
        caseCountByConformance: cloneConformanceCounts(),
      };
      edgeStats.set(key, s);
    }
    return s;
  };

  // ── Pass 1: build event/edge stats and per-case cycle time ────────────
  const caseOutcome = new Map<string, Outcome>();
  const caseCycleMs = new Map<string, number>();
  const caseDurations: number[] = [];

  for (const [caseId, seq] of caseSequences) {
    for (const e of seq) {
      const stat = ensureAct(e.activity);
      stat.eventCount++;
      stat.systemCounts.set(e.system, (stat.systemCounts.get(e.system) ?? 0) + 1);
    }

    // Edges
    const addEdge = (from: string, to: string, durationMs: number | null) => {
      const s = ensureEdge(`${from}→${to}`);
      s.caseSet.add(caseId);
      if (durationMs !== null && durationMs >= 0) s.durationsMs.push(durationMs);
    };
    addEdge(START_NODE, seq[0].activity, null);
    for (let i = 0; i < seq.length - 1; i++) {
      const dur = seq[i + 1].timestamp.getTime() - seq[i].timestamp.getTime();
      addEdge(seq[i].activity, seq[i + 1].activity, dur);
      const stat = actStats.get(seq[i].activity);
      if (stat && dur >= 0) stat.durationsToNextMs.push(dur);
    }
    addEdge(seq[seq.length - 1].activity, END_NODE, null);

    // Per-case classification (outcome + cycle time)
    const last = seq[seq.length - 1];
    caseOutcome.set(caseId, classifyOutcome(last.activity));
    const cycle = last.timestamp.getTime() - seq[0].timestamp.getTime();
    caseCycleMs.set(caseId, cycle);
    caseDurations.push(cycle);
  }

  // ── Quartile thresholds + per-case duration bucket ───────────────────
  const sortedDurations = [...caseDurations].sort((a, b) => a - b);
  const p25Ms = quantile(sortedDurations, 0.25);
  const p50Ms = quantile(sortedDurations, 0.50);
  const p75Ms = quantile(sortedDurations, 0.75);

  const caseDurationBucket = new Map<string, DurationBucket>();
  for (const [caseId, cycle] of caseCycleMs) {
    caseDurationBucket.set(caseId, durationBucketFor(cycle, p25Ms, p50Ms, p75Ms));
  }

  // ── Happy path — most-frequent outbound from each node ────────────────
  const happyPathSet = new Set<string>();
  const outboundByNode = new Map<string, Array<{ to: string; caseCount: number }>>();
  for (const [key, stats] of edgeStats) {
    const [from, to] = key.split("→");
    let arr = outboundByNode.get(from);
    if (!arr) { arr = []; outboundByNode.set(from, arr); }
    arr.push({ to, caseCount: stats.caseSet.size });
  }
  for (const [from, outs] of outboundByNode) {
    const top = outs.sort((a, b) => b.caseCount - a.caseCount)[0];
    if (top) happyPathSet.add(`${from}→${top.to}`);
  }

  // ── Per-case conformance ─────────────────────────────────────────────
  const caseConformance = new Map<string, ConformanceBucket>();
  const conformanceBreakdown = cloneConformanceCounts();
  for (const [caseId, seq] of caseSequences) {
    let onHappy = happyPathSet.has(`${START_NODE}→${seq[0].activity}`);
    for (let i = 0; i < seq.length - 1 && onHappy; i++) {
      if (!happyPathSet.has(`${seq[i].activity}→${seq[i + 1].activity}`)) onHappy = false;
    }
    if (onHappy && !happyPathSet.has(`${seq[seq.length - 1].activity}→${END_NODE}`)) onHappy = false;
    const bucket: ConformanceBucket = onHappy ? "conforming" : "deviating";
    caseConformance.set(caseId, bucket);
    conformanceBreakdown[bucket]++;
  }

  // ── Pass 2: tally per-classification counts on activities & edges ────
  const outcomeBreakdown = cloneOutcomeCounts();
  const durationBreakdown = cloneDurationCounts();

  for (const [caseId, seq] of caseSequences) {
    const o = caseOutcome.get(caseId)!;
    const d = caseDurationBucket.get(caseId)!;
    const c = caseConformance.get(caseId)!;
    outcomeBreakdown[o]++;
    durationBreakdown[d]++;

    const visitedActs = new Set<string>();
    for (const ev of seq) visitedActs.add(ev.activity);
    for (const act of visitedActs) {
      const stat = actStats.get(act)!;
      stat.caseSet.add(caseId);
      stat.caseCountByOutcome[o]++;
      stat.caseCountByDuration[d]++;
      stat.caseCountByConformance[c]++;
    }
  }

  // For edges, the caseSet was already populated in pass 1 — walk it once.
  for (const [, stats] of edgeStats) {
    for (const caseId of stats.caseSet) {
      const o = caseOutcome.get(caseId);
      const d = caseDurationBucket.get(caseId);
      const c = caseConformance.get(caseId);
      if (o) stats.caseCountByOutcome[o]++;
      if (d) stats.caseCountByDuration[d]++;
      if (c) stats.caseCountByConformance[c]++;
    }
  }

  const mean = (arr: number[]): number | null =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  const activities: GraphActivity[] = Array.from(actStats.entries())
    .map(([name, s]) => {
      const topSystem = Array.from(s.systemCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
      return {
        name,
        caseCount: s.caseSet.size,
        eventCount: s.eventCount,
        system: topSystem,
        avgDurationToNextMs: mean(s.durationsToNextMs),
        caseCountByOutcome: s.caseCountByOutcome,
        caseCountByDuration: s.caseCountByDuration,
        caseCountByConformance: s.caseCountByConformance,
      };
    })
    .sort((a, b) => b.caseCount - a.caseCount);

  const edges: GraphEdge[] = Array.from(edgeStats.entries())
    .map(([key, stats]) => {
      const [from, to] = key.split("→");
      return {
        from, to,
        caseCount: stats.caseSet.size,
        avgDurationMs: mean(stats.durationsMs),
        caseCountByOutcome: stats.caseCountByOutcome,
        caseCountByDuration: stats.caseCountByDuration,
        caseCountByConformance: stats.caseCountByConformance,
      };
    })
    .sort((a, b) => b.caseCount - a.caseCount);

  const happyPathEdges = Array.from(happyPathSet).map((k) => {
    const [from, to] = k.split("→");
    return { from, to };
  });

  return {
    computed: true,
    totalCases: caseSequences.size,
    totalEvents: events.length,
    activities,
    edges,
    happyPathEdges,
    outcomeBreakdown,
    durationBreakdown,
    durationQuartiles: { p25Ms, p50Ms, p75Ms },
    durationHistogram: buildDurationHistogram(caseDurations),
    conformanceBreakdown,
    caseTimeRange: {
      earliestIso: earliest ? earliest.toISOString() : null,
      latestIso: latest ? latest.toISOString() : null,
    },
  };
}
