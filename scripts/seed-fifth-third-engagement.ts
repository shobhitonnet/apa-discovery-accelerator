/**
 * Seed a complete Fifth Third Bank discovery engagement end-to-end.
 *
 *   - Engagement "Fifth Third Bank — Commercial & SME Discovery"
 *   - Two processes attached: commercial_onboarding (600 cases) and
 *     sme_loan_origination (1250 cases) over a 12-month window
 *   - processMap, processCapabilities, processMetrics, dataRequest all set
 *   - Per-system CSVs written to sample-data/fifth-third-{commercial,sme}/
 *   - Upload rows created and linked to dataRequest slots
 *   - EventLog rows seeded with realistic deviations (rework loops, declines,
 *     EDD escalations, doc rework, abandonment)
 *   - Findings pre-generated via Claude and cached
 *
 * Idempotent — re-running deletes the prior Fifth Third engagement first.
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-fifth-third-engagement.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { anthropic } from "@/lib/anthropic";
import { buildFindingsPrompt, loadFindingsContext, type FindingsResult } from "@/lib/findings";

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

const ENGAGEMENT_NAME = "Fifth Third Bank — Commercial & SME Discovery";
const CLIENT_NAME = "Fifth Third Bank";
const COUNTRY = "United States";

const COMMERCIAL_CASES = 600;
const SME_CASES = 1250;
const RANGE_START = new Date("2025-05-01T08:00:00Z");
const RANGE_END   = new Date("2026-04-30T20:00:00Z");

const SAMPLE_DIR = "/Users/Shobhit@backbase.com/apa-discovery-accelerator/sample-data";

// ──────────────────────────────────────────────────────────────────────────
// Deterministic RNG
// ──────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: () => number, a: number, b: number) =>
  a + Math.floor(rng() * (b - a + 1));
const pick = <T>(rng: () => number, arr: readonly T[]) =>
  arr[Math.floor(rng() * arr.length)];
const minutes = (n: number) => n * 60_000;
const hours = (n: number) => minutes(60 * n);
const days = (n: number) => hours(24 * n);
const addMs = (d: Date, ms: number) => new Date(d.getTime() + ms);
const fmtTs = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);

// ──────────────────────────────────────────────────────────────────────────
// Step → actor / system maps (drives canvas, CSV split, EventLog tagging)
// ──────────────────────────────────────────────────────────────────────────

type StepMapping = {
  label: string;
  primaryActor: string;
  primarySystem: string;
  secondarySystems?: string[];   // For canvas display; events are tagged with primary only
};

const COMMERCIAL_STEP_MAP: StepMapping[] = [
  { label: "Submit Commercial Application",     primaryActor: "Corporate Client",            primarySystem: "Salesforce Financial Services Cloud" },
  { label: "Verify Legal Entity",                primaryActor: "KYC Analyst (Commercial)",     primarySystem: "Dun & Bradstreet",                       secondarySystems: ["nCino"] },
  { label: "Identify Beneficial Owners",         primaryActor: "KYC Analyst (Commercial)",     primarySystem: "nCino" },
  { label: "Run Sanctions & PEP Screening",      primaryActor: "KYC Analyst (Commercial)",     primarySystem: "LexisNexis Bridger" },
  { label: "Conduct Enhanced Due Diligence",     primaryActor: "BSA / AML Compliance Officer", primarySystem: "Refinitiv WorldCheck" },
  { label: "Assess Credit Risk Profile",         primaryActor: "Credit Underwriter",           primarySystem: "nCino",                                   secondarySystems: ["Dun & Bradstreet"] },
  { label: "Set Up Account Mandate",             primaryActor: "Onboarding Operations",        primarySystem: "nCino" },
  { label: "Provision Account in Core",          primaryActor: "Core Banking System",          primarySystem: "FIS IBS / Fiserv Premier" },
  { label: "Enable Treasury & Payments",         primaryActor: "Treasury Services Specialist", primarySystem: "Treasury Management Portal" },
  { label: "Enroll Digital Banking",             primaryActor: "Onboarding Operations",        primarySystem: "Treasury Management Portal" },
  { label: "Conduct RM Welcome & Handoff",       primaryActor: "Relationship Manager",         primarySystem: "Salesforce Financial Services Cloud" },
];

const SME_STEP_MAP: StepMapping[] = [
  { label: "Submit Loan Application",            primaryActor: "SME Borrower",                primarySystem: "nCino" },
  { label: "Capture Business Documentation",     primaryActor: "Loan Processor",              primarySystem: "Encompass" },
  { label: "Verify Business Identity",            primaryActor: "Loan Processor",              primarySystem: "Dun & Bradstreet",                       secondarySystems: ["LexisNexis Bridger"] },
  { label: "Pull Business Credit",                primaryActor: "Loan Processor",              primarySystem: "Dun & Bradstreet",                       secondarySystems: ["Experian Business / Equifax"] },
  { label: "Pull Owner Personal Credit",          primaryActor: "Loan Processor",              primarySystem: "Experian Business / Equifax" },
  { label: "Analyse Financial Statements",        primaryActor: "Credit Underwriter (SME)",    primarySystem: "nCino" },
  { label: "Assess Collateral",                   primaryActor: "Property Appraiser",          primarySystem: "iAppraise / AppraisalPort" },
  { label: "Make Credit Decision",                primaryActor: "Credit Underwriter (SME)",    primarySystem: "nCino",                                   secondarySystems: ["Loan Decision Engine"] },
  { label: "Prepare & Send Loan Documents",       primaryActor: "Loan Processor",              primarySystem: "Encompass",                               secondarySystems: ["DocuSign"] },
  { label: "Receive Signed Documents",            primaryActor: "SME Borrower",                primarySystem: "DocuSign" },
  { label: "Conduct Closing Review",              primaryActor: "Loan Closer",                 primarySystem: "Encompass",                               secondarySystems: ["UCC Filing Service"] },
  { label: "Disburse Loan Funds",                 primaryActor: "Core Banking System",         primarySystem: "FIS IBS / Fiserv Premier" },
  { label: "Set Up Loan Servicing",               primaryActor: "Loan Processor",              primarySystem: "FIS IBS / Fiserv Premier" },
];

// ──────────────────────────────────────────────────────────────────────────
// Capabilities + metrics per process (realistic Fifth Third assessment)
// ──────────────────────────────────────────────────────────────────────────

const COMMERCIAL_CAPABILITIES: Record<string, string> = {
  submit_commercial_application:  "partial",   // Salesforce capture, some still PDF
  verify_legal_entity:            "partial",   // D&B API, manual review
  identify_beneficial_owners:     "manual",    // Heavy manual UBO chase
  run_sanctions_pep_screening:    "digital",
  conduct_enhanced_due_diligence: "manual",    // Highly manual case work
  assess_credit_risk_profile:     "partial",
  set_up_account_mandate:         "manual",
  provision_account_in_core:      "digital",
  enable_treasury_payments:       "partial",
  enroll_digital_banking:         "digital",
  conduct_rm_welcome_handoff:     "manual",
  integrationStatus:              "partial_integration",
};

const SME_CAPABILITIES: Record<string, string> = {
  submit_loan_application:        "partial",
  capture_business_documentation: "manual",     // Big doc rework hotspot
  verify_business_identity:       "partial",
  pull_business_credit:           "digital",
  pull_owner_personal_credit:     "digital",
  analyse_financial_statements:   "manual",     // Spreading is largely manual
  assess_collateral:              "partial",
  make_credit_decision:           "partial",
  prepare_send_loan_documents:    "partial",
  receive_signed_documents:       "digital",
  conduct_closing_review:         "manual",
  disburse_loan_funds:            "digital",
  set_up_loan_servicing:          "partial",
  integrationStatus:              "partial_integration",
};

const COMMERCIAL_METRICS: Record<string, string> = {
  monthly_commercial_volume:    "50",          // 600/yr = 50/mo
  commercial_onboarding_lead_time_days: "16.5",
  stp_rate_commercial:          "32",          // % auto-decisioned
  ubo_rework_rate:              "23",
  edd_approval_rate:            "78",
  commercial_decline_rate:      "8",
  commercial_abandonment_rate:  "12",
  cost_per_commercial_onboarding: "1850",
  touchpoints_per_case_commercial: "7",
  compliance_touch_rate:        "62",
  gate_failure_rate_commercial: "11",
  audit_flagged_rate_commercial: "4",
  notes: "Fifth Third commercial onboarding spans mid-market to large corporate. UBO chase is the biggest pain point; EDD escalations stretch cycles when PEP/sanctions hits trigger manual review.",
};

const SME_METRICS: Record<string, string> = {
  monthly_sme_volume:           "104",         // 1250/yr ≈ 104/mo
  sme_application_volume:       "145",
  sme_lead_time_days:           "23.4",
  underwriting_decision_days:   "5.6",
  sme_stp_rate:                 "28",
  sme_doc_rework_rate:          "31",
  first_time_right_rate:        "42",
  sme_approval_rate:            "65",
  sme_decline_rate:             "22",
  sme_withdrawal_rate:          "8",
  cost_per_sme_loan:            "2400",
  sme_touchpoints_per_case:     "9",
  underwriter_handle_time:      "3.2",
  gate_failure_rate_sme:        "14",
  notes: "SBA 7(a) + conventional commercial loans, mostly under $1M. Doc rework is the biggest leak — borrowers send incomplete bank statements / tax returns and processors loop on Encompass. Underwriting backlog spikes during quarter-ends.",
};

// ──────────────────────────────────────────────────────────────────────────
// Hand-crafted data request — matches the per-system CSV split we'll generate
// ──────────────────────────────────────────────────────────────────────────

const SYSTEM_COLORS: Record<string, string> = {
  "Salesforce Financial Services Cloud": "#3366FF",
  "nCino":                                 "#06B6D4",
  "LexisNexis Bridger":                    "#EF4444",
  "Dun & Bradstreet":                      "#FFAC09",
  "Refinitiv WorldCheck":                  "#EF4444",
  "FIS IBS / Fiserv Premier":              "#F97316",
  "Treasury Management Portal":            "#8B2BE2",
  "Encompass":                              "#3366FF",
  "Experian Business / Equifax":            "#FFAC09",
  "iAppraise / AppraisalPort":              "#8B2BE2",
  "DocuSign":                               "#3366FF",
  "UCC Filing Service":                     "#64748B",
};

function buildDataRequest(processName: string, stepMap: StepMapping[]) {
  // Group steps by primarySystem
  const bySystem = new Map<string, StepMapping[]>();
  for (const s of stepMap) {
    if (!bySystem.has(s.primarySystem)) bySystem.set(s.primarySystem, []);
    bySystem.get(s.primarySystem)!.push(s);
  }

  const items = Array.from(bySystem.entries()).map(([systemName, steps]) => {
    const fileName = `${systemName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}_events.csv`;
    const linkedSteps = steps.map((s) => s.label);
    return {
      fileName,
      systemName,
      systemColor: SYSTEM_COLORS[systemName] ?? "#3366FF",
      description: `Event log of ${linkedSteps.length} activit${linkedSteps.length === 1 ? "y" : "ies"} from ${systemName}: ${linkedSteps.join(", ")}`,
      fields: ["case_id", "activity", "event_timestamp", "actor", "case_attributes"],
      format: "CSV export",
      timeRange: "Last 12 months (2025-05-01 to 2026-04-30)",
      linkedSteps,
      moscow: "must_have" as const,
      digitalTwinValue: `Enables event-level reconstruction for ${linkedSteps.length} step${linkedSteps.length === 1 ? "" : "s"} — used for cycle-time, conformance, and rework detection on these activities`,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    processName,
    clientName: CLIENT_NAME,
    coveringNote: `Data extracts requested from Fifth Third's ${processName} systems to build the digital twin. All files should cover the rolling 12-month window (May 2025 – April 2026), exported as CSV with timezone-aware timestamps. Case identifiers must be consistent across systems so we can stitch events into end-to-end cases. Where actor/user attribution is available it enriches workload analysis but is not required.`,
    items,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Build BPMN-style processMap from step map
// ──────────────────────────────────────────────────────────────────────────

type CanvasNode = {
  id: string;
  type: "startEvent" | "task" | "endEvent";
  position: { x: number; y: number };
  data: {
    label: string;
    actors?: Array<{ name: string; color: string }>;
    systems?: Array<{ name: string; color: string }>;
    order?: number;
  };
};

type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  type: "smoothstep";
  markerEnd: { type: string; color: string; width: number; height: number };
  style: { stroke: string; strokeWidth: number };
};

const ACTOR_COLORS: Record<string, string> = {
  // Commercial actors
  "Corporate Client":                        "#3366FF",
  "Relationship Manager":                    "#26BC71",
  "KYC Analyst (Commercial)":                "#FFAC09",
  "BSA / AML Compliance Officer":            "#EF4444",
  "Credit Underwriter":                       "#06B6D4",
  "Onboarding Operations":                    "#FFAC09",
  "Treasury Services Specialist":             "#8B2BE2",
  "Core Banking System":                      "#64748B",
  // SME actors
  "SME Borrower":                             "#3366FF",
  "Business Banker":                          "#26BC71",
  "Loan Processor":                           "#FFAC09",
  "Credit Underwriter (SME)":                 "#06B6D4",
  "Senior Underwriter":                       "#8B2BE2",
  "Property Appraiser":                       "#FFAC09",
  "Loan Closer":                              "#26BC71",
  "Loan Decision Engine":                     "#64748B",
};

function buildProcessMap(stepMap: StepMapping[]) {
  const cx = 380, sy = 60, gap = 180;
  const nodes: CanvasNode[] = [];

  nodes.push({ id: "node-1", type: "startEvent", position: { x: cx, y: sy }, data: { label: "Start" } });

  stepMap.forEach((step, i) => {
    const allSystems = [step.primarySystem, ...(step.secondarySystems ?? [])];
    nodes.push({
      id: `node-${i + 2}`,
      type: "task",
      position: { x: cx - 100, y: sy + 100 + i * gap },
      data: {
        label: step.label,
        actors: [{ name: step.primaryActor, color: ACTOR_COLORS[step.primaryActor] ?? "#3366FF" }],
        systems: allSystems.map((n) => ({ name: n, color: SYSTEM_COLORS[n] ?? "#3366FF" })),
        order: i + 1,
      },
    });
  });

  const endIdx = stepMap.length + 2;
  nodes.push({ id: `node-${endIdx}`, type: "endEvent", position: { x: cx, y: sy + 100 + stepMap.length * gap }, data: { label: "End" } });

  const edges: CanvasEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e-${nodes[i].id}-${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: "smoothstep",
      markerEnd: { type: "arrowclosed", color: "#3366FF", width: 16, height: 16 },
      style: { stroke: "#3366FF", strokeWidth: 2 },
    });
  }

  const taskNodes = nodes.filter((n) => n.type === "task");
  const allActors = Array.from(new Set(taskNodes.flatMap((n) => (n.data.actors ?? []).map((a) => a.name))));
  const allSystems = Array.from(new Set(taskNodes.flatMap((n) => (n.data.systems ?? []).map((s) => s.name))));

  return {
    nodes, edges,
    summary: {
      nodeCount: nodes.length,
      taskCount: taskNodes.length,
      actors: allActors,
      systems: allSystems,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Case generation with realistic deviations
// ──────────────────────────────────────────────────────────────────────────

type GenEvent = {
  caseId: string;
  activity: string;
  timestamp: Date;
  actor: string;
  system: string;
  attributes: Record<string, string | number>;
};

type VariantSpec = {
  name: string;
  weight: number;          // relative weight for picking
  build: (caseId: string, startTs: Date, stepMap: StepMapping[], rng: () => number) => GenEvent[];
};

// ── Helper: build linear happy-path events ────────────────────────────────
function buildHappyPath(caseId: string, startTs: Date, stepMap: StepMapping[], rng: () => number, baseAttrs: Record<string, string | number> = {}): GenEvent[] {
  let ts = new Date(startTs);
  const events: GenEvent[] = [];
  for (const step of stepMap) {
    events.push({
      caseId,
      activity: step.label,
      timestamp: new Date(ts),
      actor: step.primaryActor,
      system: step.primarySystem,
      attributes: { ...baseAttrs },
    });
    // Realistic deltas between steps: short for digital (1-4h), medium for partial (4-24h), long for manual (1-3d)
    const delta = between(rng, 2, 26) * 3600_000; // 2-26 hours
    ts = addMs(ts, delta);
  }
  return events;
}

// ── Commercial onboarding variants ────────────────────────────────────────
const COMMERCIAL_VARIANTS: VariantSpec[] = [
  {
    name: "happy_path",
    weight: 60,
    build: (caseId, startTs, sm, rng) => buildHappyPath(caseId, startTs, sm, rng, { entity_type: pick(rng, ["LLC", "Corp", "Partnership", "LP"]), outcome: "approved" }),
  },
  {
    name: "ubo_rework_loop",
    weight: 12,
    build: (caseId, startTs, sm, rng) => {
      const base = buildHappyPath(caseId, startTs, sm, rng, { entity_type: pick(rng, ["LLC", "Corp"]), outcome: "approved" });
      // Insert a second "Identify Beneficial Owners" + "Run Sanctions" event after the first round
      const uboIdx = base.findIndex((e) => e.activity === "Identify Beneficial Owners");
      const sanctionsIdx = base.findIndex((e) => e.activity === "Run Sanctions & PEP Screening");
      if (uboIdx >= 0 && sanctionsIdx > uboIdx) {
        const reworkTs1 = addMs(base[sanctionsIdx].timestamp, hours(between(rng, 24, 72)));
        const reworkTs2 = addMs(reworkTs1, hours(between(rng, 4, 12)));
        base.splice(sanctionsIdx + 1, 0,
          { caseId, activity: "Identify Beneficial Owners", timestamp: reworkTs1, actor: "KYC Analyst (Commercial)", system: "nCino", attributes: { rework_reason: "ubo_docs_incomplete" } },
          { caseId, activity: "Run Sanctions & PEP Screening", timestamp: reworkTs2, actor: "KYC Analyst (Commercial)", system: "LexisNexis Bridger", attributes: { rework_reason: "rerun_after_ubo_update" } },
        );
        // Shift subsequent events forward
        const shift = hours(between(rng, 36, 96));
        for (let i = sanctionsIdx + 3; i < base.length; i++) {
          base[i].timestamp = addMs(base[i].timestamp, shift);
        }
      }
      return base;
    },
  },
  {
    name: "edd_escalation",
    weight: 14,
    build: (caseId, startTs, sm, rng) => {
      const base = buildHappyPath(caseId, startTs, sm, rng, { entity_type: pick(rng, ["LLC", "Corp"]), risk_flag: "pep_hit", outcome: "approved" });
      const eddIdx = base.findIndex((e) => e.activity === "Conduct Enhanced Due Diligence");
      if (eddIdx >= 0) {
        // EDD takes much longer + an extra compliance committee review event
        const escalationTs = addMs(base[eddIdx].timestamp, days(between(rng, 3, 8)));
        base.splice(eddIdx + 1, 0,
          { caseId, activity: "Conduct Enhanced Due Diligence", timestamp: escalationTs, actor: "BSA / AML Compliance Officer", system: "Refinitiv WorldCheck", attributes: { escalation: "compliance_committee_review" } },
        );
        const shift = days(between(rng, 5, 12));
        for (let i = eddIdx + 2; i < base.length; i++) {
          base[i].timestamp = addMs(base[i].timestamp, shift);
        }
      }
      return base;
    },
  },
  {
    name: "declined",
    weight: 7,
    build: (caseId, startTs, sm, rng) => {
      const truncated = sm.slice(0, between(rng, 6, 7));   // Stops at credit risk / mandate
      const events = buildHappyPath(caseId, startTs, truncated, rng, { entity_type: pick(rng, ["LLC", "Corp"]), outcome: "declined", decline_reason: pick(rng, ["credit_risk", "industry_blocked", "edd_failed"]) });
      return events;
    },
  },
  {
    name: "abandoned",
    weight: 5,
    build: (caseId, startTs, sm, rng) => {
      const stopAt = between(rng, 2, 5);
      return buildHappyPath(caseId, startTs, sm.slice(0, stopAt), rng, { entity_type: pick(rng, ["LLC", "Corp"]), outcome: "abandoned" });
    },
  },
  {
    name: "doc_rework_early",
    weight: 2,
    build: (caseId, startTs, sm, rng) => {
      const base = buildHappyPath(caseId, startTs, sm, rng, { entity_type: pick(rng, ["LLC", "Corp"]), outcome: "approved" });
      const verifyIdx = base.findIndex((e) => e.activity === "Verify Legal Entity");
      if (verifyIdx >= 0) {
        const reworkTs = addMs(base[verifyIdx].timestamp, hours(between(rng, 12, 48)));
        base.splice(verifyIdx + 1, 0,
          { caseId, activity: "Verify Legal Entity", timestamp: reworkTs, actor: "KYC Analyst (Commercial)", system: "Dun & Bradstreet", attributes: { rework_reason: "incorporation_docs_outdated" } },
        );
        const shift = hours(between(rng, 24, 72));
        for (let i = verifyIdx + 2; i < base.length; i++) base[i].timestamp = addMs(base[i].timestamp, shift);
      }
      return base;
    },
  },
];

// ── SME loan variants ─────────────────────────────────────────────────────
const SME_VARIANTS: VariantSpec[] = [
  {
    name: "happy_path",
    weight: 50,
    build: (caseId, startTs, sm, rng) => buildHappyPath(caseId, startTs, sm, rng, { loan_amount: between(rng, 50000, 750000), industry: pick(rng, ["retail", "professional_services", "construction", "manufacturing", "healthcare"]), outcome: "funded" }),
  },
  {
    name: "doc_rework",
    weight: 17,
    build: (caseId, startTs, sm, rng) => {
      const base = buildHappyPath(caseId, startTs, sm, rng, { loan_amount: between(rng, 50000, 750000), outcome: "funded" });
      const captureIdx = base.findIndex((e) => e.activity === "Capture Business Documentation");
      const verifyIdx = base.findIndex((e) => e.activity === "Verify Business Identity");
      if (captureIdx >= 0 && verifyIdx > captureIdx) {
        const reworkTs1 = addMs(base[verifyIdx].timestamp, hours(between(rng, 12, 36)));
        const reworkTs2 = addMs(reworkTs1, hours(between(rng, 6, 24)));
        base.splice(verifyIdx + 1, 0,
          { caseId, activity: "Capture Business Documentation", timestamp: reworkTs1, actor: "Loan Processor", system: "Encompass", attributes: { rework_reason: "missing_tax_return" } },
          { caseId, activity: "Verify Business Identity", timestamp: reworkTs2, actor: "Loan Processor", system: "Dun & Bradstreet", attributes: { rework_reason: "rerun_after_doc_update" } },
        );
        const shift = hours(between(rng, 36, 96));
        for (let i = verifyIdx + 3; i < base.length; i++) base[i].timestamp = addMs(base[i].timestamp, shift);
      }
      return base;
    },
  },
  {
    name: "manual_underwriting",
    weight: 12,
    build: (caseId, startTs, sm, rng) => {
      const base = buildHappyPath(caseId, startTs, sm, rng, { loan_amount: between(rng, 200000, 1500000), outcome: "funded", uw_path: "manual" });
      const analyseIdx = base.findIndex((e) => e.activity === "Analyse Financial Statements");
      if (analyseIdx >= 0) {
        // Manual review takes 3-5 days longer; add extra event for Senior Underwriter
        const extraTs = addMs(base[analyseIdx].timestamp, days(between(rng, 3, 5)));
        base.splice(analyseIdx + 1, 0,
          { caseId, activity: "Analyse Financial Statements", timestamp: extraTs, actor: "Senior Underwriter", system: "nCino", attributes: { escalation: "senior_review" } },
        );
        const shift = days(between(rng, 4, 7));
        for (let i = analyseIdx + 2; i < base.length; i++) base[i].timestamp = addMs(base[i].timestamp, shift);
      }
      return base;
    },
  },
  {
    name: "declined",
    weight: 13,
    build: (caseId, startTs, sm, rng) => {
      const stopAt = 8; // Stops at Make Credit Decision
      return buildHappyPath(caseId, startTs, sm.slice(0, stopAt), rng, { loan_amount: between(rng, 25000, 400000), outcome: "declined", decline_reason: pick(rng, ["debt_service_coverage", "fico_below_threshold", "industry_risk", "insufficient_collateral"]) });
    },
  },
  {
    name: "withdrawn",
    weight: 5,
    build: (caseId, startTs, sm, rng) => {
      const stopAt = between(rng, 4, 7);
      return buildHappyPath(caseId, startTs, sm.slice(0, stopAt), rng, { loan_amount: between(rng, 50000, 500000), outcome: "withdrawn", withdrawal_reason: pick(rng, ["found_other_lender", "no_response", "rate_too_high"]) });
    },
  },
  {
    name: "conditions_loop",
    weight: 3,
    build: (caseId, startTs, sm, rng) => {
      const base = buildHappyPath(caseId, startTs, sm, rng, { loan_amount: between(rng, 100000, 800000), outcome: "funded" });
      const receiveIdx = base.findIndex((e) => e.activity === "Receive Signed Documents");
      if (receiveIdx >= 0) {
        const conditionTs = addMs(base[receiveIdx].timestamp, days(between(rng, 1, 3)));
        base.splice(receiveIdx + 1, 0,
          { caseId, activity: "Receive Signed Documents", timestamp: conditionTs, actor: "SME Borrower", system: "DocuSign", attributes: { condition: "stipulation_re-signed" } },
        );
        const shift = days(between(rng, 2, 4));
        for (let i = receiveIdx + 2; i < base.length; i++) base[i].timestamp = addMs(base[i].timestamp, shift);
      }
      return base;
    },
  },
];

function generateCases(processKey: string, count: number, stepMap: StepMapping[], variants: VariantSpec[], seed: number, casePrefix: string): GenEvent[] {
  const rng = mulberry32(seed);
  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  const rangeMs = RANGE_END.getTime() - RANGE_START.getTime();

  const allEvents: GenEvent[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute case starts roughly evenly across range, with some jitter
    const caseId = `${casePrefix}-${String(i + 1).padStart(5, "0")}`;
    const startMs = RANGE_START.getTime() + (i / count) * rangeMs + (rng() - 0.5) * days(3);
    const startTs = new Date(startMs);

    // Pick variant
    let r = rng() * totalWeight;
    let chosen: VariantSpec = variants[0];
    for (const v of variants) {
      if (r < v.weight) { chosen = v; break; }
      r -= v.weight;
    }

    const events = chosen.build(caseId, startTs, stepMap, rng);
    allEvents.push(...events);
  }

  return allEvents;
}

// ──────────────────────────────────────────────────────────────────────────
// CSV writing + Upload row + EventLog seeding
// ──────────────────────────────────────────────────────────────────────────

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function writeAndIngestEvents(opts: {
  engagementId: string;
  processId: string;
  processSlug: string;
  events: GenEvent[];
  dataRequest: ReturnType<typeof buildDataRequest>;
  stepMap: StepMapping[];
}) {
  const { engagementId, processId, processSlug, events, dataRequest } = opts;

  // Group events by primary system → CSV file per system
  const bySystem = new Map<string, GenEvent[]>();
  for (const e of events) {
    if (!bySystem.has(e.system)) bySystem.set(e.system, []);
    bySystem.get(e.system)!.push(e);
  }

  // Ensure output directory exists
  const outDir = join(SAMPLE_DIR, `fifth-third-${processSlug}`);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const uploadByEvent = new Map<GenEvent, string>(); // event → uploadId

  for (const item of dataRequest.items) {
    const systemName = item.systemName;
    const systemEvents = (bySystem.get(systemName) ?? []).slice().sort((a, b) => (a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : a.timestamp.getTime() - b.timestamp.getTime()));

    const headers = ["case_id", "activity", "event_timestamp", "actor", "case_attributes"];
    const rows = systemEvents.map((e) => [
      e.caseId,
      e.activity,
      fmtTs(e.timestamp),
      e.actor,
      Object.entries(e.attributes).map(([k, v]) => `${k}=${v}`).join(";"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n") + "\n";
    writeFileSync(join(outDir, item.fileName), csv, "utf8");

    // Create Upload row (status correlated, rawData null since we seed EventLog directly)
    const upload = await prisma.upload.create({
      data: {
        fileName: item.fileName,
        originalName: item.fileName,
        systemSource: systemName,
        rowCount: systemEvents.length,
        columnCount: headers.length,
        sizeBytes: Buffer.byteLength(csv, "utf8"),
        schemaInference: {
          headers,
          columns: headers.map((h) => ({
            name: h,
            type: h === "event_timestamp" ? "timestamp" : "string",
            role: h === "case_id" ? "case_id" : h === "event_timestamp" ? "timestamp" : h === "activity" ? "activity" : h === "actor" ? "actor" : "attribute",
            sample: rows[0]?.[headers.indexOf(h)] ?? "",
          })),
          systemName,
          systemColor: item.systemColor,
        },
        // rawData omitted — already correlated; raw payload not needed (defaults to null)
        status: "correlated",
        engagementId,
        processId,
        dataRequestFileName: item.fileName,
        caseIdColumn: "case_id",
        activityColumn: "activity",
        timestampColumn: "event_timestamp",
        actorColumn: "actor",
      },
    });

    for (const e of systemEvents) uploadByEvent.set(e, upload.id);

    console.log(`     CSV: ${item.fileName} — ${rows.length} rows`);
  }

  // Now bulk insert EventLog rows. Sort for stable insert order.
  const sortedEvents = events.slice().sort((a, b) => {
    if (a.caseId !== b.caseId) return a.caseId < b.caseId ? -1 : 1;
    return a.timestamp.getTime() - b.timestamp.getTime();
  });

  const CHUNK = 1500;
  for (let i = 0; i < sortedEvents.length; i += CHUNK) {
    const slice = sortedEvents.slice(i, i + CHUNK);
    await prisma.eventLog.createMany({
      data: slice.map((e) => ({
        engagementId,
        processId,
        uploadId: uploadByEvent.get(e) ?? null,
        caseId: e.caseId,
        activity: e.activity,
        timestamp: e.timestamp,
        system: e.system,
        actor: e.actor,
        attributes: JSON.parse(JSON.stringify(e.attributes)),
      })),
    });
  }
  console.log(`     EventLog: ${sortedEvents.length} rows inserted across ${dataRequest.items.length} uploads`);
}

// ──────────────────────────────────────────────────────────────────────────
// Findings — call Claude using the existing pipeline
// ──────────────────────────────────────────────────────────────────────────

async function generateAndCacheFindings(engagementId: string, processId: string, processName: string) {
  const ctx = await loadFindingsContext(engagementId, processId);
  if ("error" in ctx) {
    console.log(`     ⚠ findings skipped: ${ctx.error}`);
    return;
  }
  const prompt = buildFindingsPrompt(ctx);
  console.log(`     calling Claude for findings (${processName})…`);

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`     ⚠ Claude call failed (findings will auto-generate on first UI click): ${msg.split("\n")[0]}`);
    return;
  }

  const raw = (message.content[0] as { text: string }).text.trim();
  let jsonStr = raw.startsWith("```") ? raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```\s*$/, "").trim() : raw;
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);

  const parsed = JSON.parse(jsonStr) as Omit<FindingsResult, "generatedAt">;
  const generatedAt = new Date();

  // Apply the same server-side reconciliation that the live API route does.
  const findings = parsed.findings ?? [];
  const sum = findings.reduce((s, f) => s + (f.annualValueLeak ?? 0), 0);
  const sumByVertex = { growth: 0, efficiency: 0, control: 0 };
  const countByVertex = { growth: 0, efficiency: 0, control: 0 };
  for (const f of findings) {
    const v = (f.elasticOpsVertex ?? "efficiency") as "growth" | "efficiency" | "control";
    sumByVertex[v] += f.annualValueLeak ?? 0;
    countByVertex[v] += 1;
  }

  const claudeOps = parsed.elasticOps;
  const result: FindingsResult = {
    ...parsed,
    generatedAt: generatedAt.toISOString(),
    totalAnnualValueLeak: sum,
    findings,
    elasticOps: {
      growth: {
        totalAnnualValueLeak: sumByVertex.growth,
        findingCount: countByVertex.growth,
        mainFactors: claudeOps?.growth?.mainFactors ?? [],
        summary: claudeOps?.growth?.summary ?? "",
      },
      efficiency: {
        totalAnnualValueLeak: sumByVertex.efficiency,
        findingCount: countByVertex.efficiency,
        mainFactors: claudeOps?.efficiency?.mainFactors ?? [],
        summary: claudeOps?.efficiency?.summary ?? "",
      },
      control: {
        totalAnnualValueLeak: sumByVertex.control,
        findingCount: countByVertex.control,
        mainFactors: claudeOps?.control?.mainFactors ?? [],
        summary: claudeOps?.control?.summary ?? "",
      },
    },
  };

  await prisma.engagementProcess.update({
    where: { id: processId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { findings: result as any, findingsGeneratedAt: generatedAt },
  });
  console.log(`     ✓ findings cached — ${findings.length} findings, $${sum.toLocaleString()} total leak`);
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("  Seed Fifth Third engagement — Commercial + SME");
  console.log("══════════════════════════════════════════════════════════════════");

  const user = await prisma.user.findFirst({ where: { email: "admin@backbase.com" } });
  if (!user) throw new Error("admin user not found");

  // ── Idempotent — wipe any prior Fifth Third engagement ──────────────────
  const existing = await prisma.engagement.findMany({ where: { clientName: CLIENT_NAME } });
  if (existing.length > 0) {
    console.log(`\nFound ${existing.length} prior Fifth Third engagement(s) — deleting (cascade removes processes, uploads, event logs).`);
    for (const e of existing) {
      await prisma.engagement.delete({ where: { id: e.id } });
    }
  }

  // ── Create engagement ───────────────────────────────────────────────────
  console.log("\n[1/6] Creating engagement");
  const engagement = await prisma.engagement.create({
    data: {
      name: ENGAGEMENT_NAME,
      clientName: CLIENT_NAME,
      status: "analyzing",
      country: COUNTRY,
      region: "North America",
      institutionType: "bank",
      aum: "$216B",
      employees: "10K–50K",
      customers: "1M–5M",
      coreBankingSystem: "FIS Premier / Fiserv DNA",
      createdById: user.id,
    },
  });
  console.log(`     ✓ engagement id=${engagement.id}`);

  const processConfigs = [
    {
      processKey: "commercial_onboarding",
      processName: "Commercial Account Onboarding",
      lineOfBusiness: "commercial",
      stepMap: COMMERCIAL_STEP_MAP,
      capabilities: COMMERCIAL_CAPABILITIES,
      metrics: COMMERCIAL_METRICS,
      caseCount: COMMERCIAL_CASES,
      variants: COMMERCIAL_VARIANTS,
      seed: 4242,
      casePrefix: "FT-COM-2025",
      processSlug: "commercial",
    },
    {
      processKey: "sme_loan_origination",
      processName: "SME Loan Origination",
      lineOfBusiness: "sme",
      stepMap: SME_STEP_MAP,
      capabilities: SME_CAPABILITIES,
      metrics: SME_METRICS,
      caseCount: SME_CASES,
      variants: SME_VARIANTS,
      seed: 1313,
      casePrefix: "FT-SME-2025",
      processSlug: "sme",
    },
  ];

  // ── For each process: create + populate ────────────────────────────────
  for (const cfg of processConfigs) {
    console.log(`\n[2/6] Process: ${cfg.processName}`);

    const template = await prisma.processTemplate.findFirst({ where: { processKey: cfg.processKey }, orderBy: { version: "desc" } });
    if (!template) throw new Error(`template ${cfg.processKey} not found`);

    const processMap = buildProcessMap(cfg.stepMap);
    const dataRequest = buildDataRequest(cfg.processName, cfg.stepMap);

    const orderCount = await prisma.engagementProcess.count({ where: { engagementId: engagement.id } });
    const ep = await prisma.engagementProcess.create({
      data: {
        engagementId: engagement.id,
        lineOfBusiness: cfg.lineOfBusiness,
        processKey: cfg.processKey,
        processName: cfg.processName,
        processMap: JSON.parse(JSON.stringify(processMap)),
        dataRequest: JSON.parse(JSON.stringify(dataRequest)),
        processCapabilities: cfg.capabilities,
        processMetrics: cfg.metrics,
        templateVersion: template.version,
        status: "analyzing",
        order: orderCount,
      },
    });
    console.log(`     ✓ EngagementProcess id=${ep.id}`);
    console.log(`     ✓ processMap: ${processMap.nodes.length} nodes (${processMap.summary.taskCount} tasks), ${processMap.edges.length} edges`);
    console.log(`     ✓ dataRequest: ${dataRequest.items.length} slots`);
    console.log(`     ✓ capabilities + metrics set`);

    console.log(`\n[3/6] Generating ${cfg.caseCount} cases (${cfg.processSlug})`);
    const events = generateCases(cfg.processKey, cfg.caseCount, cfg.stepMap, cfg.variants, cfg.seed, cfg.casePrefix);
    console.log(`     ✓ ${events.length} events generated`);

    console.log(`\n[4/6] Writing CSVs + Upload rows + EventLogs`);
    await writeAndIngestEvents({
      engagementId: engagement.id,
      processId: ep.id,
      processSlug: cfg.processSlug,
      events,
      dataRequest,
      stepMap: cfg.stepMap,
    });

    console.log(`\n[5/6] Generating findings via Claude`);
    await generateAndCacheFindings(engagement.id, ep.id, cfg.processName);
  }

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log(`  Done. Engagement: ${engagement.name}`);
  console.log(`  URL path: /engagements/${engagement.id}`);
  console.log("══════════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
