import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import JSZip from "jszip";
import type { DataRequest, DataRequestItem } from "@/app/api/engagements/[id]/data-request/route";

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

// ──────────────────────────────────────────────────────────────────────────
// Field-name → realistic banking value generator
// ──────────────────────────────────────────────────────────────────────────

type Case = {
  caseId: string;
  customerId: string;
  accountId: string;
  cardId: string;
  channel: string;
  product: string;
  appliedAt: Date;
  decisionAt: Date;
  decisionOutcome: "approved" | "declined";
};

const DEFAULT_N_CASES = 5000;
const START_DATE = new Date("2024-01-15T08:00:00Z");

function buildCases(seed: number, nCases: number): Case[] {
  const rng = mulberry32(seed);
  const pick = <T>(a: T[]) => a[Math.floor(rng() * a.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const channels = ["web", "mobile_app", "branch", "phone"];
  const products = ["current_account", "savings_account", "joint_account"];
  const cases: Case[] = [];
  // Spread cases across ~6-9 months so timestamps look realistic at scale
  const avgGapMin = Math.max(15, Math.round((180 * 24 * 60) / nCases));
  for (let i = 0; i < nCases; i++) {
    const id = String(i + 1).padStart(5, "0");
    const appliedAt = new Date(START_DATE.getTime() + i * between(Math.max(5, Math.floor(avgGapMin * 0.5)), Math.floor(avgGapMin * 1.5)) * 60_000);
    const declined = rng() < 0.12;
    const decisionAt = new Date(appliedAt.getTime() + between(8, 72) * 3600_000);
    cases.push({
      caseId: `APP-2024-${id}`,
      customerId: `CUST-${100000 + i + 1}`,
      accountId: `ACC-${200000 + i + 1}`,
      cardId: `CARD-${300000 + i + 1}`,
      channel: pick(channels),
      product: pick(products),
      appliedAt, decisionAt,
      decisionOutcome: declined ? "declined" : "approved",
    });
  }
  return cases;
}

const fmtTs = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);

// Detect role from a field name
function fieldRole(name: string): "case_id" | "timestamp" | "actor" | "amount" | "status" | "id" | "name" | "code" | "outcome" | "score" | "channel" | "method" | "type" | "other" {
  const n = name.toLowerCase();
  if (/(application|case|claim|application[_-]?id|app[_-]?id|case[_-]?id)$/.test(n) && !/customer/.test(n)) return "case_id";
  if (/(application_id|app_id|case_id|claim_id)/.test(n)) return "case_id";
  // Timestamp: any of the canonical date/time keywords or temporal-action suffixes
  if (/(time(stamp)?|date|when|at$|_at$|_dt$|_on$|_time$|_start$|_end$|_completed$|_received$|_sent$|_created$|_updated$|_processed$|_finished$|_opened$|_closed$|_resolved$|_verified$|_checked$|_approved$|_declined$|_rejected$|_screened$|_issued$|_delivered$|_responded$|_initiated$|_terminated$|_submitted$|_decisioned$)/.test(n)) return "timestamp";
  if (/(performed_by|by$|user|agent|officer|underwriter|who|actor)/.test(n)) return "actor";
  if (/(amount|balance|value|cost|fee|payment|salary|income)/.test(n)) return "amount";
  if (/(status|stage|state)/.test(n)) return "status";
  if (/(outcome|decision|result|verdict)/.test(n)) return "outcome";
  if (/(score|rating|risk)/.test(n)) return "score";
  if (/(channel|source|medium)/.test(n)) return "channel";
  if (/(method|mechanism|technique|verification_method|delivery)/.test(n)) return "method";
  if (/(type|category|class|kind|product)/.test(n)) return "type";
  if (/(branch|code|reference|ref)/.test(n)) return "code";
  if (/(name|customer|applicant)/.test(n)) return "name";
  if (/(id$|_id$|identifier|number)/.test(n)) return "id";
  return "other";
}

function genValue(field: string, role: ReturnType<typeof fieldRole>, c: Case, ts: Date, item: DataRequestItem, rng: () => number): string {
  const pick = <T>(a: T[]) => a[Math.floor(rng() * a.length)];
  const fieldL = field.toLowerCase();

  switch (role) {
    case "case_id":
      return c.caseId;
    case "timestamp":
      return fmtTs(ts);
    case "actor":
      return pick(["customer", "front_office_agent", "compliance_officer", "underwriter", "system", "fraud_analyst"]);
    case "amount":
      return String(Math.floor(rng() * 100_000) + 1000);
    case "status":
      return pick(["submitted", "in_progress", "completed", "pending"]);
    case "outcome":
      if (fieldL.includes("decision")) return c.decisionOutcome;
      return pick(["pass", "fail", "pending", "approved", "declined"]);
    case "score":
      return String(500 + Math.floor(rng() * 350));
    case "channel":
      return c.channel;
    case "method":
      if (fieldL.includes("verification")) return pick(["passport", "national_id", "drivers_license"]);
      return pick(["email", "sms", "push", "branch"]);
    case "type":
      if (fieldL.includes("card")) return pick(["debit_visa", "debit_mastercard"]);
      if (fieldL.includes("product")) return c.product;
      return pick(["standard", "premium", "basic"]);
    case "code":
      if (fieldL.includes("branch")) return pick(["BR-LON-001", "BR-MAN-002", "BR-BIR-003", "BR-EDI-004"]);
      return `${item.systemName.replace(/[^A-Z]/g, "").slice(0, 3) || "REF"}-${String(Math.floor(rng() * 9999)).padStart(4, "0")}`;
    case "name":
      if (fieldL.includes("customer") || fieldL.includes("applicant")) return `Customer ${c.caseId.slice(-4)}`;
      return `Record ${c.caseId.slice(-4)}`;
    case "id":
      if (fieldL.includes("customer")) return c.customerId;
      if (fieldL.includes("account")) return c.accountId;
      if (fieldL.includes("card")) return c.cardId;
      return `${field.toUpperCase().slice(0, 3)}-${c.caseId.slice(-4)}`;
    default:
      return pick(["yes", "no", "n/a", "true", "false", ""]);
  }
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// ──────────────────────────────────────────────────────────────────────────
// Event generator — produces a per-item event list, applying scenarios so
// the resulting graph has visible deviations.
// ──────────────────────────────────────────────────────────────────────────

type CaseEvent = { case: Case; timestamp: Date };

type Scenario =
  | { type: "standard" }
  | { type: "rejected_after_kyc" }
  | { type: "rejected_at_fraud" }
  | { type: "rework_kyc" }                      // KYC self-loop (duplicate event)
  | { type: "rework_kyc_triple" }                // KYC fired 3× (very rare)
  | { type: "missing_credit" }                   // skip the credit phase
  | { type: "missing_fraud" }                    // skip the fraud phase
  | { type: "express_path" }                     // skip BOTH credit and fraud
  | { type: "out_of_order"; swapIdx: number }    // swap two adjacent phases
  | { type: "out_of_order_severe"; idxA: number; idxB: number }; // swap two non-adjacent phases

function isDeclineOnlyItem(item: DataRequestItem): boolean {
  const text = (item.linkedSteps.join(" ") + " " + item.fileName + " " + item.description).toLowerCase();
  return /(reject|decline|cancell|aborted|abandoned)/.test(text);
}

function isPostDecisionItem(item: DataRequestItem): boolean {
  const text = (item.linkedSteps.join(" ") + " " + item.fileName).toLowerCase();
  return /(account_open|card|welcome|enrollment|enrolment|disburs|fund|notification|email|sms|onboard|activat)/.test(text);
}

function findItemIdx(items: DataRequestItem[], re: RegExp): number {
  return items.findIndex((it) => {
    const text = (it.linkedSteps.join(" ") + " " + it.fileName + " " + it.description).toLowerCase();
    return re.test(text);
  });
}

function buildAllEvents(cases: Case[], items: DataRequestItem[], seed: number): Map<string, CaseEvent[]> {
  const eventsByItem = new Map<string, CaseEvent[]>();
  for (const it of items) eventsByItem.set(it.fileName, []);

  // ALL positions where a decline-only item sits (e.g., Reject Application AND Decline Application)
  const declineIndices = items.map((it, i) => (isDeclineOnlyItem(it) ? i : -1)).filter((i) => i >= 0);
  const kycIdx = findItemIdx(items, /(kyc|identity|aml|verification|screen)/);
  const creditIdx = findItemIdx(items, /(credit|bureau|affordability)/);
  const fraudIdx = findItemIdx(items, /(fraud|risk)/);

  for (let ci = 0; ci < cases.length; ci++) {
    const c = cases[ci];
    const rng = mulberry32(seed + ci * 7919);

    // For declined cases: pick which decline path this case takes (early Reject vs. late Decline)
    let chosenDeclineIdx = -1;
    if (c.decisionOutcome === "declined" && declineIndices.length > 0) {
      // 30% take the earliest decline point, 70% take the latest — gives both paths visible mass
      const earlyOrLate = rng();
      if (declineIndices.length > 1 && earlyOrLate < 0.3) {
        chosenDeclineIdx = declineIndices[0];
      } else {
        chosenDeclineIdx = declineIndices[declineIndices.length - 1];
      }
    }

    // Pick scenario per case — scoped by decision outcome.
    // The probabilities create a long-tail of rare patterns so the Paths slider
    // has real differentiation to show.
    const r = rng();
    let scenario: Scenario;
    if (c.decisionOutcome === "declined") {
      if (r < 0.65) scenario = { type: "standard" };
      else if (r < 0.85 && kycIdx >= 0) scenario = { type: "rejected_after_kyc" };
      else if (fraudIdx >= 0) scenario = { type: "rejected_at_fraud" };
      else scenario = { type: "standard" };
    } else {
      // Approved cases — wider variety of rare deviations
      if      (r < 0.55) scenario = { type: "standard" };
      else if (r < 0.65) scenario = { type: "rework_kyc" };           // 10% — visible KYC loop
      else if (r < 0.68) scenario = { type: "rework_kyc_triple" };    // 3%  — rarer
      else if (r < 0.74) scenario = { type: "missing_credit" };       // 6%  — credit-skip
      else if (r < 0.78) scenario = { type: "missing_fraud" };        // 4%  — fraud-skip
      else if (r < 0.81) scenario = { type: "express_path" };         // 3%  — skip both
      else if (r < 0.91 && items.length >= 3) {
        scenario = { type: "out_of_order", swapIdx: 1 + Math.floor(rng() * (items.length - 2)) };
      }                                                                // 10%
      else if (items.length >= 5) {
        // 9% — severe out-of-order: pick two non-adjacent indices
        const idxA = 1 + Math.floor(rng() * (items.length - 3));
        const idxB = idxA + 2 + Math.floor(rng() * (items.length - idxA - 2));
        scenario = { type: "out_of_order_severe", idxA, idxB };
      } else scenario = { type: "standard" };
    }

    const totalDurationMs = (c.decisionAt.getTime() - c.appliedAt.getTime()) + 5 * 86400_000;
    const phaseDurationMs = totalDurationMs / items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isDecline = isDeclineOnlyItem(item);

      // Approved cases never emit decline-only items
      if (c.decisionOutcome === "approved" && isDecline) continue;

      // Declined cases: emit ONLY the chosen decline event (skip other decline points)
      if (c.decisionOutcome === "declined") {
        if (isDecline && i !== chosenDeclineIdx) continue;
        // Terminate at the chosen decline event — nothing later
        if (chosenDeclineIdx >= 0 && i > chosenDeclineIdx) continue;
      }

      // Scenario-specific early termination (declined cases)
      if (scenario.type === "rejected_after_kyc" && kycIdx >= 0 && i > kycIdx && !isDecline) continue;
      if (scenario.type === "rejected_at_fraud" && fraudIdx >= 0 && i > fraudIdx && !isDecline) continue;

      // Scenario-specific phase skip (approved cases)
      if (scenario.type === "missing_credit" && creditIdx >= 0 && i === creditIdx) continue;
      if (scenario.type === "missing_fraud" && fraudIdx >= 0 && i === fraudIdx) continue;
      if (scenario.type === "express_path" && (i === creditIdx || i === fraudIdx)) continue;

      // Probabilistic skip for non-must-have. Must-have files never skip —
      // every case must produce an event for them (otherwise the graph shows
      // logically-impossible paths like "Review without Submit").
      const skipRate = item.moscow === "must_have" ? 0 : item.moscow === "should_have" ? 0.10 : 0.30;
      if (rng() < skipRate) continue;

      // Compute phase index — handles adjacent and non-adjacent swaps
      let phaseIdx = i;
      if (scenario.type === "out_of_order") {
        if (i === scenario.swapIdx) phaseIdx = scenario.swapIdx + 1;
        else if (i === scenario.swapIdx + 1) phaseIdx = scenario.swapIdx;
      }
      if (scenario.type === "out_of_order_severe") {
        if (i === scenario.idxA) phaseIdx = scenario.idxB;
        else if (i === scenario.idxB) phaseIdx = scenario.idxA;
      }

      const phaseStartMs = c.appliedAt.getTime() + (phaseIdx / items.length) * totalDurationMs;
      const eventTs = new Date(phaseStartMs + (rng() * 0.85 + 0.05) * phaseDurationMs);

      eventsByItem.get(item.fileName)!.push({ case: c, timestamp: eventTs });

      // Rework: duplicate KYC event creates a self-loop in the graph
      if (scenario.type === "rework_kyc" && kycIdx >= 0 && i === kycIdx) {
        const reworkTs = new Date(eventTs.getTime() + phaseDurationMs * 0.3);
        eventsByItem.get(item.fileName)!.push({ case: c, timestamp: reworkTs });
      }
      // Triple rework: 3 KYC events — even rarer self-loop pattern
      if (scenario.type === "rework_kyc_triple" && kycIdx >= 0 && i === kycIdx) {
        eventsByItem.get(item.fileName)!.push({ case: c, timestamp: new Date(eventTs.getTime() + phaseDurationMs * 0.25) });
        eventsByItem.get(item.fileName)!.push({ case: c, timestamp: new Date(eventTs.getTime() + phaseDurationMs * 0.5) });
      }
    }
  }

  return eventsByItem;
}

function buildCsv(item: DataRequestItem, events: CaseEvent[], seed: number): string {
  const rng = mulberry32(seed);
  const headers = item.fields.length > 0 ? item.fields : ["case_id", "timestamp", "status"];
  const roles = headers.map((h) => fieldRole(h));
  const lines = [headers.map(csvEscape).join(",")];

  // Sort events by timestamp for nicer-looking CSVs
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (const e of sorted) {
    const row = headers.map((h, idx) => csvEscape(genValue(h, roles[idx], e.case, e.timestamp, item, rng)));
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
}

// ──────────────────────────────────────────────────────────────────────────
// Route — GET returns a ZIP of all sample CSVs matching the data request
// ──────────────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;
  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("cases") ?? DEFAULT_N_CASES);
  const nCases = Math.min(Math.max(Number.isFinite(requested) ? requested : DEFAULT_N_CASES, 10), 10000);

  const proc = await prisma.engagementProcess.findUnique({
    where: { id: processId, engagementId: id },
  });
  if (!proc) return NextResponse.json({ error: "Process not found" }, { status: 404 });

  const dataRequest = proc.dataRequest as unknown as DataRequest | null;
  if (!dataRequest?.items?.length) {
    return NextResponse.json({ error: "No data request found for this process" }, { status: 400 });
  }

  // Sort items by their first linkedStep's position in the process map.
  // We use the node's Y coordinate (canvas is top-down, so smaller y = earlier in
  // the flow). This is more robust than the `order` field, which can drift if the
  // consultant rearranges nodes after creation. We also fuzzy-match because Claude
  // sometimes paraphrases the linkedSteps text vs the canvas label.
  const processMap = proc.processMap as {
    nodes?: Array<{ type?: string; position?: { x?: number; y?: number }; data?: { label?: string; order?: number } }>;
  } | null;
  const stepOrderByLabel = new Map<string, number>();
  let insertionIdx = 0;
  for (const n of processMap?.nodes ?? []) {
    if (n.type !== "task") continue; // gateways/start/end don't anchor data-request items
    const label = n.data?.label;
    if (!label) continue;
    // Prefer Y position (visual top-down order), fall back to `order`, then insertion idx
    const yPos = typeof n.position?.y === "number" ? n.position.y : null;
    const explicitOrd = typeof n.data?.order === "number" ? n.data.order : null;
    const finalOrd = yPos ?? explicitOrd ?? insertionIdx * 1000;
    if (!stepOrderByLabel.has(label)) stepOrderByLabel.set(label, finalOrd);
    insertionIdx++;
  }

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  function lookupStepOrder(linkedStep: string | undefined): number {
    if (!linkedStep) return 9999;
    if (stepOrderByLabel.has(linkedStep)) return stepOrderByLabel.get(linkedStep)!;
    const target = norm(linkedStep);
    for (const [label, ord] of stepOrderByLabel) {
      const lab = norm(label);
      if (lab === target || lab.includes(target) || target.includes(lab)) return ord;
    }
    return 9999;
  }

  // Banking-phase heuristic — recognises canonical process stages by keywords.
  // This is the primary sort key because it's robust to data-request item ordering
  // and to process-map position drift. Y-position is the tiebreaker.
  function getBankingPhase(linkedStep: string | undefined): number {
    if (!linkedStep) return 99;
    const s = linkedStep.toLowerCase();
    if (/(submit|capture|intake|application[\s_]+start|initiat|origin|enquir|apply)/.test(s)) return 0;
    if (/(initial[\s_]+(review|valid)|application[\s_]+(valid|review)|preliminary|triage)/.test(s)) return 1;
    if (/(reject)/.test(s)) return 2;
    if (/(kyc|identity|aml|due[\s_]+dilig|customer[\s_]+(verif|screen))/.test(s)) return 3;
    if (/(document[\s_]+(coll|gather|upload|provid))/.test(s)) return 4;
    if (/(credit[\s_]+(check|bureau|score)|bureau|affordability|income[\s_]+verif)/.test(s)) return 5;
    if (/(fraud|risk[\s_]+(screen|check|assess))/.test(s)) return 6;
    if (/(decision|underwrit|approval|verdict|final[\s_]+review|all[\s_]+checks)/.test(s)) return 7;
    if (/(decline|cancel)/.test(s)) return 8;
    if (/(account[\s_]+(open|creat|setup|provision))/.test(s)) return 9;
    if (/(document[\s_]+(generat|prep))|generate[\s_]+account|paperwork/.test(s)) return 10;
    if (/(card[\s_]+(issu|order|deliv))/.test(s)) return 11;
    if (/(disburs|fund[\s_]+transfer|payout|loan[\s_]+disburs)/.test(s)) return 12;
    if (/(welcome|notification|email|sms|onboard|enrol|activat)/.test(s)) return 13;
    return 99;
  }

  const sortedItems = [...dataRequest.items].sort((a, b) => {
    const aPhase = getBankingPhase(a.linkedSteps[0]);
    const bPhase = getBankingPhase(b.linkedSteps[0]);
    if (aPhase !== bPhase) return aPhase - bPhase;
    // Tiebreaker: process-map Y position / order
    return lookupStepOrder(a.linkedSteps[0]) - lookupStepOrder(b.linkedSteps[0]);
  });

  // Debug: print sorted order so we can verify it's right
  console.log("[sample-csvs] sorted items:");
  for (let i = 0; i < sortedItems.length; i++) {
    const it = sortedItems[i];
    const phase = getBankingPhase(it.linkedSteps[0]);
    console.log(`  ${i}: phase=${phase} | linkedSteps[0]="${it.linkedSteps[0]}" | fileName="${it.fileName}"`);
  }

  // Build a stable case set seeded by the processId
  const seed = Array.from(processId).reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 7);
  const cases = buildCases(seed, nCases);

  // Generate events with scenario-based variations
  const eventsByItem = buildAllEvents(cases, sortedItems, seed);

  // Build each CSV from its event list
  const zip = new JSZip();
  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    const events = eventsByItem.get(item.fileName) ?? [];
    const csv = buildCsv(item, events, seed + i * 17);
    zip.file(item.fileName, csv);
  }

  const buf = await zip.generateAsync({ type: "uint8array" });

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="sample-csvs-${proc.processName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.zip"`,
    },
  });
}
