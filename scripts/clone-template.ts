/**
 * Clone an existing template under a new processKey.
 * Run: source .env.local && npx tsx scripts/clone-template.ts <sourceKey> <newKey>
 */
import { prisma } from "@/lib/db";

async function main() {
  const [, , source = "retail_onboarding", dest = "retail_account_opening"] = process.argv;

  const src = await prisma.processTemplate.findFirst({
    where: { processKey: source }, orderBy: { version: "desc" },
  });
  if (!src) { console.error(`No template for ${source}`); process.exit(1); }

  const existing = await prisma.processTemplate.findFirst({ where: { processKey: dest } });
  if (existing) {
    await prisma.processTemplate.update({
      where: { id: existing.id },
      data: {
        name: src.name,
        description: src.description,
        lineOfBusiness: src.lineOfBusiness,
        applicableInstTypes: src.applicableInstTypes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultProcessMap: src.defaultProcessMap as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subProcesses: src.subProcesses as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metricDefinitions: src.metricDefinitions as any,
        notes: `Cloned from ${source} v${src.version}`,
        isActive: true,
      },
    });
    console.log(`Updated existing template ${dest} from ${source}`);
  } else {
    await prisma.processTemplate.create({
      data: {
        processKey: dest, version: 1, isActive: true,
        name: src.name, description: src.description,
        lineOfBusiness: src.lineOfBusiness,
        applicableInstTypes: src.applicableInstTypes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultProcessMap: src.defaultProcessMap as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subProcesses: src.subProcesses as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metricDefinitions: src.metricDefinitions as any,
        notes: `Cloned from ${source} v${src.version}`,
      },
    });
    console.log(`Created template ${dest} from ${source}`);
  }

  // Also clone deviation patterns
  const patterns = await prisma.deviationPattern.findMany({ where: { processKey: source } });
  for (const p of patterns) {
    const newKey = p.patternKey.replace(source, dest);
    await prisma.deviationPattern.upsert({
      where: { patternKey: newKey },
      create: {
        patternKey: newKey, type: p.type, stepKeyword: p.stepKeyword,
        processKey: dest, country: p.country,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasons: p.reasons as any,
      },
      update: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasons: p.reasons as any,
      },
    });
  }
  console.log(`Cloned ${patterns.length} deviation patterns`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
