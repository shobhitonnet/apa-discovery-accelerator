/**
 * Remove legacy ProcessStepTemplate rows for processes that aren't actively
 * supported. Keeps only "onboarding" and "generic" (the latter is a fallback
 * used by the canvas).
 *
 * Run: source .env.local && npx tsx scripts/cleanup-legacy-steps.ts
 */
import { prisma } from "@/lib/db";

const KEEP = ["onboarding", "generic", "retail_onboarding"];

async function main() {
  const all = await prisma.processStepTemplate.findMany({ select: { id: true, processTemplate: true } });
  const toDelete = all.filter((s) => !KEEP.includes(s.processTemplate));
  console.log(`Found ${all.length} step templates. ${toDelete.length} will be deleted.`);
  if (toDelete.length === 0) {
    console.log("Nothing to clean up.");
    await prisma.$disconnect();
    return;
  }

  const counts: Record<string, number> = {};
  for (const s of toDelete) counts[s.processTemplate] = (counts[s.processTemplate] ?? 0) + 1;
  for (const [k, n] of Object.entries(counts)) console.log(`  - ${k}: ${n} rows`);

  await prisma.processStepTemplate.deleteMany({
    where: { id: { in: toDelete.map((s) => s.id) } },
  });
  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
