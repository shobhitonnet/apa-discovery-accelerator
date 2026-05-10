import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";

export interface GeneratedReason {
  category: "legitimate" | "operational" | "compliance" | "data_quality";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  investigationHint: string;
  valueModel: string;
  apaAgent?: string;
}

export interface GeneratedDeviationPattern {
  patternKey: string;       // e.g., "skip_kyc_home_mortgage"
  type: "skip" | "loop" | "out_of_order" | "extra_step";
  stepKeyword: string;      // regex source matching the affected step
  reasons: GeneratedReason[];
}

export interface GeneratedMetric {
  key: string;
  label: string;
  category: "time" | "volume" | "quality" | "outcome" | "cost" | "cx" | "workforce" | "compliance";
  source: "direct" | "inferred" | "assumed";
  unit: string;
  description: string;
  computation?: string;
  dependencies?: string[];
  formula?: string;
  defaultValue?: number;
  sourceHint?: string;
  goodThreshold?: number;
  poorThreshold?: number;
  direction?: "lower_is_better" | "higher_is_better";
  required?: boolean;
}

export interface GeneratedProcess {
  steps: { label: string; order: number; description: string }[];
  actors: { name: string; color: string; description: string; type: string }[];
  systems: { name: string; color: string; description: string; processTemplates: string[] }[];
  deviationPatterns: GeneratedDeviationPattern[];
  metricDefinitions: GeneratedMetric[];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { processName, processTemplate, save } = await request.json();
  if (!processName || !processTemplate) {
    return NextResponse.json({ error: "processName and processTemplate are required" }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a banking operations and process mining expert with deep knowledge of international banking standards (BPMN 2.0, ISO 20022, Basel III/IV, SWIFT, PSD2) and leading banking platforms (Temenos, Finastra, Finacle, Backbase, Salesforce Financial Services Cloud, nCino, FIS, Fiserv).

Generate a comprehensive reference process definition for: **${processName}**
Process template key: ${processTemplate}

Research this process as it is standardly practiced in retail and commercial banking, including:
- Industry-standard process steps in the correct sequence
- All human actors and their roles
- All technology systems typically involved
- BPMN best practices for this process type
- Common deviations seen in real-world process mining for this process, with banking-specific reasons each could occur

Return ONLY valid JSON in exactly this structure (no markdown, no explanation):
{
  "steps": [
    {
      "label": "Step name (concise, verb-noun format e.g. 'Verify Identity')",
      "order": 1,
      "description": "What happens in this step, who does it, what system is involved"
    }
  ],
  "actors": [
    {
      "name": "Actor name",
      "color": "#hexcolor",
      "description": "Role description in this process",
      "type": "customer|front-office|back-office|operations|fraud|compliance|external|automated"
    }
  ],
  "systems": [
    {
      "name": "System name",
      "color": "#hexcolor",
      "description": "System purpose and common vendors (e.g. Temenos T24, Finastra Fusion)",
      "processTemplates": ["${processTemplate}"]
    }
  ],
  "deviationPatterns": [
    {
      "patternKey": "skip_<step>_${processTemplate}",
      "type": "skip|loop|out_of_order|extra_step",
      "stepKeyword": "regex source matching the step name(s) this applies to, e.g. 'kyc|aml|identity'",
      "reasons": [
        {
          "category": "legitimate|operational|compliance|data_quality",
          "severity": "low|medium|high|critical",
          "title": "Short reason title (one phrase)",
          "description": "What's actually happening — be banking-specific",
          "investigationHint": "How a consultant would verify this on the data — what to filter, what attributes to check",
          "valueModel": "How to quantify the impact — fines, FTE-hours, loss rates etc. Be specific about which numbers to use.",
          "apaAgent": "Optional: which APA agent could automate the fix"
        }
      ]
    }
  ],
  "metricDefinitions": [
    {
      "key": "snake_case_key",
      "label": "Display label",
      "category": "time|volume|quality|outcome|cost|cx|workforce|compliance",
      "source": "direct|inferred|assumed",
      "unit": "days|hours|%|GBP/case|count|ratio",
      "description": "What this metric measures and why it matters",
      "computation": "(direct only) how it's computed from the event log, e.g. 'avg(case_end - case_start) across cases'",
      "dependencies": ["(inferred only) other metric keys + coefficient keys this depends on"],
      "formula": "(inferred only) human-readable formula, e.g. 'lead_time × fte_ops_hourly_rate × 0.6'",
      "defaultValue": 0,
      "sourceHint": "(assumed only) where the consultant should source this value",
      "goodThreshold": 3,
      "poorThreshold": 7,
      "direction": "lower_is_better|higher_is_better",
      "required": true
    }
  ]
}

Guidelines:
- Steps: 8-15 steps covering the full end-to-end journey including exceptions where relevant
- Actors: all human roles + automated system actors that touch this process
- Systems: all technology systems — core banking, middleware, specialist tools
- Colors: use distinct, professional hex colors per actor/system category:
  - Customer-facing: #3366FF blues
  - Front office: #26BC71 greens
  - Back office: #FFAC09 ambers
  - Risk/Fraud/Compliance: #EF4444 reds or #06B6D4 cyans
  - Automated/system: #64748B greys
  - Core systems: #F97316 oranges
  - Specialist tools: #8B2BE2 purples

DEVIATION PATTERNS — generate 8-12 patterns covering:
- Skipped steps (which steps in this process are commonly bypassed and why)
- Loops/rework (which steps commonly retry)
- Out-of-order events (which sequence violations are common)
- Extra steps (manual reviews, escalations, overrides)

For each pattern, provide 3-5 distinct candidate reasons (categorised legitimate / operational / compliance / data_quality). Reasons must be process-specific, not generic. The "valueModel" must reference real banking numbers (fine ranges, FTE rates, default uplifts) — use realistic UK retail-banking values when uncertain.

METRIC DEFINITIONS — generate 18-25 metrics covering all eight categories:
- Time (5-7): lead time, processing/touch time, wait time, cycle efficiency, P50/P90 distributions, time between specific milestones for THIS process
- Volume (1-2): cases per period, channel mix
- Quality (3-4): STP / first-time-right rate, rework rate per critical step, conformance %, variant count
- Outcome (2-3): completion / decline / abandonment rates specific to this process
- Cost (2-3): cost per case (inferred from FTE rates), FTE hours per case, step cost
- CX (2-3): touchpoints per case, drop-off per stage, customer effort proxy (composite)
- Workforce (2-3): avg handling time per role, cases per FTE, bottleneck actor
- Compliance (1-2): gate failure rate, audit-flagged cases

For each metric:
- "source: direct" → set "computation" describing the event-log calculation. Don't set defaultValue / sourceHint.
- "source: inferred" → set "dependencies" (array of metric keys + coefficient keys e.g. "fte_ops_hourly_rate") and a "formula" string.
- "source: assumed" → set "defaultValue" with a sensible UK retail-banking number, and "sourceHint" describing where the consultant might source the real number.

Targets:
- "goodThreshold" + "poorThreshold" + "direction" let the engagement page render red / amber / green. Use realistic banking benchmarks (e.g., onboarding lead time: good ≤ 1 day, poor ≥ 5 days).
- "required: true" only for the most critical 4-5 metrics.

Be specific to ${processName} — not generic banking steps. Every output should be defensible to a senior banking consultant.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 });
  }

  let jsonText = content.text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonText = jsonMatch[1].trim();

  const generated: GeneratedProcess = JSON.parse(jsonText);

  // If save=true, persist directly to the database
  if (save) {
    // Build sub-processes + metric definitions from the AI output so the new
    // ProcessTemplate has something useful out of the gate.
    const subProcesses = generated.steps.map((s) => ({
      key: s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      label: s.label,
      description: s.description,
    }));
    // Use the rich metric definitions from the agent. Fall back to a minimal
    // legacy set only if the agent didn't return any.
    const metricDefinitions = generated.metricDefinitions && generated.metricDefinitions.length > 0
      ? generated.metricDefinitions
      : [
          { key: "applicationsPerYear", label: "Applications per year", category: "volume", source: "assumed", unit: "count", description: "Total applications received", required: true },
          { key: "completionsPerYear",  label: "Completions per year",  category: "outcome", source: "assumed", unit: "count", description: "Successful completions", required: true },
        ];

    await Promise.all([
      // Legacy step library (kept for the canvas + old admin tab)
      ...generated.steps.map((s) =>
        prisma.processStepTemplate.create({
          data: { label: s.label, processTemplate, order: s.order, description: s.description },
        })
      ),
      ...generated.actors.map((a) =>
        prisma.processActor.create({
          data: { name: a.name, color: a.color, description: a.description, type: a.type },
        })
      ),
      ...generated.systems.map((s) =>
        prisma.applicationSystem.create({
          data: { name: s.name, color: s.color, description: s.description, processTemplates: s.processTemplates },
        })
      ),

      // ProcessTemplate row — visible in /admin/process. Upsert keeps regeneration idempotent.
      prisma.processTemplate.upsert({
        where: { processKey_version: { processKey: processTemplate, version: 1 } },
        create: {
          processKey: processTemplate,
          version: 1,
          isActive: false,
          name: processName,
          description: `Generated by AI for ${processName}.`,
          lineOfBusiness: processTemplate.startsWith("retail_") ? "retail" : processTemplate.startsWith("sme_") ? "sme" : "retail",
          applicableInstTypes: ["bank", "credit_union", "neobank"],
          defaultProcessMap: {} as object,
          subProcesses,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metricDefinitions: metricDefinitions as any,
          notes: `AI-generated reference. ${generated.steps.length} steps, ${generated.actors.length} actors, ${generated.systems.length} systems, ${generated.deviationPatterns?.length ?? 0} deviation patterns, ${metricDefinitions.length} metrics.`,
        },
        update: {
          name: processName,
          subProcesses,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metricDefinitions: metricDefinitions as any,
          notes: `AI-regenerated. ${generated.steps.length} steps, ${generated.actors.length} actors, ${generated.systems.length} systems, ${generated.deviationPatterns?.length ?? 0} deviation patterns, ${metricDefinitions.length} metrics.`,
        },
      }),

      // Deviation patterns scoped to this process. Upsert by patternKey.
      ...(generated.deviationPatterns ?? []).map((p) =>
        prisma.deviationPattern.upsert({
          where: { patternKey: p.patternKey },
          create: {
            patternKey: p.patternKey,
            type: p.type,
            stepKeyword: p.stepKeyword,
            processKey: processTemplate,
            country: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            reasons: p.reasons as any,
          },
          update: {
            type: p.type,
            stepKeyword: p.stepKeyword,
            processKey: processTemplate,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            reasons: p.reasons as any,
          },
        })
      ),
    ]);
    return NextResponse.json({ saved: true, generated });
  }

  return NextResponse.json({ saved: false, generated });
}
