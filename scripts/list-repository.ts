import { prisma } from "@/lib/db";

async function main() {
  const tpl = await prisma.processTemplate.findMany({
    select: { processKey: true, version: true, isActive: true, name: true, lineOfBusiness: true },
    orderBy: { processKey: "asc" },
  });
  console.log("PROCESS TEMPLATES:");
  for (const t of tpl) console.log(`  - ${t.processKey} v${t.version} ${t.isActive ? "(active)" : "(draft)"} | ${t.lineOfBusiness} | ${t.name}`);

  const ca = await prisma.countryProcessActivation.findMany({
    select: { country: true, processKey: true, isActive: true },
  });
  console.log("\nCOUNTRY ACTIVATIONS:");
  if (ca.length === 0) console.log("  (none)");
  for (const c of ca) console.log(`  - ${c.country} / ${c.processKey} ${c.isActive ? "(active)" : "(draft)"}`);

  const cnt = await prisma.valueCoefficient.groupBy({
    by: ["country"], _count: { _all: true },
  });
  console.log("\nCOEFFICIENTS BY COUNTRY:");
  if (cnt.length === 0) console.log("  (none)");
  for (const c of cnt) console.log(`  - ${c.country}: ${c._count._all}`);

  const dp = await prisma.deviationPattern.count();
  console.log(`\nDEVIATION PATTERNS: ${dp}`);

  await prisma.$disconnect();
}
main();
