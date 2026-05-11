/** Verification — confirm the Fifth Third engagement is complete. */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/lib/db";

async function main() {
  const engagement = await prisma.engagement.findFirst({
    where: { clientName: "Fifth Third Bank" },
    include: {
      processes: { orderBy: { order: "asc" } },
      _count: { select: { uploads: true, eventLogs: true } },
    },
  });

  if (!engagement) { console.log("✗ Fifth Third engagement not found"); process.exit(1); }

  console.log(`\n══ ${engagement.name} ══`);
  console.log(`  id:        ${engagement.id}`);
  console.log(`  client:    ${engagement.clientName}`);
  console.log(`  status:    ${engagement.status}`);
  console.log(`  country:   ${engagement.country} (${engagement.region})`);
  console.log(`  AUM:       ${engagement.aum}`);
  console.log(`  employees: ${engagement.employees}`);
  console.log(`  customers: ${engagement.customers}`);
  console.log(`  core:      ${engagement.coreBankingSystem}`);
  console.log(`  uploads:   ${engagement._count.uploads}`);
  console.log(`  events:    ${engagement._count.eventLogs.toLocaleString()}`);

  for (const p of engagement.processes) {
    const eventCount = await prisma.eventLog.count({ where: { processId: p.id } });
    const caseCount = (await prisma.eventLog.findMany({ where: { processId: p.id }, select: { caseId: true }, distinct: ["caseId"] })).length;
    const uploadCount = await prisma.upload.count({ where: { processId: p.id } });
    const activityCount = (await prisma.eventLog.findMany({ where: { processId: p.id }, select: { activity: true }, distinct: ["activity"] })).length;

    const pm = p.processMap as { nodes?: unknown[]; edges?: unknown[]; summary?: { taskCount: number; actors: string[]; systems: string[] } } | null;
    const dr = p.dataRequest as { items?: unknown[] } | null;
    const cap = p.processCapabilities as Record<string, string> | null;
    const met = p.processMetrics as Record<string, string> | null;

    console.log(`\n  ── ${p.processName} (${p.processKey}) ──`);
    console.log(`     id:                ${p.id}`);
    console.log(`     status:            ${p.status}`);
    console.log(`     templateVersion:   ${p.templateVersion}`);
    console.log(`     processMap:        ${pm?.nodes?.length ?? 0} nodes, ${pm?.edges?.length ?? 0} edges, ${pm?.summary?.taskCount ?? 0} tasks`);
    console.log(`     processMap actors: ${pm?.summary?.actors?.length ?? 0} (${(pm?.summary?.actors ?? []).slice(0,3).join(", ")}…)`);
    console.log(`     processMap systems:${pm?.summary?.systems?.length ?? 0} (${(pm?.summary?.systems ?? []).slice(0,3).join(", ")}…)`);
    console.log(`     dataRequest:       ${dr?.items?.length ?? 0} slots`);
    console.log(`     capabilities:      ${cap ? Object.keys(cap).length : 0} keys`);
    console.log(`     metrics:           ${met ? Object.keys(met).length : 0} keys`);
    console.log(`     uploads:           ${uploadCount}`);
    console.log(`     EventLog cases:    ${caseCount.toLocaleString()}`);
    console.log(`     EventLog events:   ${eventCount.toLocaleString()}`);
    console.log(`     distinct activities: ${activityCount}`);
    console.log(`     findings cached:   ${p.findings ? "yes" : "no"}`);
  }

  console.log(`\n══ UI path: /engagements/${engagement.id} ══\n`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
