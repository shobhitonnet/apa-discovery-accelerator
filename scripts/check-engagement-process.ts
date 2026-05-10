import { prisma } from "@/lib/db";
async function main() {
  const procs = await prisma.engagementProcess.findMany({
    select: { id: true, processName: true, processKey: true, engagement: { select: { name: true } } },
  });
  for (const p of procs) {
    console.log(`${p.engagement.name} > ${p.processName} | processKey: "${p.processKey}"`);
  }
  console.log("---");
  const allTemplates = await prisma.processTemplate.findMany({ select: { processKey: true, isActive: true, version: true, name: true } });
  console.log("Active templates:");
  for (const t of allTemplates) {
    console.log(`  processKey: "${t.processKey}" | active: ${t.isActive} | v${t.version} | "${t.name}"`);
  }
  await prisma.$disconnect();
}
main();
