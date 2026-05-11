/** Quick dump of commercial_onboarding + sme_loan_origination template state. */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/lib/db";

const KEYS = ["commercial_onboarding", "sme_loan_origination"];

async function main() {
  for (const key of KEYS) {
    const template = await prisma.processTemplate.findFirst({ where: { processKey: key }, orderBy: { version: "desc" } });
    if (!template) { console.log(`[${key}] NOT FOUND`); continue; }
    const steps = await prisma.processStepTemplate.findMany({ where: { processTemplate: key }, orderBy: { order: "asc" } });
    const systems = await prisma.applicationSystem.findMany({ where: { processTemplates: { has: key } }, orderBy: { name: "asc" } });
    const subProcs = (template.subProcesses ?? []) as Array<{ key: string; label: string; description?: string }>;
    const metrics = (template.metricDefinitions ?? []) as Array<{ key: string; label: string; category?: string; source?: string; unit?: string; required?: boolean }>;

    console.log(`\n==========  ${key}  (${template.name} v${template.version}, active=${template.isActive})  ==========`);
    console.log(`\nSTEPS (${steps.length}):`);
    for (const s of steps) console.log(`  ${String(s.order).padStart(2)} | ${s.label}`);
    console.log(`\nSUB-PROCESSES (${subProcs.length}):`);
    for (const sp of subProcs) console.log(`  ${sp.key.padEnd(40)} ${sp.label}`);
    console.log(`\nSYSTEMS (${systems.length}):`);
    for (const sy of systems) console.log(`  ${sy.name}`);
    console.log(`\nMETRICS (${metrics.length}):`);
    for (const m of metrics) console.log(`  [${(m.source ?? "?").padEnd(8)} ${(m.category ?? "?").padEnd(8)} ${m.required ? "REQ" : "   "}] ${m.key.padEnd(40)} ${m.label}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
