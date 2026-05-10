import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Process-specific happy paths to anchor the AI
const HAPPY_PATHS: Record<string, { steps: string[]; description: string }> = {
  retail_mortgage: {
    description: "End-to-end home mortgage origination from application to fund disbursement",
    steps: ["Lead Capture", "Application Submission", "ID Verification", "Credit Check", "Document Collection", "Property Valuation", "Underwriting Decision", "Offer Generation", "Offer Acceptance", "Conveyancing", "Completion", "Funds Transfer"],
  },
  retail_onboarding: {
    description: "New-to-bank customer onboarding including KYC, account opening, and product activation",
    steps: ["Application Start", "Personal Details Capture", "ID Verification", "KYC / AML Screening", "Account Opening", "Card Issuance", "Digital Banking Enrollment", "Welcome Communication", "First Transaction Enablement"],
  },
  retail_dispute: {
    description: "Card or payment dispute from customer notification through investigation to resolution",
    steps: ["Dispute Raised", "Case Created", "Provisional Credit Issued", "Transaction Investigation", "Merchant Contact", "Evidence Review", "Decision", "Final Settlement", "Case Closure"],
  },
  retail_personal_loan: {
    description: "Unsecured personal loan origination from application to disbursement",
    steps: ["Application Submission", "Identity Verification", "Credit Bureau Check", "Affordability Assessment", "Document Collection", "Underwriting Decision", "Offer Generation", "Offer Acceptance", "Loan Account Setup", "Funds Disbursement"],
  },
  sme_loan: {
    description: "SME business loan origination from enquiry to disbursement including financial analysis",
    steps: ["Enquiry", "Application Submission", "KYB / KYC Check", "Credit Assessment", "Financial Spreading", "Document Collection", "Underwriting", "Credit Committee Approval", "Offer Letter", "Acceptance", "Account Setup", "Disbursement"],
  },
};

// Human-readable labels for process metric keys
const METRIC_LABELS: Record<string, Record<string, string>> = {
  retail_onboarding: {
    applicationsPerYear: "New applications per year",
    onboardingsPerYear:  "Successful onboardings per year",
    avgOnboardDays:      "Avg time to onboard (days)",
    kycFailureRate:      "KYC failure rate (%)",
  },
  retail_personal_loan: {
    applicationsPerYear: "Loan applications per year",
    disbursedPerYear:    "Loans disbursed per year",
    avgTatDays:          "Avg turnaround time (days)",
    declineRate:         "Decline rate (%)",
  },
};

// Sub-process labels for capability keys
const CAPABILITY_LABELS: Record<string, Record<string, string>> = {
  retail_onboarding: {
    customer_application:  "Customer Application",
    identity_verification: "Identity Verification",
    kyc_aml_screening:     "KYC / AML Screening",
    account_opening:       "Account Opening",
    card_issuance:         "Card Issuance",
    digital_enrollment:    "Digital Banking Enrollment",
  },
  retail_personal_loan: {
    loan_application:          "Loan Application",
    identity_verification:     "Identity Verification",
    credit_bureau_check:       "Credit Bureau Check",
    affordability_assessment:  "Affordability Assessment",
    document_collection:       "Document Collection",
    underwriting_decision:     "Underwriting & Decision",
    offer_acceptance:          "Offer & Acceptance",
    disbursement:              "Disbursement",
  },
};

const INTEGRATION_LABELS: Record<string, string> = {
  integrated:           "Fully integrated — data flows automatically with no manual re-entry",
  partial_integration:  "Partially integrated — some connections exist but manual handoffs remain",
  siloed:               "Siloed — systems operate independently, data is re-entered at each step",
};

function buildClientContext(
  processKey: string,
  metrics: Record<string, string> | null,
  capabilities: Record<string, string> | null,
): string {
  const lines: string[] = [];

  if (metrics) {
    const labels = METRIC_LABELS[processKey] ?? {};
    const metricLines = Object.entries(metrics)
      .filter(([k, v]) => v && k !== "notes" && labels[k])
      .map(([k, v]) => `  - ${labels[k]}: ${v}`);
    if (metricLines.length > 0) {
      lines.push("PROCESS SCALE (from discovery workshop):");
      lines.push(...metricLines);
      if (metrics.notes) lines.push(`  - Additional context: ${metrics.notes}`);
    }
  }

  if (capabilities) {
    const labels = CAPABILITY_LABELS[processKey] ?? {};
    const capLines = Object.entries(capabilities)
      .filter(([k, v]) => v && k !== "integrationStatus" && labels[k])
      .map(([k, v]) => `  - ${labels[k]}: ${v}`);
    if (capLines.length > 0) {
      lines.push("\nCURRENT DIGITAL MATURITY (use this to decide where manual steps, exception paths, and decision gateways should appear):");
      lines.push(...capLines);
    }
    if (capabilities.integrationStatus) {
      lines.push(`\nSYSTEM INTEGRATION: ${INTEGRATION_LABELS[capabilities.integrationStatus] ?? capabilities.integrationStatus}`);
      if (capabilities.integrationStatus === "siloed") {
        lines.push("  → Model explicit data hand-off or re-keying steps between siloed systems.");
      } else if (capabilities.integrationStatus === "partial_integration") {
        lines.push("  → Show integration gaps as manual steps or exception branches where systems don't connect.");
      }
    }
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { context, processId, processTemplate } = await req.json();

  const engagement = await prisma.engagement.findUnique({ where: { id } });
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Resolve process name, key and saved context — prefer EngagementProcess if processId given
  let processName = engagement.name;
  let processKey = processTemplate ?? engagement.processTemplate ?? "generic";
  let savedMetrics: Record<string, string> | null = null;
  let savedCapabilities: Record<string, string> | null = null;

  if (processId) {
    const proc = await prisma.engagementProcess.findUnique({
      where: { id: processId, engagementId: id },
    });
    if (proc) {
      processName = proc.processName;
      processKey = proc.processKey;
      const p = proc as unknown as { processMetrics?: unknown; processCapabilities?: unknown };
      savedMetrics      = (p.processMetrics      ?? null) as Record<string, string> | null;
      savedCapabilities = (p.processCapabilities ?? null) as Record<string, string> | null;
    }
  }

  const happyPath = HAPPY_PATHS[processKey];

  const [actors, systems] = await Promise.all([
    prisma.processActor.findMany({ orderBy: { name: "asc" } }),
    prisma.applicationSystem.findMany({ orderBy: { name: "asc" } }),
  ]);

  const actorList = actors.map((a) => `  - ${a.name} (${a.type}): ${a.description}`).join("\n");
  const systemList = systems.map((s) => `  - ${s.name}: ${s.description}`).join("\n");

  const clientContext = buildClientContext(processKey, savedMetrics, savedCapabilities);

  const prompt = `You are a senior banking process architect with deep expertise in BPMN 2.0 and digital banking operations.

Generate a complete BPMN process model as React Flow nodes and edges for the following:

PROCESS: ${processName}
CLIENT: ${engagement.clientName}
DESCRIPTION: ${happyPath?.description ?? processName}
${context ? `CONSULTANT CONTEXT: ${context}` : ""}
${clientContext ? `\n${clientContext}` : ""}

${happyPath ? `EXPECTED PROCESS STEPS (use these as the backbone — you may add decision gateways between them):
${happyPath.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}` : ""}

AVAILABLE ACTORS (assign only from this list):
${actorList || "  - Customer, Relationship Manager, Operations Analyst, Compliance Officer, System"}

AVAILABLE SYSTEMS (assign only from this list):
${systemList || "  - Core Banking System, CRM, Document Management, Identity Verification, Notification Service"}

BPMN RULES:
1. Start with exactly one startEvent node, end with exactly one endEvent node
2. Use task nodes for each process step
3. Use xorGateway for decisions (e.g. Approved / Rejected, Pass / Fail) — every opening XOR must have a closing XOR to merge branches
4. Use parallelGateway only when steps genuinely happen simultaneously — every opening parallel must close
5. Each task should have 1-2 actors and 1-2 systems from the lists above
6. Keep the model realistic for a ${engagement.clientName} banking context

NODE SCHEMA:
- startEvent: { id: string, type: "startEvent", position: {x, y}, data: { label: "Start" } }
- endEvent: { id: string, type: "endEvent", position: {x, y}, data: { label: "End" } }
- task: { id: string, type: "task", position: {x, y}, data: { label: string, actors: [{name: string, color: string}], systems: [{name: string, color: string}], order: number } }
- xorGateway: { id: string, type: "xorGateway", position: {x, y}, data: { label: string } }
- parallelGateway: { id: string, type: "parallelGateway", position: {x, y}, data: { label: string } }

EDGE SCHEMA:
{ id: string, source: string, target: string, type: "smoothstep", label?: string }
XOR outbound edges must have labels (e.g. "Approved" / "Rejected").

ACTOR COLORS:
${actors.map((a) => `  - ${a.name}: "${a.color}"`).join("\n") || '  - Use "#3366FF" as default'}

SYSTEM COLORS:
${systems.map((s) => `  - ${s.name}: "${s.color}"`).join("\n") || '  - Use "#64748B" as default'}

LAYOUT RULES — TOP-DOWN flow (process flows from top to bottom). Follow exactly.

Main flow axis — Y increases downward:
- Start node: x=380, y=60
- Each subsequent node: y += 180 (tasks) or y += 140 (gateways, which are 52px tall)
- End node: always at the BOTTOM of the diagram, x=380, after all branches merge

X-axis — used only for branching:
- Main happy path: x=380 (centre)
- Exception / rejection branch (fail, invalid, rejected): x=720 (right of centre)
- Parallel branch left: x=160
- Parallel branch right: x=600

Branch rules:
- When a XOR gateway splits: happy/pass path continues straight down at x=380; rejection/fail task goes to x=720 at the same y as the gateway, then continues downward
- Rejection paths must eventually connect to the single End node at the bottom centre
- Parallel branches fan left (x=160) and right (x=600) at the same y level, each with their own tasks stacked downward, then a closing parallel gateway at x=380 merges them back

End node rules:
- ONE End node only — at the bottom centre (x=380)
- Rejection and exception paths MUST connect to this same End node
- Place End node at y = last main task y + 180

Node sizes for spacing:
- task: ~200×90px — centre at x means left edge at x-100
- startEvent / endEvent: 48px circle
- xorGateway / parallelGateway: 52×52px diamond

Minimum gaps:
- 180px vertical between any two vertically connected nodes
- 200px horizontal between parallel branch columns
- Never overlap two nodes

Return ONLY valid JSON — no markdown, no explanation:
{ "nodes": [...], "edges": [...] }`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    const jsonStr = raw.startsWith("```") ? raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```\s*$/, "").trim() : raw;
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    const cleaned = firstBrace !== -1 && lastBrace !== -1 ? jsonStr.slice(firstBrace, lastBrace + 1) : jsonStr;
    const model = JSON.parse(cleaned) as { nodes: unknown[]; edges: unknown[] };

    return NextResponse.json(model);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI model generation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
