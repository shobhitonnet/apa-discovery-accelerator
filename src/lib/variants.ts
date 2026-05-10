import { prisma } from "@/lib/db";

export type Variant = {
  rank: number;
  signature: string;
  activities: string[];
  caseCount: number;
  pct: number;
  avgCycleHours: number;
  caseIdsSample: string[]; // up to 8 representative case IDs
};

export type VariantsSummary = {
  computed: boolean;
  totalCases: number;
  totalEvents: number;
  totalVariants: number;
  topVariants: Variant[];
  longTailVariants: number;
  longTailCases: number;
};

const TOP_N = 7;

export async function getVariantsSummary(processId: string): Promise<VariantsSummary> {
  const events = await prisma.eventLog.findMany({
    where: { processId },
    select: { caseId: true, activity: true, timestamp: true },
    orderBy: [{ caseId: "asc" }, { timestamp: "asc" }],
  });

  if (events.length === 0) {
    return {
      computed: false,
      totalCases: 0,
      totalEvents: 0,
      totalVariants: 0,
      topVariants: [],
      longTailVariants: 0,
      longTailCases: 0,
    };
  }

  // Group events into cases
  type Case = { caseId: string; activities: string[]; firstTs: Date; lastTs: Date };
  const casesById = new Map<string, Case>();
  for (const e of events) {
    let c = casesById.get(e.caseId);
    if (!c) {
      c = { caseId: e.caseId, activities: [], firstTs: e.timestamp, lastTs: e.timestamp };
      casesById.set(e.caseId, c);
    }
    c.activities.push(e.activity);
    if (e.timestamp < c.firstTs) c.firstTs = e.timestamp;
    if (e.timestamp > c.lastTs) c.lastTs = e.timestamp;
  }

  // Group cases by signature (activity sequence)
  type Bucket = { signature: string; activities: string[]; cases: Case[]; cycleHoursTotal: number };
  const buckets = new Map<string, Bucket>();
  for (const c of casesById.values()) {
    const signature = c.activities.join(" → ");
    let b = buckets.get(signature);
    if (!b) {
      b = { signature, activities: c.activities.slice(), cases: [], cycleHoursTotal: 0 };
      buckets.set(signature, b);
    }
    b.cases.push(c);
    b.cycleHoursTotal += (c.lastTs.getTime() - c.firstTs.getTime()) / 3600_000;
  }

  // Rank by case count
  const ranked = Array.from(buckets.values()).sort((a, b) => b.cases.length - a.cases.length);

  const totalCases = casesById.size;
  const top = ranked.slice(0, TOP_N).map<Variant>((b, i) => ({
    rank: i + 1,
    signature: b.signature,
    activities: b.activities,
    caseCount: b.cases.length,
    pct: (b.cases.length / totalCases) * 100,
    avgCycleHours: b.cases.length > 0 ? b.cycleHoursTotal / b.cases.length : 0,
    caseIdsSample: b.cases.slice(0, 8).map((c) => c.caseId),
  }));

  const longTail = ranked.slice(TOP_N);
  const longTailCases = longTail.reduce((s, b) => s + b.cases.length, 0);

  return {
    computed: true,
    totalCases,
    totalEvents: events.length,
    totalVariants: ranked.length,
    topVariants: top,
    longTailVariants: longTail.length,
    longTailCases,
  };
}
