import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET — actor + system + duration breakdown for a single transition (from → to).
 *
 * Walks the event log for this process, groups events by case, and for every
 * case where `from` is immediately followed by `to`, records the durations and
 * the actors / systems on both sides. Returns aggregates suitable for a
 * Process Explorer callout panel.
 */
export type EdgeDetailResponse = {
  from: string;
  to: string;
  caseCount: number;
  totalCases: number;
  durationMs: { avg: number | null; min: number | null; max: number | null; median: number | null };
  source: { system: string; actors: Array<{ name: string; count: number }> };
  target: { system: string; actors: Array<{ name: string; count: number }> };
  exampleCaseIds: string[];
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { processId } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const events = await prisma.eventLog.findMany({
    where: { processId },
    select: { caseId: true, activity: true, system: true, actor: true, timestamp: true },
    orderBy: [{ caseId: "asc" }, { timestamp: "asc" }],
  });

  if (events.length === 0) {
    return NextResponse.json<EdgeDetailResponse>({
      from, to, caseCount: 0, totalCases: 0,
      durationMs: { avg: null, min: null, max: null, median: null },
      source: { system: "—", actors: [] },
      target: { system: "—", actors: [] },
      exampleCaseIds: [],
    });
  }

  // Special-case START → x and x → END so the panel still works on terminal edges.
  const SOURCE_IS_START = from === "__START__";
  const TARGET_IS_END = to === "__END__";

  // Group events per case
  const byCase = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byCase.get(e.caseId) ?? [];
    arr.push(e);
    byCase.set(e.caseId, arr);
  }

  const durations: number[] = [];
  const matchedCaseIds: string[] = [];
  const sourceActors = new Map<string, number>();
  const targetActors = new Map<string, number>();
  const sourceSystems = new Map<string, number>();
  const targetSystems = new Map<string, number>();

  for (const [caseId, seq] of byCase) {
    if (SOURCE_IS_START) {
      // Edge START → to fires when the first event of the case has activity == to
      const first = seq[0];
      if (first && first.activity === to) {
        matchedCaseIds.push(caseId);
        targetActors.set(first.actor ?? "(unknown)", (targetActors.get(first.actor ?? "(unknown)") ?? 0) + 1);
        targetSystems.set(first.system ?? "—", (targetSystems.get(first.system ?? "—") ?? 0) + 1);
      }
      continue;
    }
    if (TARGET_IS_END) {
      const last = seq[seq.length - 1];
      if (last && last.activity === from) {
        matchedCaseIds.push(caseId);
        sourceActors.set(last.actor ?? "(unknown)", (sourceActors.get(last.actor ?? "(unknown)") ?? 0) + 1);
        sourceSystems.set(last.system ?? "—", (sourceSystems.get(last.system ?? "—") ?? 0) + 1);
      }
      continue;
    }
    // Normal directly-follows transition
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      if (a.activity === from && b.activity === to) {
        matchedCaseIds.push(caseId);
        durations.push(b.timestamp.getTime() - a.timestamp.getTime());
        sourceActors.set(a.actor ?? "(unknown)", (sourceActors.get(a.actor ?? "(unknown)") ?? 0) + 1);
        targetActors.set(b.actor ?? "(unknown)", (targetActors.get(b.actor ?? "(unknown)") ?? 0) + 1);
        sourceSystems.set(a.system ?? "—", (sourceSystems.get(a.system ?? "—") ?? 0) + 1);
        targetSystems.set(b.system ?? "—", (targetSystems.get(b.system ?? "—") ?? 0) + 1);
        break; // count each case once per edge
      }
    }
  }

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

  const dominantSystem = (m: Map<string, number>) => {
    const arr = sortDesc(m);
    return arr[0]?.name ?? "—";
  };

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const median = sortedDurations.length === 0
    ? null
    : sortedDurations.length % 2 === 1
      ? sortedDurations[(sortedDurations.length - 1) / 2]
      : Math.round((sortedDurations[sortedDurations.length / 2 - 1] + sortedDurations[sortedDurations.length / 2]) / 2);

  const result: EdgeDetailResponse = {
    from,
    to,
    caseCount: matchedCaseIds.length,
    totalCases: byCase.size,
    durationMs: {
      avg: durations.length === 0 ? null : Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
      min: sortedDurations[0] ?? null,
      max: sortedDurations[sortedDurations.length - 1] ?? null,
      median,
    },
    source: { system: dominantSystem(sourceSystems), actors: sortDesc(sourceActors).slice(0, 6) },
    target: { system: dominantSystem(targetSystems), actors: sortDesc(targetActors).slice(0, 6) },
    exampleCaseIds: matchedCaseIds.slice(0, 5),
  };

  return NextResponse.json(result);
}
