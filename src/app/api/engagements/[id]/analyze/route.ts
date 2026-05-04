import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { anthropic } from "@/lib/anthropic";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function msToHours(ms: number) {
  return Math.round((ms / 3600000) * 10) / 10;
}

function msToDays(ms: number) {
  return Math.round((ms / 86400000) * 10) / 10;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: engagementId } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
  });
  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  const events = await prisma.eventLog.findMany({
    where: { engagementId },
    orderBy: { timestamp: "asc" },
  });

  if (events.length === 0) {
    return NextResponse.json(
      { error: "No events found. Run correlation first." },
      { status: 400 }
    );
  }

  // Clear previous analysis results
  await prisma.analysisResult.deleteMany({ where: { engagementId } });

  // Group events by case
  const caseMap = new Map<string, typeof events>();
  for (const event of events) {
    if (!caseMap.has(event.caseId)) caseMap.set(event.caseId, []);
    caseMap.get(event.caseId)!.push(event);
  }

  // --- Cycle Time Analysis ---
  const cycleTimes: number[] = [];
  for (const [, caseEvents] of caseMap) {
    const sorted = caseEvents.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const duration =
      sorted[sorted.length - 1].timestamp.getTime() -
      sorted[0].timestamp.getTime();
    cycleTimes.push(duration);
  }
  const avgCycleMs = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;

  // --- Step Duration Analysis ---
  const stepDurations = new Map<string, number[]>();
  for (const [, caseEvents] of caseMap) {
    const sorted = caseEvents.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const step = sorted[i - 1].activity;
      const duration =
        sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();
      if (!stepDurations.has(step)) stepDurations.set(step, []);
      stepDurations.get(step)!.push(duration);
    }
  }

  const stepMetrics = Array.from(stepDurations.entries())
    .map(([step, durations]) => ({
      step,
      medianMs: median(durations),
      medianHours: msToHours(median(durations)),
      medianDays: msToDays(median(durations)),
      samples: durations.length,
    }))
    .sort((a, b) => b.medianMs - a.medianMs);

  // --- Dark Process Zone Detection ---
  // A dark zone is a gap > 4 hours between events from different systems
  const darkZones: Array<{
    fromActivity: string;
    toActivity: string;
    fromSystem: string;
    toSystem: string;
    gapHours: number;
    occurrences: number;
  }> = [];

  const darkZoneMap = new Map<string, { gapHours: number[]; fromSystem: string; toSystem: string }>();

  for (const [, caseEvents] of caseMap) {
    const sorted = caseEvents.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gapMs = curr.timestamp.getTime() - prev.timestamp.getTime();
      const gapHours = msToHours(gapMs);
      if (gapHours > 4 && prev.system !== curr.system) {
        const key = `${prev.activity} → ${curr.activity}`;
        if (!darkZoneMap.has(key)) {
          darkZoneMap.set(key, {
            gapHours: [],
            fromSystem: prev.system,
            toSystem: curr.system,
          });
        }
        darkZoneMap.get(key)!.gapHours.push(gapHours);
      }
    }
  }

  for (const [key, val] of darkZoneMap) {
    const [fromActivity, toActivity] = key.split(" → ");
    darkZones.push({
      fromActivity,
      toActivity,
      fromSystem: val.fromSystem,
      toSystem: val.toSystem,
      gapHours: Math.round(median(val.gapHours) * 10) / 10,
      occurrences: val.gapHours.length,
    });
  }
  darkZones.sort((a, b) => b.gapHours - a.gapHours);

  // --- Rework Detection ---
  const reworkSteps: Array<{ step: string; cases: string[]; occurrences: number }> = [];
  const reworkMap = new Map<string, string[]>();

  for (const [caseId, caseEvents] of caseMap) {
    const stepCounts = new Map<string, number>();
    for (const e of caseEvents) {
      stepCounts.set(e.activity, (stepCounts.get(e.activity) ?? 0) + 1);
    }
    for (const [step, count] of stepCounts) {
      if (count > 1) {
        if (!reworkMap.has(step)) reworkMap.set(step, []);
        reworkMap.get(step)!.push(caseId);
      }
    }
  }

  for (const [step, cases] of reworkMap) {
    reworkSteps.push({ step, cases, occurrences: cases.length });
  }

  // --- Build metrics summary for Claude APA prompt ---
  const metricsSummary = {
    processTemplate: engagement.processTemplate,
    totalCases: caseMap.size,
    totalEvents: events.length,
    avgCycleDays: msToDays(avgCycleMs),
    topBottlenecks: stepMetrics.slice(0, 5),
    darkProcessZones: darkZones.slice(0, 5),
    reworkSteps,
  };

  // --- Call Claude for APA Opportunity generation ---
  const apaMessage = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a Backbase APA (Agentic Process Automation) specialist. Based on the following process mining results for a ${engagement.processTemplate} banking process, identify the top automation opportunities using Backbase's platform.

PROCESS MINING RESULTS:
${JSON.stringify(metricsSummary, null, 2)}

BACKBASE AUTOMATION TYPES:
- IDP Agent: Intelligent Document Processing — extracts, classifies, and validates documents automatically
- Flow 2.0: Workflow orchestration — automates multi-step handoffs, routing, and SLA management
- Decision Automation: Rules-based and AI-powered decisioning — automates credit, risk, and compliance decisions
- Straight-Through Processing (STP): End-to-end automation of steps with no human touch required

For each opportunity identify:
1. Which specific process step(s) are targeted
2. Which Backbase automation type applies
3. The estimated time saving (in hours or days per case)
4. The business impact (cost, speed, risk)
5. Implementation complexity (low / medium / high)

Respond with ONLY a valid JSON array, no markdown:
[
  {
    "title": "short opportunity title",
    "automationType": "IDP Agent | Flow 2.0 | Decision Automation | Straight-Through Processing",
    "targetSteps": ["step name 1", "step name 2"],
    "timeSavedHours": number,
    "description": "2-3 sentence explanation of what gets automated and why",
    "businessImpact": "1 sentence on cost/speed/risk impact",
    "complexity": "low | medium | high",
    "severity": "high | medium | low"
  }
]

Generate 4-6 opportunities ordered by business impact.`,
      },
    ],
  });

  const apaContent = apaMessage.content[0];
  if (apaContent.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response for APA" }, { status: 500 });
  }

  let apaJson = apaContent.text.trim();
  const apaMatch = apaJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (apaMatch) apaJson = apaMatch[1].trim();

  const apaOpportunities: Array<{
    title: string;
    automationType: string;
    targetSteps: string[];
    timeSavedHours: number;
    description: string;
    businessImpact: string;
    complexity: string;
    severity: string;
  }> = JSON.parse(apaJson);

  // --- Persist all results ---
  await prisma.analysisResult.createMany({
    data: [
      {
        type: "cycle_time",
        title: "End-to-End Cycle Time",
        description: `Average cycle time across ${caseMap.size} cases`,
        severity: avgCycleMs > 864000000 ? "high" : "medium", // > 10 days = high
        data: {
          avgCycleDays: msToDays(avgCycleMs),
          totalCases: caseMap.size,
          stepMetrics: stepMetrics.slice(0, 10),
        },
        engagementId,
      },
      ...darkZones.slice(0, 3).map((zone) => ({
        type: "dark_process",
        title: `Dark Zone: ${zone.fromActivity} → ${zone.toActivity}`,
        description: `Manual handoff between ${zone.fromSystem} and ${zone.toSystem} averaging ${zone.gapHours} hours`,
        severity: zone.gapHours > 24 ? "high" : zone.gapHours > 8 ? "medium" : "low",
        data: zone,
        engagementId,
      })),
      ...reworkSteps.map((rework) => ({
        type: "rework",
        title: `Rework Loop: ${rework.step}`,
        description: `Step repeated in ${rework.occurrences} of ${caseMap.size} cases`,
        severity: rework.occurrences / caseMap.size > 0.5 ? "high" : "medium",
        data: rework,
        engagementId,
      })),
      ...apaOpportunities.map((opp) => ({
        type: "apa_opportunity",
        title: opp.title,
        description: opp.description,
        severity: opp.severity,
        data: opp,
        engagementId,
      })),
    ],
  });

  await prisma.engagement.update({
    where: { id: engagementId },
    data: { status: "completed" },
  });

  return NextResponse.json({
    success: true,
    metrics: metricsSummary,
    apaOpportunities,
    darkZones,
    reworkSteps,
  });
}
