/**
 * Audit current state of retail_onboarding and home_mortgage templates.
 * Run: set -a && source .env.local && set +a && npx tsx scripts/audit-templates.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/lib/db";

const KEYS = ["retail_onboarding", "home_mortgage", "commercial_onboarding", "sme_loan_origination"];

async function main() {
  for (const k of KEYS) {
    const t = await prisma.processTemplate.findFirst({ where: { processKey: k }, orderBy: { version: "desc" } });
    if (!t) { console.log(`\n[${k}] NOT FOUND`); continue; }
    const subProcesses = (t.subProcesses ?? []) as unknown as Array<unknown>;
    const metrics = (t.metricDefinitions ?? []) as unknown as Array<unknown>;
    const steps = await prisma.processStepTemplate.count({ where: { processTemplate: k } });
    const dp = await prisma.deviationPattern.count({ where: { processKey: k } });

    // Actors + systems are global per current data model. We approximate "actors for this template"
    // by looking at ApplicationSystem rows that include this template key.
    const apps = await prisma.applicationSystem.findMany({ where: { processTemplates: { hasSome: [k, "*"] } } });
    const allActors = await prisma.processActor.count();

    console.log(`\n[${k}]  ${t.name}  v${t.version}  ${t.isActive ? "(active)" : "(draft)"}`);
    console.log(`  LOB: ${t.lineOfBusiness}`);
    console.log(`  description: ${t.description.slice(0, 80)}${t.description.length > 80 ? "…" : ""}`);
    console.log(`  subProcesses (in template): ${subProcesses.length}`);
    console.log(`  metricDefinitions:          ${metrics.length}`);
    console.log(`  ProcessStepTemplate rows:   ${steps}`);
    console.log(`  DeviationPattern rows:      ${dp}`);
    console.log(`  ApplicationSystem rows tagged with this key (or *):  ${apps.length}`);
    console.log(`  ProcessActor rows in DB (global):                    ${allActors}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
