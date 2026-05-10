import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET — actor + system + duration breakdown for a single activity (node).
 *
 * Walks the event log for this process and aggregates everything that happens
 * AT this activity: who performs it, on which systems, how long cases spend on
 * it, where they come from before, and where they go to after. Returns
 * aggregates suitable for an activity callout panel.
 */
export type ActivityDetailResponse = {
  name: string;
  caseCount: number;       // distinct cases that touch this activity
  eventCount: number;      // total events with this activity (loops > 1 per case)
  totalCases: number;      // total cases in the process — for % math
  // Time spent AT this activity = from this event to the next event in the same case.
  // null for the very last event of a case (no successor).
  durationMs: { avg: number | null; min: number | null; max: number | null; median: number | null };
  // First event of cases: how long since the first event of the case did this activity occur on average.
  // Useful for "where in the process does this typically happen".
  positionInCase: { avgEventIndex: number | null; avgPctThroughCase: number | null };
  systems: Array<{ name: string; count: number }>;
  actors: Array<{ name: string; count: number }>;
  inbound:  Array<{ from: string; count: number }>;
  outbound: Array<{ to: string; count: number }>;
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
  const name = url.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const events = await prisma.eventLog.findMany({
    where: { processId },
    select: { caseId: true, activity: true, system: true, actor: true, timestamp: true },
    orderBy: [{ caseId: "asc" }, { timestamp: "asc" }],
  });

  if (events.length === 0) {
    return NextResponse.json<ActivityDetailResponse>({
      name, caseCount: 0, eventCount: 0, totalCases: 0,
      durationMs: { avg: null, min: null, max: null, median: null },
      positionInCase: { avgEventIndex: null, avgPctThroughCase: null },
      systems: [], actors: [], inbound: [], outbound: [], exampleCaseIds: [],
    });
  }

  const byCase = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byCase.get(e.caseId) ?? [];
    arr.push(e);
    byCase.set(e.caseId, arr);
  }

  const matchedCaseIds = new Set<string>();
  let eventCount = 0;
  const durations: number[] = [];
  const eventIndexes: number[] = [];
  const pctThroughCase: number[] = [];
  const systems = new Map<string, number>();
  const actors = new Map<string, number>();
  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();

  for (const [caseId, seq] of byCase) {
    for (let i = 0; i < seq.length; i++) {
      const e = seq[i];
      if (e.activity !== name) continue;

      matchedCaseIds.add(caseId);
      eventCount++;
      systems.set(e.system ?? "—", (systems.get(e.system ?? "—") ?? 0) + 1);
      actors.set(e.actor ?? "(unknown)", (actors.get(e.actor ?? "(unknown)") ?? 0) + 1);
      eventIndexes.push(i);
      pctThroughCase.push(seq.length > 1 ? i / (seq.length - 1) : 0);

      // Time spent at activity = next event timestamp - this event timestamp
      if (i < seq.length - 1) {
        durations.push(seq[i + 1].timestamp.getTime() - e.timestamp.getTime());
      }

      // Inbound = previous activity in the same case
      if (i > 0) {
        const prev = seq[i - 1].activity;
        inbound.set(prev, (inbound.get(prev) ?? 0) + 1);
      } else {
        inbound.set("(case start)", (inbound.get("(case start)") ?? 0) + 1);
      }

      // Outbound = next activity in the same case
      if (i < seq.length - 1) {
        const next = seq[i + 1].activity;
        outbound.set(next, (outbound.get(next) ?? 0) + 1);
      } else {
        outbound.set("(case end)", (outbound.get("(case end)") ?? 0) + 1);
      }
    }
  }

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ name: n, count: c }));

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const median = sortedDurations.length === 0
    ? null
    : sortedDurations.length % 2 === 1
      ? sortedDurations[(sortedDurations.length - 1) / 2]
      : Math.round((sortedDurations[sortedDurations.length / 2 - 1] + sortedDurations[sortedDurations.length / 2]) / 2);

  const avg = (xs: number[]) => xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;

  const result: ActivityDetailResponse = {
    name,
    caseCount: matchedCaseIds.size,
    eventCount,
    totalCases: byCase.size,
    durationMs: {
      avg: durations.length === 0 ? null : Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
      min: sortedDurations[0] ?? null,
      max: sortedDurations[sortedDurations.length - 1] ?? null,
      median,
    },
    positionInCase: {
      avgEventIndex: avg(eventIndexes),
      avgPctThroughCase: avg(pctThroughCase),
    },
    systems: sortDesc(systems).slice(0, 6),
    actors: sortDesc(actors).slice(0, 6),
    inbound: sortDesc(inbound).slice(0, 5).map((x) => ({ from: x.name, count: x.count })),
    outbound: sortDesc(outbound).slice(0, 5).map((x) => ({ to: x.name, count: x.count })),
    exampleCaseIds: [...matchedCaseIds].slice(0, 5),
  };

  return NextResponse.json(result);
}
