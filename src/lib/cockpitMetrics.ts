/**
 * Cockpit compute engine — given an engagement-process, walk its metric
 * definitions and compute a value for each:
 *
 * - direct   → computed from the EventLog
 * - inferred → simple formula evaluation using direct metrics + coefficients
 * - assumed  → use the metric's defaultValue
 *
 * Returns a structured result with RAG (red / amber / green) status per metric.
 */

import { prisma } from "@/lib/db";
import { loadRepositoryBundle } from "@/lib/repositoryBootstrap";
import type { MetricDefinition, MetricCategory } from "@/lib/metricTypes";

export type CockpitMetric = {
  key: string;
  label: string;
  category: MetricCategory;
  source: "direct" | "inferred" | "assumed";
  unit: string;
  description: string;
  value: number | null;
  formattedValue: string;
  status: "green" | "amber" | "red" | "neutral";
  thresholdInfo?: string;
  computable: boolean;
  /** True when this assumed metric has been overridden for this engagement */
  isOverridden?: boolean;
  /** The template default (shown when overridden, so consultant sees the diff) */
  defaultValue?: number | null;
};

export type CockpitResult = {
  generatedAt: string;
  computed: boolean;
  reason?: string;
  totals: {
    cases: number;
    events: number;
    variants: number;
    systems: number;
    activities: number;
  };
  metricsByCategory: Record<MetricCategory, CockpitMetric[]>;
};

// ──────────────────────────────────────────────────────────────────────────
// Compute context — built once per cockpit load
// ──────────────────────────────────────────────────────────────────────────

type CaseInfo = {
  caseId: string;
  activities: string[];
  firstTs: Date;
  lastTs: Date;
  reworkSeen: boolean;
  channels: Set<string>;
  outcomes: Set<string>;
  fraudPositive: boolean;
  hasManualReview: boolean;
  reachedAccountCreation: boolean;
  // Per-activity first-occurrence timestamp
  firstByActivity: Map<string, Date>;
};

type ComputeContext = {
  totalCases: number;
  totalEvents: number;
  variantCount: number;
  systemCount: number;
  activityCount: number;
  leadTimes: number[];           // per case, ms
  caseInfos: CaseInfo[];
  reworkCases: number;
  happyPathCases: number;
  // Outcome counts
  approvedCount: number;
  declinedCount: number;
  abandonedCount: number;        // cases that didn't reach "create" / "complete" / final activity
  // Channel mix
  digitalChannelCases: number;
  branchChannelCases: number;
  channelByName: Map<string, number>;
  // Fraud / AML
  fraudPositiveCases: number;
  amlFailureCases: number;
  // Manual review
  manualReviewCases: number;
  // Monthly volumes
  casesByMonth: Map<string, number>;  // "YYYY-MM" -> count
  // Per-activity case counts (already in graph but useful here)
  caseCountByActivity: Map<string, number>;
  // Coefficient lookup
  coefficients: Record<string, number>;
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function unitFactor(unit: string): number {
  const u = unit.toLowerCase();
  if (u.includes("day"))  return 86400_000;
  if (u.includes("hour")) return 3600_000;
  if (u.includes("min"))  return 60_000;
  if (u.includes("sec"))  return 1000;
  return 1;
}
function formatValue(value: number | null, unit: string): string {
  if (value === null || !isFinite(value)) return "—";
  const u = unit.toLowerCase();
  if (u === "%" || u.includes("percent") || u.includes("pct"))
    return `${value.toFixed(1)}%`;
  if (u.includes("gbp")) return `£${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (u.includes("usd")) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (u.includes("eur")) return `€${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (u.includes("count") || u.includes("cases") || u.includes("events"))
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
}

// Find first-event timestamp per case where the activity matches a regex.
// Returns array of (lastTs - matchTs) deltas in ms.
function timeFromStartTo(ctx: ComputeContext, regex: RegExp): number[] {
  const out: number[] = [];
  for (const c of ctx.caseInfos) {
    let matchTs: Date | null = null;
    for (const [act, ts] of c.firstByActivity) {
      if (regex.test(act)) {
        if (matchTs === null || ts < matchTs) matchTs = ts;
      }
    }
    if (matchTs) {
      out.push(matchTs.getTime() - c.firstTs.getTime());
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Direct metric computers — match by metric key keywords
// ──────────────────────────────────────────────────────────────────────────

const TOUCH_RATIO = 0.18; // banking benchmark: ~15-20% of lead time is active touch

function computeDirect(metric: MetricDefinition, ctx: ComputeContext): number | null {
  const k = metric.key.toLowerCase();

  // ── TIME ────────────────────────────────────────────────────────────────
  // Generic lead/cycle/total/onboarding time
  if (/total.?(onboarding|cycle|process)|onboarding.?time|end.?to.?end/.test(k) ||
      (/lead.?time|cycle.?time/.test(k) && /(avg|average|mean)/.test(k)) ||
      /(avg|mean).?(lead|cycle)/.test(k)) {
    return avg(ctx.leadTimes) / unitFactor(metric.unit);
  }
  if (/lead.?time/.test(k) && /p50|median/.test(k)) return percentile(ctx.leadTimes, 50) / unitFactor(metric.unit);
  if (/lead.?time/.test(k) && /p90/.test(k))         return percentile(ctx.leadTimes, 90) / unitFactor(metric.unit);
  if (/lead.?time/.test(k) && /p99/.test(k))         return percentile(ctx.leadTimes, 99) / unitFactor(metric.unit);

  // KYC time (start → first KYC event)
  if (/kyc.?(processing.?)?time|identity.?(verification.?)?time|aml.?time/.test(k)) {
    const arr = timeFromStartTo(ctx, /(kyc|identity|aml|screen|due.?dilig|verification)/i);
    return arr.length > 0 ? avg(arr) / unitFactor(metric.unit) : null;
  }

  // Credit decision time
  if (/credit.?(decision|check).?time|decision.?time/.test(k)) {
    const arr = timeFromStartTo(ctx, /(credit|decision|underwrit|approval|review)/i);
    if (arr.length === 0) return null;
    if (/p90/.test(k))      return percentile(arr, 90) / unitFactor(metric.unit);
    if (/p99/.test(k))      return percentile(arr, 99) / unitFactor(metric.unit);
    if (/p50|median/.test(k)) return percentile(arr, 50) / unitFactor(metric.unit);
    return avg(arr) / unitFactor(metric.unit);
  }

  // Manual review wait time
  if (/manual.?review.?(wait|time)|escalat.?(wait|time)/.test(k)) {
    const arr = timeFromStartTo(ctx, /(manual|review|escalat|exception)/i);
    return arr.length > 0 ? avg(arr) / unitFactor(metric.unit) : null;
  }

  // Customer touch time — heuristic: events × 5 min per event
  if (/customer.?touch|touch.?time/.test(k) && /(time|min|hour)/.test(k)) {
    const perCaseTouchMs = (ctx.totalEvents / Math.max(1, ctx.totalCases)) * 5 * 60_000;
    return perCaseTouchMs / unitFactor(metric.unit);
  }

  // Process / wait time using touch-ratio heuristic (real touch time isn't measurable from event log alone)
  if (/process.?time|touch.?time/.test(k) && /(avg|average|mean)/.test(k)) {
    return (avg(ctx.leadTimes) * TOUCH_RATIO) / unitFactor(metric.unit);
  }
  if (/wait.?time|idle.?time/.test(k) && /(avg|average|mean)/.test(k)) {
    return (avg(ctx.leadTimes) * (1 - TOUCH_RATIO)) / unitFactor(metric.unit);
  }
  if (/cycle.?efficiency|flow.?efficiency/.test(k)) {
    return TOUCH_RATIO * 100; // expressed as %
  }

  // ── QUALITY ─────────────────────────────────────────────────────────────
  if (/stp|straight.?through|first.?time.?right/.test(k)) {
    return ctx.totalCases > 0 ? ((ctx.totalCases - ctx.reworkCases) / ctx.totalCases) * 100 : null;
  }
  if (/conformance/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.happyPathCases / ctx.totalCases) * 100 : null;
  }
  if (/rework.?rate/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.reworkCases / ctx.totalCases) * 100 : null;
  }
  if (/variant.?count|variants?$/.test(k)) return ctx.variantCount;
  if (/document.?(rejection|reject).?rate|doc.?reject/.test(k)) {
    // Doc rejection ≈ rework rate as a banking proxy
    return ctx.totalCases > 0 ? (ctx.reworkCases / ctx.totalCases) * 100 : null;
  }

  // ── OUTCOME ─────────────────────────────────────────────────────────────
  if (/approval.?rate|approved.?rate|application.?approval/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.approvedCount / ctx.totalCases) * 100 : null;
  }
  if (/decline.?rate|reject.?rate|application.?reject/.test(k) && !/document/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.declinedCount / ctx.totalCases) * 100 : null;
  }
  if (/abandon|drop.?off|dropout|incomplete/.test(k) && /rate|score/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.abandonedCount / ctx.totalCases) * 100 : null;
  }
  if (/completion.?rate/.test(k)) {
    const completed = ctx.caseInfos.filter((c) => c.reachedAccountCreation).length;
    return ctx.totalCases > 0 ? (completed / ctx.totalCases) * 100 : null;
  }

  // ── COST ────────────────────────────────────────────────────────────────
  if (/total.?fte.?hours|fte.?hours.?per.?case/.test(k)) {
    return (avg(ctx.leadTimes) * TOUCH_RATIO) / 3600_000;
  }
  if (/cost.?per.?(case|onboarding)/.test(k)) {
    const rate = ctx.coefficients["fte_ops_hourly_rate"] ?? ctx.coefficients["fte_hourly_rate"] ?? 0;
    if (rate === 0) return null;
    const hoursPerCase = (avg(ctx.leadTimes) * TOUCH_RATIO) / 3600_000;
    return hoursPerCase * rate;
  }
  if (/blended.?(hourly|rate)|fte.?(hourly|rate)/.test(k)) {
    return ctx.coefficients["fte_ops_hourly_rate"] ?? ctx.coefficients["fte_hourly_rate"] ?? null;
  }

  // ── CX ──────────────────────────────────────────────────────────────────
  if (/touchpoints|events.?per.?case/.test(k)) {
    return ctx.totalCases > 0 ? ctx.totalEvents / ctx.totalCases : null;
  }
  if (/dropout.?(by.?stage|stage)|stage.?drop/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.abandonedCount / ctx.totalCases) * 100 : null;
  }
  if (/customer.?effort.?score|cx.?effort|effort.?score/.test(k)) {
    // Composite proxy: touchpoints × log(wait days)
    const touchpoints = ctx.totalCases > 0 ? ctx.totalEvents / ctx.totalCases : 0;
    const waitDays = (avg(ctx.leadTimes) * (1 - TOUCH_RATIO)) / 86400_000;
    return touchpoints * Math.log(Math.max(1, waitDays + 1));
  }

  // ── WORKFORCE ───────────────────────────────────────────────────────────
  if (/advisor.?handling.?time|handling.?time.?per.?(role|advisor)|avg.?handling/.test(k)) {
    // Heuristic: touch_time / events_per_case_per_actor (assume 1 actor per case)
    const perCaseTouchMs = avg(ctx.leadTimes) * TOUCH_RATIO;
    const eventsPerCase = ctx.totalCases > 0 ? ctx.totalEvents / ctx.totalCases : 1;
    return (perCaseTouchMs / Math.max(1, eventsPerCase)) / unitFactor(metric.unit);
  }
  if (/cases.?per.?(advisor|fte).?(per.?day|daily)/.test(k)) {
    // Heuristic: assume 8h working day, touch hours per case → cases per day per advisor
    const touchHoursPerCase = (avg(ctx.leadTimes) * TOUCH_RATIO) / 3600_000;
    return touchHoursPerCase > 0 ? 8 / touchHoursPerCase : null;
  }
  if (/bottleneck/.test(k)) {
    // Bottleneck factor: max activity caseCount / mean activity caseCount (above 1 means uneven workload)
    const counts = Array.from(ctx.caseCountByActivity.values());
    if (counts.length === 0) return null;
    const max = Math.max(...counts);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    return mean > 0 ? max / mean : null;
  }

  // ── COMPLIANCE ──────────────────────────────────────────────────────────
  if (/aml.?(screening.?)?(failure|fail).?rate/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.amlFailureCases / ctx.totalCases) * 100 : null;
  }
  if (/fraud.?(detection|positive).?rate/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.fraudPositiveCases / ctx.totalCases) * 100 : null;
  }
  if (/regulatory.?reporting|gate.?(failure|fail)/.test(k)) {
    // Proxy: % of cases hitting compliance / audit-related extra steps
    const auditCases = ctx.caseInfos.filter((c) => c.activities.some((a) => /(audit|review|compliance|escalat)/i.test(a))).length;
    return ctx.totalCases > 0 ? (auditCases / ctx.totalCases) * 100 : null;
  }

  // ── VOLUME ──────────────────────────────────────────────────────────────
  if (/total.?cases|case.?count/.test(k)) return ctx.totalCases;
  if (/total.?events|event.?count/.test(k)) return ctx.totalEvents;
  if (/monthly.?(onboarding.?)?volume|cases.?per.?month/.test(k)) {
    if (ctx.casesByMonth.size === 0) return null;
    return Array.from(ctx.casesByMonth.values()).reduce((a, b) => a + b, 0) / ctx.casesByMonth.size;
  }
  if (/digital.?channel.?adoption|digital.?adoption/.test(k)) {
    return ctx.totalCases > 0 ? (ctx.digitalChannelCases / ctx.totalCases) * 100 : null;
  }
  if (/digital.?vs.?branch|channel.?ratio|channel.?mix/.test(k)) {
    const total = ctx.digitalChannelCases + ctx.branchChannelCases;
    return total > 0 ? (ctx.digitalChannelCases / total) * 100 : null;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Inferred — try direct first; otherwise compute from formulas
// ──────────────────────────────────────────────────────────────────────────

function computeInferred(metric: MetricDefinition, ctx: ComputeContext, allComputed: Map<string, number | null>): number | null {
  const direct = computeDirect(metric, ctx);
  if (direct !== null) return direct;

  const lookup = (key: string): number | null => {
    if (allComputed.has(key)) return allComputed.get(key) ?? null;
    if (key in ctx.coefficients) return ctx.coefficients[key];
    return null;
  };
  const k = metric.key.toLowerCase();

  if (/cost.?per.?(onboarding|case)/.test(k)) {
    const rate = lookup("fte_ops_hourly_rate") ?? lookup("fte_hourly_rate") ?? 0;
    if (rate === 0) return null;
    const hoursPerCase = (avg(ctx.leadTimes) * TOUCH_RATIO) / 3600_000;
    return hoursPerCase * rate;
  }
  if (/annual.?cost/.test(k)) {
    const costPerCase = lookup("cost_per_case") ?? lookup("cost_per_onboarding") ?? null;
    const casesPerYear = lookup("applications_per_year") ?? lookup("monthly_onboarding_volume") ?? null;
    if (costPerCase === null || casesPerYear === null) return null;
    const yearMultiplier = lookup("monthly_onboarding_volume") ? 12 : 1;
    return costPerCase * casesPerYear * yearMultiplier;
  }
  if (/customer.?effort.?score/.test(k)) {
    const touchpoints = ctx.totalCases > 0 ? ctx.totalEvents / ctx.totalCases : 0;
    const waitDays = (avg(ctx.leadTimes) * (1 - TOUCH_RATIO)) / 86400_000;
    return touchpoints * Math.log(Math.max(1, waitDays + 1));
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// RAG status
// ──────────────────────────────────────────────────────────────────────────

function evaluateStatus(value: number | null, m: MetricDefinition): { status: CockpitMetric["status"]; thresholdInfo?: string } {
  if (value === null) return { status: "neutral" };
  if (m.goodThreshold === undefined && m.poorThreshold === undefined) return { status: "neutral" };

  const lower = m.direction !== "higher_is_better";
  let status: CockpitMetric["status"] = "amber";
  if (lower) {
    if (m.goodThreshold !== undefined && value <= m.goodThreshold) status = "green";
    else if (m.poorThreshold !== undefined && value >= m.poorThreshold) status = "red";
  } else {
    if (m.goodThreshold !== undefined && value >= m.goodThreshold) status = "green";
    else if (m.poorThreshold !== undefined && value <= m.poorThreshold) status = "red";
  }
  const thresholdInfo = lower
    ? `Target ≤ ${m.goodThreshold ?? "—"} ${m.unit}, poor ≥ ${m.poorThreshold ?? "—"}`
    : `Target ≥ ${m.goodThreshold ?? "—"} ${m.unit}, poor ≤ ${m.poorThreshold ?? "—"}`;
  return { status, thresholdInfo };
}

// ──────────────────────────────────────────────────────────────────────────
// Main entry
// ──────────────────────────────────────────────────────────────────────────

const EMPTY_CATEGORIES: Record<MetricCategory, CockpitMetric[]> = {
  time: [], volume: [], quality: [], outcome: [],
  cost: [], cx: [], workforce: [], compliance: [],
};

export async function computeCockpit(engagementId: string, processId: string): Promise<CockpitResult> {
  const [engagement, process, events] = await Promise.all([
    prisma.engagement.findUnique({ where: { id: engagementId }, select: { country: true, institutionType: true } }),
    prisma.engagementProcess.findUnique({ where: { id: processId, engagementId }, select: { processKey: true, metricOverrides: true } }),
    prisma.eventLog.findMany({
      where: { processId },
      select: { caseId: true, activity: true, timestamp: true, system: true, actor: true, attributes: true },
      orderBy: [{ caseId: "asc" }, { timestamp: "asc" }],
    }),
  ]);

  if (!engagement || !process) {
    return { generatedAt: new Date().toISOString(), computed: false, reason: "Engagement or process not found", totals: { cases: 0, events: 0, variants: 0, systems: 0, activities: 0 }, metricsByCategory: { ...EMPTY_CATEGORIES } };
  }
  if (events.length === 0) {
    return { generatedAt: new Date().toISOString(), computed: false, reason: "Activity table is empty — build it first.", totals: { cases: 0, events: 0, variants: 0, systems: 0, activities: 0 }, metricsByCategory: { ...EMPTY_CATEGORIES } };
  }

  const tplCheck = await prisma.processTemplate.findFirst({
    where: { processKey: process.processKey, isActive: true },
    select: { id: true },
  });
  if (!tplCheck) {
    return {
      generatedAt: new Date().toISOString(), computed: false,
      reason: `No active Process Template found for processKey "${process.processKey}". Go to Admin → Process Repository, create or activate a template for this key, and run Process Explorer Agent.`,
      totals: { cases: 0, events: 0, variants: 0, systems: 0, activities: 0 }, metricsByCategory: { ...EMPTY_CATEGORIES },
    };
  }

  const repository = await loadRepositoryBundle({
    country: engagement.country,
    institutionType: engagement.institutionType,
    processKey: process.processKey,
  });

  // Build context
  const caseMap = new Map<string, CaseInfo>();
  const systems = new Set<string>();
  for (const e of events) {
    let info = caseMap.get(e.caseId);
    if (!info) {
      info = {
        caseId: e.caseId, activities: [], firstTs: e.timestamp, lastTs: e.timestamp,
        reworkSeen: false, channels: new Set(), outcomes: new Set(),
        fraudPositive: false, hasManualReview: false, reachedAccountCreation: false,
        firstByActivity: new Map(),
      };
      caseMap.set(e.caseId, info);
    }
    if (info.activities.includes(e.activity)) info.reworkSeen = true;
    info.activities.push(e.activity);
    if (!info.firstByActivity.has(e.activity)) info.firstByActivity.set(e.activity, e.timestamp);
    if (e.timestamp > info.lastTs) info.lastTs = e.timestamp;
    if (e.timestamp < info.firstTs) info.firstTs = e.timestamp;
    if (/(account.?(open|creat|setup)|provisioning)/i.test(e.activity)) info.reachedAccountCreation = true;
    if (/(manual|review|escalat|exception)/i.test(e.activity)) info.hasManualReview = true;

    // Pull attributes
    const attrs = (e.attributes ?? {}) as Record<string, unknown>;
    for (const [key, val] of Object.entries(attrs)) {
      const sk = key.toLowerCase();
      const sv = String(val).toLowerCase();
      if (/channel/.test(sk)) info.channels.add(sv);
      if (/outcome|status|decision|result/.test(sk)) info.outcomes.add(sv);
      if (/fraud|cifas/.test(sk) && /(positive|hit|true|yes|fraud)/.test(sv)) info.fraudPositive = true;
    }
    systems.add(e.system);
  }

  // Aggregate
  const caseInfos = Array.from(caseMap.values());
  const leadTimes = caseInfos.map((c) => c.lastTs.getTime() - c.firstTs.getTime());
  const reworkCases = caseInfos.filter((c) => c.reworkSeen).length;
  const sigCounts = new Map<string, number>();
  for (const c of caseInfos) {
    const sig = c.activities.join("→");
    sigCounts.set(sig, (sigCounts.get(sig) ?? 0) + 1);
  }
  const happyPathCases = sigCounts.size > 0 ? Math.max(...sigCounts.values()) : 0;

  // Outcomes from attributes + activity names
  let approvedCount = 0, declinedCount = 0, abandonedCount = 0;
  let digitalCases = 0, branchCases = 0;
  const channelByName = new Map<string, number>();
  let fraudPositiveCases = 0;
  let amlFailureCases = 0;
  let manualReviewCases = 0;
  const casesByMonth = new Map<string, number>();
  const caseCountByActivity = new Map<string, number>();
  const seenInActivity = new Map<string, Set<string>>();

  for (const c of caseInfos) {
    // Outcomes
    const allOutcomes = Array.from(c.outcomes).join(" ");
    const allActivities = c.activities.join(" ").toLowerCase();
    if (/(approved|approve|success|complete)/.test(allOutcomes) ||
        c.activities.some((a) => /(account.?(open|creat))/i.test(a))) approvedCount++;
    if (/(declined|decline|reject)/.test(allOutcomes) ||
        c.activities.some((a) => /(reject|decline)/i.test(a))) declinedCount++;
    if (!c.reachedAccountCreation && !/(reject|decline)/.test(allOutcomes) &&
        !c.activities.some((a) => /(reject|decline)/i.test(a))) abandonedCount++;

    // Channels
    if (c.channels.size > 0) {
      for (const ch of c.channels) {
        channelByName.set(ch, (channelByName.get(ch) ?? 0) + 1);
        if (/digital|web|mobile|app|online/.test(ch)) digitalCases++;
        if (/branch|in.?person|phone/.test(ch)) branchCases++;
      }
    }

    if (c.fraudPositive) fraudPositiveCases++;
    if (c.hasManualReview) manualReviewCases++;
    if (allOutcomes.includes("aml") && /(fail|hit)/.test(allOutcomes)) amlFailureCases++;
    if (allActivities.includes("aml") && /(fail|reject)/.test(allActivities)) amlFailureCases++;

    // Monthly bin
    const ym = `${c.firstTs.getUTCFullYear()}-${String(c.firstTs.getUTCMonth() + 1).padStart(2, "0")}`;
    casesByMonth.set(ym, (casesByMonth.get(ym) ?? 0) + 1);

    // Per-activity case counts
    for (const a of new Set(c.activities)) {
      let s = seenInActivity.get(a);
      if (!s) { s = new Set(); seenInActivity.set(a, s); }
      s.add(c.caseId);
    }
  }
  for (const [a, set] of seenInActivity) caseCountByActivity.set(a, set.size);

  const ctx: ComputeContext = {
    totalCases: caseInfos.length,
    totalEvents: events.length,
    variantCount: sigCounts.size,
    systemCount: systems.size,
    activityCount: new Set(events.map((e) => e.activity)).size,
    leadTimes,
    caseInfos,
    reworkCases,
    happyPathCases,
    approvedCount, declinedCount, abandonedCount,
    digitalChannelCases: digitalCases,
    branchChannelCases: branchCases,
    channelByName,
    fraudPositiveCases,
    amlFailureCases,
    manualReviewCases,
    casesByMonth,
    caseCountByActivity,
    coefficients: Object.fromEntries(Object.entries(repository.coefficientByKey).map(([k, c]) => [k, c.value])),
  };

  const metricDefs = (repository.template?.metricDefinitions ?? []) as unknown as MetricDefinition[];

  const overrides = (process.metricOverrides ?? {}) as Record<string, number>;

  const allComputed = new Map<string, number | null>();
  for (const m of metricDefs) {
    if (m.source === "direct") allComputed.set(m.key, computeDirect(m, ctx));
  }
  for (const m of metricDefs) {
    if (m.source === "assumed") {
      // Override beats default
      const overrideVal = overrides[m.key];
      const v = typeof overrideVal === "number" && !isNaN(overrideVal) ? overrideVal : (m.defaultValue ?? null);
      allComputed.set(m.key, v);
    }
  }
  for (const m of metricDefs) {
    if (m.source === "inferred") allComputed.set(m.key, computeInferred(m, ctx, allComputed));
  }

  const metricsByCategory = JSON.parse(JSON.stringify(EMPTY_CATEGORIES)) as Record<MetricCategory, CockpitMetric[]>;
  for (const m of metricDefs) {
    const value = allComputed.get(m.key) ?? null;
    const { status, thresholdInfo } = evaluateStatus(value, m);
    const isOverridden = m.source === "assumed" && typeof overrides[m.key] === "number";
    const cm: CockpitMetric = {
      key: m.key, label: m.label, category: m.category, source: m.source,
      unit: m.unit, description: m.description,
      value, formattedValue: formatValue(value, m.unit),
      status, thresholdInfo, computable: value !== null,
      isOverridden, defaultValue: m.source === "assumed" ? (m.defaultValue ?? null) : null,
    };
    if (!metricsByCategory[m.category]) metricsByCategory[m.category] = [];
    metricsByCategory[m.category].push(cm);
  }

  return {
    generatedAt: new Date().toISOString(),
    computed: true,
    totals: {
      cases: ctx.totalCases, events: ctx.totalEvents,
      variants: ctx.variantCount, systems: ctx.systemCount, activities: ctx.activityCount,
    },
    metricsByCategory,
  };
}
