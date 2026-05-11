// Pure types + constants for the process graph — safe to import from client components.
// (The server-only logic that talks to Prisma lives in processGraph.ts.)

export const START_NODE = "__START__";
export const END_NODE = "__END__";

// Case outcome — derived heuristically from the last activity in each case.
// Drives the Outcome filter in the Process Explorer.
export type Outcome = "approved" | "declined" | "withdrawn" | "in_progress";
export const ALL_OUTCOMES: Outcome[] = ["approved", "declined", "withdrawn", "in_progress"];

export type OutcomeCounts = Record<Outcome, number>;

export const ZERO_OUTCOME_COUNTS: OutcomeCounts = {
  approved: 0,
  declined: 0,
  withdrawn: 0,
  in_progress: 0,
};

// Case duration bucket — quartiles computed across all cases in this process.
// "fastest" = bottom quartile, "slowest" = top quartile.
export type DurationBucket = "fastest_25" | "q2" | "q3" | "slowest_25";
export const ALL_DURATION_BUCKETS: DurationBucket[] = ["fastest_25", "q2", "q3", "slowest_25"];

export type DurationCounts = Record<DurationBucket, number>;
export const ZERO_DURATION_COUNTS: DurationCounts = { fastest_25: 0, q2: 0, q3: 0, slowest_25: 0 };

// Conformance bucket — does the case follow the happy path exactly, or deviate?
export type ConformanceBucket = "conforming" | "deviating";
export const ALL_CONFORMANCE_BUCKETS: ConformanceBucket[] = ["conforming", "deviating"];

export type ConformanceCounts = Record<ConformanceBucket, number>;
export const ZERO_CONFORMANCE_COUNTS: ConformanceCounts = { conforming: 0, deviating: 0 };

export type GraphActivity = {
  name: string;
  caseCount: number;
  eventCount: number;
  system: string;
  // Avg time (ms) a case spends at this activity before moving to the next one.
  // Computed as the mean of (next_event.ts - this_event.ts) across cases.
  // null for activities that are the last event in a case (no successor).
  avgDurationToNextMs: number | null;
  // Per-outcome case counts — sums to caseCount across outcomes.
  caseCountByOutcome: OutcomeCounts;
  caseCountByDuration: DurationCounts;
  caseCountByConformance: ConformanceCounts;
};

export type GraphEdge = {
  from: string;
  to: string;
  caseCount: number;
  // Avg time (ms) between source and target activities across the cases that took this edge
  avgDurationMs: number | null;
  // Per-outcome case counts — sums to caseCount across outcomes.
  caseCountByOutcome: OutcomeCounts;
  caseCountByDuration: DurationCounts;
  caseCountByConformance: ConformanceCounts;
};

/** A single bucket in the throughput-time histogram. */
export type DurationHistogramBucket = {
  /** Bucket lower bound, ms inclusive. */
  fromMs: number;
  /** Bucket upper bound, ms exclusive (except for the last bucket which is inclusive). */
  toMs: number;
  /** Cases whose total cycle time fell in this bucket. */
  caseCount: number;
};

export type ProcessGraphSummary = {
  computed: boolean;
  totalCases: number;
  totalEvents: number;
  activities: GraphActivity[];
  edges: GraphEdge[];
  happyPathEdges: Array<{ from: string; to: string }>;
  // Engagement-wide outcome breakdown — total cases per outcome.
  outcomeBreakdown: OutcomeCounts;
  // Engagement-wide duration breakdown + thresholds (ms) used to bucket cases.
  durationBreakdown: DurationCounts;
  durationQuartiles: { p25Ms: number; p50Ms: number; p75Ms: number };
  // 10-bucket equal-width histogram of case cycle times — for the throughput chart.
  durationHistogram: DurationHistogramBucket[];
  // Engagement-wide conformance breakdown.
  conformanceBreakdown: ConformanceCounts;
  // Earliest / latest case-start timestamps across the dataset (ISO strings).
  caseTimeRange: { earliestIso: string | null; latestIso: string | null };
};
