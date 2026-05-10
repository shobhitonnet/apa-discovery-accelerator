import { prisma } from "@/lib/db";
async function main() {
  const t = await prisma.processTemplate.findFirst({
    where: { processKey: "retail_onboarding" },
    orderBy: { version: "desc" },
  });
  if (!t) { console.log("No template found"); process.exit(0); }
  console.log("name:", t.name);
  console.log("version:", t.version);
  console.log("isActive:", t.isActive);
  const md = (t.metricDefinitions ?? []) as unknown[];
  console.log("metricDefinitions count:", Array.isArray(md) ? md.length : "(not array)");
  if (Array.isArray(md) && md.length > 0) {
    console.log("First 3 keys:", md.slice(0, 3).map((m: any) => `${m.key} (${m.category}/${m.source})`));
  }
  await prisma.$disconnect();
}
main();
