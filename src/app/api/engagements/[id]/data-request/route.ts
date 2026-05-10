import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type MoSCoW = "must_have" | "should_have" | "could_have";

export interface DataRequestItem {
  fileName: string;
  systemName: string;
  systemColor: string;
  description: string;
  fields: string[];
  format: string;
  timeRange: string;
  linkedSteps: string[];
  moscow: MoSCoW;
  digitalTwinValue: string;  // What capability does providing this data unlock?
}

export interface DataRequest {
  generatedAt: string;
  processName: string;
  clientName: string;
  coveringNote: string;
  items: DataRequestItem[];  // Flat list — grouped by MoSCoW in the UI
}

// GET — return saved data request (supports ?processId=xxx)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const processId = searchParams.get("processId");

  if (processId) {
    const proc = await prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id }, select: { dataRequest: true } });
    if (!proc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ dataRequest: proc.dataRequest ?? null });
  }

  const engagement = await prisma.engagement.findUnique({ where: { id }, select: { dataRequest: true } });
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ dataRequest: engagement.dataRequest ?? null });
}

// POST — generate and save data request (supports { processId } in body)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const processId = body.processId as string | undefined;

  const engagement = await prisma.engagement.findUnique({ where: { id } });
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If processId given, read processMap from EngagementProcess
  let rawProcessMap = engagement.processMap;
  if (processId) {
    const proc = await prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id } });
    if (!proc) return NextResponse.json({ error: "Process not found" }, { status: 404 });
    rawProcessMap = proc.processMap;
  }

  const processMap = rawProcessMap as {
    nodes?: Array<{
      type: string;
      data?: {
        label?: string;
        actors?: Array<{ name: string }>;
        systems?: Array<{ name: string; color: string }>;
        order?: number;
      };
    }>;
  } | null;

  if (!processMap?.nodes?.length) {
    return NextResponse.json({ error: "No process map found. Save a process model first." }, { status: 400 });
  }

  const taskNodes = processMap.nodes.filter((n) => n.type === "task");
  const systemMap = new Map<string, { color: string; steps: string[] }>();

  for (const node of taskNodes) {
    const label = node.data?.label ?? "Unknown Step";
    for (const sys of node.data?.systems ?? []) {
      if (!systemMap.has(sys.name)) {
        systemMap.set(sys.name, { color: sys.color, steps: [] });
      }
      systemMap.get(sys.name)!.steps.push(label);
    }
  }

  if (systemMap.size === 0) {
    return NextResponse.json({ error: "No systems assigned in the process map. Assign systems to tasks first." }, { status: 400 });
  }

  const systemSummary = Array.from(systemMap.entries())
    .map(([name, { color, steps }]) => `  - ${name} (color: ${color}): used in steps → ${steps.join(", ")}`)
    .join("\n");

  const stepList = taskNodes
    .sort((a, b) => (a.data?.order ?? 0) - (b.data?.order ?? 0))
    .map((n) => {
      const actors = (n.data?.actors ?? []).map((a) => a.name).join(", ") || "unassigned";
      const systems = (n.data?.systems ?? []).map((s) => s.name).join(", ") || "none";
      return `  ${n.data?.order ?? "?"}. ${n.data?.label ?? "Step"} | actors: ${actors} | systems: ${systems}`;
    })
    .join("\n");

  const prompt = `You are a senior banking process mining consultant preparing a prioritised data collection request after a process mapping workshop.

Process: ${engagement.name}
Client: ${engagement.clientName}
Template: ${engagement.processTemplate}

PROCESS STEPS:
${stepList}

SYSTEMS IN THE PROCESS MODEL (with their hex colors):
${systemSummary}

TASK: Generate a flat list of data file requests, MoSCoW-prioritised, so the client knows exactly what to provide and why.

MoSCoW RULES:
- must_have: Without this data the digital twin CANNOT be built — core event/transaction logs with timestamps and case IDs
- should_have: Significantly enriches the twin — enables bottleneck detection, exception rates, actor workload analysis
- could_have: Adds depth — enables advanced analytics (sentiment, risk scoring, channel attribution) but not blocking

ACTOR / USER ATTRIBUTION (important):
- An "actor" / "performed_by" / "user_id" / "agent_id" / "officer" column is OPTIONAL on every file.
- Its presence enriches the digital twin (enables actor-level workload, FTE, and rework attribution) — so files that mention actor data are at MOST should_have on that basis alone.
- Never push a file to must_have because of an actor column. Many bank systems do not capture user-level attribution, or strip / anonymise it before export for GDPR and internal data-privacy reasons. The twin must work without it.
- If you list a dedicated actor / IAM / HR feed file, classify it should_have or could_have — never must_have.

For each file request include a "digitalTwinValue" — one clear sentence on what capability providing this data unlocks (e.g. "Enables end-to-end cycle time measurement from application submission to first decision").

CRITICAL — SYSTEM NAMING (read carefully):
- The "systemName" field for EACH item MUST be one of the EXACT strings from the SYSTEMS list above — character for character.
- Do NOT paraphrase, do NOT add suffixes ("- Decision Engine Module"), do NOT swap the order of words ("LOS (Loan Origination System)" vs "Loan Origination System (LOS)"), do NOT add "or X" alternates.
- If multiple files come from the same system, repeat the EXACT SAME systemName string. The activity-table builder groups events by this string — variations create false duplicates.
- The same applies to systemColor: copy the exact hex.

CRITICAL — REQUIRED FIELDS (every must_have item MUST have these 3 fields):
- A case identifier (named e.g. "application_id", "case_id", "customer_id", "claim_id") — without this, events cannot be correlated.
- A timestamp (named with "timestamp", "_at", or "_date" suffix, ISO format) — without this, events cannot be ordered.
- An activity / status / outcome column (or, if the file is single-purpose, the activity is implicit from the file itself).

Generate 2 items per system maximum. Keep field lists to 5-7 fields. Use realistic banking system field names.

Return ONLY valid JSON — no markdown, no explanation:
{
  "generatedAt": "${new Date().toISOString()}",
  "processName": "${engagement.name}",
  "clientName": "${engagement.clientName}",
  "coveringNote": "2-3 sentence professional note to the client IT/operations team explaining the purpose of this request and how the data will be used",
  "items": [
    {
      "fileName": "suggested_filename.csv",
      "systemName": "exact system name from the list above",
      "systemColor": "exact hex color from the list above",
      "description": "one line — what this extract contains",
      "fields": ["field1", "field2", "field3", "field4", "field5"],
      "format": "CSV export" or "Excel export" or "API JSON export",
      "timeRange": "e.g. Last 24 months",
      "linkedSteps": ["Step Name"],
      "moscow": "must_have" or "should_have" or "could_have",
      "digitalTwinValue": "one sentence — what capability does providing this unlock"
    }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();

    let jsonStr = raw.startsWith("```") ? raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```\s*$/, "").trim() : raw;
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const dataRequest = JSON.parse(jsonStr) as DataRequest;

    if (processId) {
      await prisma.engagementProcess.update({
        where: { id: processId },
        data: { dataRequest: JSON.parse(JSON.stringify(dataRequest)) },
      });
    } else {
      await prisma.engagement.update({
        where: { id },
        data: { dataRequest: JSON.parse(JSON.stringify(dataRequest)) },
      });
    }

    return NextResponse.json({ dataRequest });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Data request generation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
