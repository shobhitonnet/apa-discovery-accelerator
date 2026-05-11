import { prisma } from "@/lib/db";

export type EngagementStats = {
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

/**
 * Load per-engagement stats for workspace / homepage cards.
 * Each call: 4 queries against EventLog + 1 against EngagementProcess.
 */
export async function loadEngagementStats(engagementId: string): Promise<EngagementStats> {
  const [eventCount, processes, distinctCases, cycleAndVariants] = await Promise.all([
    prisma.eventLog.count({ where: { engagementId } }),
    prisma.engagementProcess.findMany({
      where: { engagementId },
      select: { findings: true, processMap: true, dataRequest: true },
    }),
    prisma.eventLog.findMany({
      where: { engagementId },
      select: { caseId: true },
      distinct: ["caseId"],
    }),
    prisma.$queryRaw<Array<{ avg_seconds: number | null; variant_count: bigint }>>`
      WITH per_case AS (
        SELECT
          "caseId",
          MIN(timestamp) AS min_ts,
          MAX(timestamp) AS max_ts,
          array_agg(activity ORDER BY timestamp) AS seq
        FROM "EventLog"
        WHERE "engagementId" = ${engagementId}
        GROUP BY "caseId"
      )
      SELECT
        AVG(EXTRACT(EPOCH FROM (max_ts - min_ts)))::float AS avg_seconds,
        COUNT(DISTINCT seq) AS variant_count
      FROM per_case
    `,
  ]);

  const caseCount = distinctCases.length;
  const avgSeconds = cycleAndVariants[0]?.avg_seconds ?? null;
  const avgCycleDays = avgSeconds !== null ? avgSeconds / 86400 : null;
  const variantCount = Number(cycleAndVariants[0]?.variant_count ?? 0);

  let leakUsd = 0;
  let hasProcessMap = false;
  let hasDataRequest = false;
  let hasFindings = false;
  for (const p of processes) {
    const findings = p.findings as { totalAnnualValueLeak?: number } | null;
    if (findings?.totalAnnualValueLeak) {
      leakUsd += findings.totalAnnualValueLeak;
      hasFindings = true;
    }
    const pm = p.processMap as { nodes?: unknown[] } | null;
    if (pm?.nodes?.length) hasProcessMap = true;
    if (p.dataRequest) hasDataRequest = true;
  }

  return {
    caseCount,
    eventCount,
    variantCount,
    avgCycleDays,
    leakUsd,
    processCount: processes.length,
    hasProcessMap,
    hasDataRequest,
    hasFindings,
  };
}

/**
 * Aggregate stats across all engagements — for the pulse strip / hero stats.
 */
export async function loadGlobalStats() {
  const [eventCount, engagementCount, processes, distinctCases, variantSum] = await Promise.all([
    prisma.eventLog.count(),
    prisma.engagement.count(),
    prisma.engagementProcess.findMany({ select: { processMap: true, findings: true } }),
    prisma.eventLog.findMany({ select: { caseId: true }, distinct: ["caseId"] }),
    prisma.$queryRaw<Array<{ variant_count: bigint }>>`
      SELECT COUNT(DISTINCT seq) AS variant_count
      FROM (
        SELECT array_agg(activity ORDER BY timestamp) AS seq
        FROM "EventLog"
        GROUP BY "engagementId", "caseId"
      ) sub
    `,
  ]);

  let leakUsd = 0;
  let processesMapped = 0;
  for (const p of processes) {
    const findings = p.findings as { totalAnnualValueLeak?: number } | null;
    if (findings?.totalAnnualValueLeak) leakUsd += findings.totalAnnualValueLeak;
    const pm = p.processMap as { nodes?: unknown[] } | null;
    if (pm?.nodes?.length) processesMapped++;
  }

  return {
    engagementCount,
    processesMapped,
    eventCount,
    caseCount: distinctCases.length,
    variantCount: Number(variantSum[0]?.variant_count ?? 0),
    leakUsd,
  };
}
