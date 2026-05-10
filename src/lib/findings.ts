/**
 * Findings engine — deterministic detection of deviations from the process
 * graph + variants + metrics, matched against the deviation library, then
 * fed to Claude for narrative + quantification.
 *
 * Pure logic in this file; the API route orchestrates the Claude call.
 */

import { prisma } from "@/lib/db";
import { getProcessGraph, START_NODE, END_NODE } from "@/lib/processGraph";
import { getVariantsSummary } from "@/lib/variants";
import { loadRepositoryBundle } from "@/lib/repositoryBootstrap";
import type { GraphActivity, GraphEdge, ProcessGraphSummary } from "@/lib/processGraph.types";
import type { VariantsSummary } from "@/lib/variants";

// ──────────────────────────────────────────────────────────────────────────
// Detection — pull deviations out of the process graph
// ──────────────────────────────────────────────────────────────────────────

export type DetectedDeviation = {
  type: "skip" | "loop" | "out_of_order" | "extra_step";
  step: string;            // activity affected
  caseCount: number;       // how many cases hit this
  pct: number;             // % of total cases
  description: string;     // brief description of what's happening
  evidence: string;        // pointer to data — e.g., "Edge Initial Review → Credit Check skips KYC, 240 cases"
};

export function detectDeviations(graph: ProcessGraphSummary): DetectedDeviation[] {
  if (!graph.computed || graph.totalCases === 0) return [];

  const out: DetectedDeviation[] = [];
  const happyEdges = new Set(graph.happyPathEdges.map((e) => `${e.from}→${e.to}`));
  const total = graph.totalCases;

  // Activities map by name
  const actByName = new Map<string, GraphActivity>();
  for (const a of graph.activities) actByName.set(a.name, a);

  // 1. SKIPPED STEPS — for each activity, find cases that bypass it
  // A case "bypassed" activity X if there's an edge from a predecessor of X to a successor of X without going through X
  // Simpler heuristic: if an activity has caseCount < total * 0.95, the gap is "cases that skipped it"
  for (const a of graph.activities) {
    if (a.name === START_NODE || a.name === END_NODE) continue;
    const skipped = total - a.caseCount;
    const skipPct = (skipped / total) * 100;
    if (skipPct >= 3) { // material — at least 3% of cases skipped this activity
      out.push({
        type: "skip",
        step: a.name,
        caseCount: skipped,
        pct: skipPct,
        description: `${skipped} cases (${skipPct.toFixed(1)}%) bypassed "${a.name}"`,
        evidence: `Activity "${a.name}" appears in only ${a.caseCount} of ${total} cases`,
      });
    }
  }

  // 2. LOOPS / REWORK — activities with eventCount > caseCount mean some cases hit them multiple times
  for (const a of graph.activities) {
    if (a.name === START_NODE || a.name === END_NODE) continue;
    if (a.eventCount > a.caseCount * 1.05) {
      const reworkEvents = a.eventCount - a.caseCount;
      const reworkPct = (reworkEvents / a.eventCount) * 100;
      out.push({
        type: "loop",
        step: a.name,
        caseCount: reworkEvents,
        pct: reworkPct,
        description: `"${a.name}" was repeated ${reworkEvents} times across cases (${reworkPct.toFixed(1)}% rework rate)`,
        evidence: `Activity "${a.name}" has ${a.eventCount} events for ${a.caseCount} cases`,
      });
    }
  }

  // 3. OUT-OF-ORDER — non-happy-path edges that move "backwards" or skip canonical sequence
  // Heuristic: any edge that's not a happy-path edge AND has reasonable case volume is a candidate
  for (const e of graph.edges) {
    if (e.from === START_NODE || e.to === END_NODE) continue;
    const key = `${e.from}→${e.to}`;
    if (happyEdges.has(key)) continue;
    const pct = (e.caseCount / total) * 100;
    if (pct >= 1) {
      out.push({
        type: "out_of_order",
        step: `${e.from} → ${e.to}`,
        caseCount: e.caseCount,
        pct,
        description: `${e.caseCount} cases (${pct.toFixed(1)}%) followed an off-path transition: "${e.from}" → "${e.to}"`,
        evidence: `Edge ${key} is not the happy-path transition out of "${e.from}"`,
      });
    }
  }

  // 4. EXTRA STEPS — activities that look like manual reviews, escalations, or overrides
  for (const a of graph.activities) {
    if (a.name === START_NODE || a.name === END_NODE) continue;
    if (/(manual|override|escalat|exception|review)/i.test(a.name)) {
      const pct = (a.caseCount / total) * 100;
      if (pct >= 2) {
        out.push({
          type: "extra_step",
          step: a.name,
          caseCount: a.caseCount,
          pct,
          description: `${a.caseCount} cases (${pct.toFixed(1)}%) hit the extra step "${a.name}"`,
          evidence: `Activity "${a.name}" indicates manual intervention`,
        });
      }
    }
  }

  // Rank by case count (impact)
  return out.sort((a, b) => b.caseCount - a.caseCount);
}

// ──────────────────────────────────────────────────────────────────────────
// Match deviations to library patterns
// ──────────────────────────────────────────────────────────────────────────

export type MatchedDeviation = DetectedDeviation & {
  candidateReasons: Array<{
    category: string;
    severity: string;
    title: string;
    description: string;
    investigationHint: string;
    valueModel: string;
    apaAgent?: string;
  }>;
};

export function matchToLibrary(
  deviations: DetectedDeviation[],
  patterns: Array<{ type: string; stepKeyword: string; reasons: unknown }>
): MatchedDeviation[] {
  return deviations.map((d) => {
    const matchingPatterns = patterns.filter((p) => {
      if (p.type !== d.type) return false;
      try {
        const re = new RegExp(p.stepKeyword, "i");
        return re.test(d.step);
      } catch { return false; }
    });
    const candidateReasons = matchingPatterns.flatMap((p) => p.reasons as MatchedDeviation["candidateReasons"]);
    return { ...d, candidateReasons };
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Build the prompt for Claude — structured, banking-context-aware
// ──────────────────────────────────────────────────────────────────────────

export type FindingsContext = {
  engagementName: string;
  clientName: string;
  country: string | null;
  institutionType: string | null;
  processName: string;
  processKey: string;
  totalCases: number;
  totalEvents: number;
  variants: VariantsSummary;
  deviations: MatchedDeviation[];
  metrics: Record<string, string> | null;
  capabilities: Record<string, string> | null;
  coefficients: Record<string, { value: number; unit: string; description: string }>;
};

export function buildFindingsPrompt(ctx: FindingsContext): string {
  const sortedDeviations = [...ctx.deviations].sort((a, b) => b.caseCount - a.caseCount).slice(0, 12);
  return `You are a senior banking process consultant producing a quantified findings report for a client engagement. Your goal is to convert observed process deviations into ranked findings with concrete £/$ value attached.

ENGAGEMENT
- Client: ${ctx.clientName}
- Engagement: ${ctx.engagementName}
- Country: ${ctx.country ?? "unspecified"}
- Institution type: ${ctx.institutionType ?? "unspecified"}
- Process: ${ctx.processName} (${ctx.processKey})

PROCESS MINING SUMMARY
- ${ctx.totalCases.toLocaleString()} cases
- ${ctx.totalEvents.toLocaleString()} events in the activity table
- ${ctx.variants.totalVariants} distinct variants observed
- Top variant covers ${ctx.variants.topVariants[0] ? ctx.variants.topVariants[0].pct.toFixed(1) : 0}% of cases

PROCESS METRICS (consultant-captured during workshop)
${ctx.metrics ? Object.entries(ctx.metrics).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n") : "(none captured)"}

CURRENT CAPABILITY ASSESSMENT
${ctx.capabilities ? Object.entries(ctx.capabilities).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n") : "(none captured)"}

VALUE COEFFICIENTS (use these for quantification — do not invent numbers)
${Object.entries(ctx.coefficients).map(([k, c]) => `- ${k} = ${c.value} ${c.unit} (${c.description})`).join("\n")}

OBSERVED DEVIATIONS (ranked by impact)
${sortedDeviations.map((d, i) => `
${i + 1}. ${d.type.toUpperCase()} — ${d.step}
   ${d.description}
   Evidence: ${d.evidence}
   Candidate reasons from banking knowledge library:
${d.candidateReasons.length === 0 ? "   (no library match — apply general process-mining judgment)" : d.candidateReasons.map((r, j) => `   ${j + 1}. [${r.category} · ${r.severity}] ${r.title}
      ${r.description}
      Investigate: ${r.investigationHint}
      Value model: ${r.valueModel}${r.apaAgent ? `\n      Recommended APA agent: ${r.apaAgent}` : ""}`).join("\n")}`).join("\n")}

TASK
Generate 5-8 ranked findings. Each finding:
1. Picks the most likely candidate reason for the deviation (or combines if appropriate)
2. Uses the VALUE COEFFICIENTS above to compute a concrete £/$ annual value-leak figure (round to nearest £/$ thousand)
3. Quantifies based on the actual case counts observed × the multipliers
4. References the specific banking POV (regulatory framework, fines, default rates) where relevant
5. Recommends a concrete next step — automation, control, training, audit, or further investigation

Return ONLY valid JSON in this structure:
{
  "summary": "1-2 sentence executive summary of the digital twin findings",
  "totalAnnualValueLeak": <number in major currency unit, e.g. GBP>,
  "elasticOps": {
    "growth": {
      "totalAnnualValueLeak": <number — sum of annualValueLeak across findings tagged 'growth'>,
      "findingCount": <number — count of growth findings>,
      "mainFactors": ["short factor 1", "short factor 2", "short factor 3"],
      "summary": "1 sentence — what's driving growth-side leak in this engagement"
    },
    "efficiency": { /* same shape — for efficiency findings */ },
    "control":    { /* same shape — for control findings */ }
  },
  "findings": [
    {
      "rank": 1,
      "title": "Short, punchy title — 5-8 words",
      "category": "value_leak | cycle_pain | blindspot | conformance_gap",
      "cockpitCategory": "time | volume | quality | outcome | cost | cx | workforce | compliance",
      "elasticOpsVertex": "growth | efficiency | control",
      "severity": "low | medium | high | critical",
      "narrative": "2-3 sentence story — what's happening, why it matters, how big it is",
      "casesAffected": <number>,
      "annualValueLeak": <number in GBP>,
      "valueLeakBreakdown": "Show the math: e.g. '270 cases/yr × 12 mins/case × £35/hr = £1,890/yr'",
      "deviationType": "skip | loop | out_of_order | extra_step",
      "deviationStep": "the affected step name",
      "rootCause": "Most likely cause (from candidate reasons or inferred)",
      "recommendation": "Concrete action — what to do",
      "recommendedAPAAgent": "Optional — if APA can fix it",
      "relatedMetricKeys": ["optional array of metric keys this finding addresses, e.g. ['lead_time_avg_days','stp_rate_pct']"]
    }
  ]
}

CATEGORY GUIDELINES — pick the best cockpitCategory per finding:
- time:       lead time too long, slow phases, wait time, throughput delays
- volume:     unusual case volumes, channel mix issues
- quality:    rework, document rejection, conformance gaps, variant explosion
- outcome:    decline / approval / abandonment rate problems
- cost:       FTE hours, cost per case, manual touch cost
- cx:         touchpoints, drop-off, customer effort, friction
- workforce:  bottleneck actor, handling time imbalance, low FTE throughput
- compliance: KYC failures, AML issues, gate failures, audit-flagged cases

Each finding gets exactly one cockpitCategory (the primary one). The "category" field describes the FINDING TYPE (value leak vs cycle pain vs blindspot vs conformance gap) and is independent.

ELASTIC OPERATIONS BUSINESS CASE — every finding rolls up to ONE of three vertices.
This is the executive-level frame the consultant uses to present results. Be deliberate.

- GROWTH:     revenue lost, customers lost, time-to-revenue, abandonment / drop-off,
              decline-driving deviations, friction that costs adoption or cross-sell,
              CX issues that reduce wallet share. Cockpit categories that typically
              roll into growth: outcome (decline/abandon) and cx (friction, drop-off).

- EFFICIENCY: operational cost burned by the bank — rework loops, manual reviews,
              FTE waste, cycle time, cost per case, low straight-through-processing.
              Cockpit categories that typically roll into efficiency: cost, time,
              workforce, and quality (when rework-driven).

- CONTROL:    risk and compliance exposure — KYC/AML/fraud bypass, regulatory
              breach fines, SLA-compensation payouts, audit findings, FOS / FCA
              enforcement risk, post-incident remediation cost.
              Cockpit categories that typically roll into control: compliance and
              quality (when conformance-gap-driven).

For elasticOps.<vertex>.mainFactors: 3-5 short bullets (max 8 words each) naming the
specific drivers — e.g. "KYC bypass on 1,345 cases", "Manual review escalations 12% rework", "Credit check gaps in mortgage variant".
For elasticOps.<vertex>.summary: ONE sentence written for an exec — what's leaking and why.
Make sure totalAnnualValueLeak across the three vertices equals the top-level totalAnnualValueLeak.

GUIDELINES
- Be banking-specific. Reference UK FCA / FOS / regulatory framing where it fits.
- Be honest about uncertainty. If a finding is speculative, say so in the narrative.
- Findings must be defensible to a senior banking executive — every claim should trace back to data observed or coefficients applied.

THREE HARD RULES (audit-grade — your output is rejected if any rule is broken)

RULE 1 — MATH CONSISTENCY ON EVERY FINDING
The "valueLeakBreakdown" string MUST end with a single final number that equals
"annualValueLeak" EXACTLY (rounded to nearest £1k). The formula shown in the
breakdown must be the actual formula you used to derive annualValueLeak — no
shortcuts, no rewrites, no dropped terms.

✓ GOOD: "1,345 cases × 0.4% fraud rate × £4,800 avg loss = £25,824 + 1,345 cases × £1,060 reg risk = £1,425,700 → total £1,451k"
   (the partial sums are shown AND the final total matches annualValueLeak)
✗ BAD:  "1,345 × 0.4% × £4,800 = £26k + 1,345 × £1,060 = £1,425k total"
   (claims the total is £1,425k but actually £26k + £1,425k = £1,451k — math fails)

RULE 2 — COEFFICIENT SOURCING
Use ONLY the keys listed in the VALUE COEFFICIENTS section above. You may NOT
invent or guess coefficients (no "£1,060/case regulatory risk" if that key
isn't in the list).

If a coefficient you'd need for proper quantification is missing:
  • Set "annualValueLeak" to 0
  • In "valueLeakBreakdown" write: "coefficient missing: <name> — quantification skipped"
  • In "narrative" call out which coefficient is needed
Do NOT fabricate values to make a finding look complete.

RULE 3 — ELASTIC OPS TRIANGLE MUST RECONCILE
For each finding, "elasticOpsVertex" is mandatory and must be one of growth /
efficiency / control. The sums in elasticOps must reconcile EXACTLY:
  elasticOps.growth.totalAnnualValueLeak
  + elasticOps.efficiency.totalAnnualValueLeak
  + elasticOps.control.totalAnnualValueLeak
  = totalAnnualValueLeak
(and the sum of findingCount across the three vertices = findings.length)

The server will recompute the elasticOps totals from the per-finding
elasticOpsVertex tags. If your top-level numbers don't match, the server values
win and your numbers will be silently overwritten — so save us both the effort
and make them match.`;
}

// ──────────────────────────────────────────────────────────────────────────
// Orchestrator — load everything, run Claude, return findings
// ──────────────────────────────────────────────────────────────────────────

/** Elastic Operations business-case vertex. Every finding rolls up to one of three. */
export type ElasticOpsVertex = "growth" | "efficiency" | "control";

export type ElasticOpsBreakdown = {
  totalAnnualValueLeak: number;
  findingCount: number;
  mainFactors: string[];
  summary: string;
};

export type FindingsResult = {
  generatedAt: string;
  summary: string;
  totalAnnualValueLeak: number;
  /** Per-vertex roll-up — Growth / Efficiency / Control */
  elasticOps?: {
    growth: ElasticOpsBreakdown;
    efficiency: ElasticOpsBreakdown;
    control: ElasticOpsBreakdown;
  };
  findings: Array<{
    rank: number;
    title: string;
    /** Type of finding — what kind of issue this is */
    category: "value_leak" | "cycle_pain" | "blindspot" | "conformance_gap";
    /** Cockpit category — which KPI dashboard area this finding affects */
    cockpitCategory: "time" | "volume" | "quality" | "outcome" | "cost" | "cx" | "workforce" | "compliance";
    /** Elastic Operations vertex this finding rolls up to */
    elasticOpsVertex?: ElasticOpsVertex;
    severity: "low" | "medium" | "high" | "critical";
    narrative: string;
    casesAffected: number;
    annualValueLeak: number;
    valueLeakBreakdown: string;
    deviationType: "skip" | "loop" | "out_of_order" | "extra_step";
    deviationStep: string;
    rootCause: string;
    recommendation: string;
    recommendedAPAAgent?: string;
    /** Optional: which metric keys this finding directly addresses */
    relatedMetricKeys?: string[];
  }>;
};

export async function loadFindingsContext(engagementId: string, processId: string): Promise<FindingsContext | { error: string }> {
  const [engagement, process, graph, variants] = await Promise.all([
    prisma.engagement.findUnique({ where: { id: engagementId }, select: { name: true, clientName: true, country: true, institutionType: true } }),
    prisma.engagementProcess.findUnique({ where: { id: processId, engagementId }, select: { processName: true, processKey: true, processMetrics: true, processCapabilities: true } }),
    getProcessGraph(processId),
    getVariantsSummary(processId),
  ]);

  if (!engagement || !process) return { error: "engagement or process not found" };
  if (!graph.computed) return { error: "Activity table hasn't been built yet — run Stage 2 first." };

  const repository = await loadRepositoryBundle({
    country: engagement.country,
    institutionType: engagement.institutionType,
    processKey: process.processKey,
  });

  const deviations = detectDeviations(graph);
  const matched = matchToLibrary(deviations, repository.deviationPatterns.map((p) => ({
    type: p.type,
    stepKeyword: p.stepKeyword,
    reasons: p.reasons,
  })));

  return {
    engagementName: engagement.name,
    clientName: engagement.clientName,
    country: engagement.country,
    institutionType: engagement.institutionType,
    processName: process.processName,
    processKey: process.processKey,
    totalCases: graph.totalCases,
    totalEvents: graph.totalEvents,
    variants,
    deviations: matched,
    metrics: process.processMetrics as Record<string, string> | null,
    capabilities: process.processCapabilities as Record<string, string> | null,
    coefficients: repository.coefficientByKey,
  };
}
