/**
 * v1.2.1 — Add US vendor names to retail_onboarding systems.
 *
 * Renames the 8 generic-named systems currently tagged to retail_onboarding
 * into a "Function — Vendor" format, and adds 3 new categories that the
 * generic list was missing (Credit Bureau, IDV, Fraud Database).
 *
 * Idempotent — if a system already has the hybrid name it's left alone.
 *
 * No Backbase products in this list. Incumbent vendor stack only — Backbase
 * is the future-state pitch, so the current-state demo should show what the
 * bank typically already runs.
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-retail-vendors.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/lib/db";

const KEY = "retail_onboarding";

// 8 renames: old generic name → new hybrid name + description.
const renames: Array<{ from: string; to: string; description: string; color: string }> = [
  { from: "CRM System",                   to: "CRM — Salesforce Financial Services Cloud", description: "Customer 360 + application capture for retail onboarding",                   color: "#3366FF" },
  { from: "Card Management System",       to: "Card Management — Marqeta / TSYS",          description: "Debit card production, issuance, lifecycle management",                       color: "#FFAC09" },
  { from: "Core Banking System",          to: "Core Banking — FIS Premier / Fiserv DNA",   description: "Account provisioning, ledger, customer master",                               color: "#F97316" },
  { from: "Credit Decisioning Engine",    to: "Credit Decisioning — FICO / Provenir",      description: "Rule + ML-based credit decision orchestration",                               color: "#06B6D4" },
  { from: "Customer Onboarding Platform", to: "Onboarding Workflow — Alloy / Sift",        description: "End-to-end onboarding workflow + identity decision orchestration",            color: "#26BC71" },
  { from: "Digital Banking Platform",     to: "Digital Banking — Q2 / Alkami / NCR",       description: "Customer-facing mobile + web banking platform (incumbent)",                   color: "#8B2BE2" },
  { from: "Document Management System",   to: "Document Management — Hyland OnBase",       description: "Enterprise content / document storage and retrieval",                         color: "#64748B" },
  { from: "KYC/AML System",               to: "KYC/AML Screening — LexisNexis Bridger / NICE Actimize", description: "Sanctions, PEP, adverse media screening + AML transaction monitoring", color: "#EF4444" },
];

// 3 new categories — not in the current seated set.
const additions: Array<{ name: string; description: string; color: string }> = [
  { name: "Credit Bureau — Experian / Equifax / TransUnion",      description: "Tri-merge credit pull for retail account / overdraft decisioning",        color: "#FFAC09" },
  { name: "Identity Verification — Onfido / Jumio / Socure",       description: "Document capture + biometric liveness + identity match",                  color: "#06B6D4" },
  { name: "Fraud Database — Early Warning Services / ThreatMetrix", description: "Mule account / synthetic identity / device fingerprint fraud screening", color: "#EF4444" },
];

async function applyRenames() {
  console.log("\n[1/2] Renaming generic systems → hybrid Function — Vendor names");
  let renamed = 0; let skipped = 0;

  for (const r of renames) {
    // Already done?
    const alreadyHybrid = await prisma.applicationSystem.findFirst({ where: { name: r.to } });
    if (alreadyHybrid) {
      console.log(`     ↺ already exists: ${r.to}`);
      skipped++;
      continue;
    }

    // Find the retail-tagged row with the generic name.
    const oldRow = await prisma.applicationSystem.findFirst({
      where: { name: r.from, processTemplates: { has: KEY } },
    });
    if (!oldRow) {
      console.log(`     ? no retail-tagged row found for: ${r.from}`);
      skipped++;
      continue;
    }

    await prisma.applicationSystem.update({
      where: { id: oldRow.id },
      data: { name: r.to, description: r.description, color: r.color },
    });
    console.log(`     ✎ ${r.from}\n       → ${r.to}`);
    renamed++;
  }
  console.log(`     → ${renamed} renamed, ${skipped} already-done / not-found`);
}

async function addNewVendors() {
  console.log("\n[2/2] Adding 3 new vendor categories for retail_onboarding");
  let added = 0; let skipped = 0;

  for (const a of additions) {
    const existing = await prisma.applicationSystem.findFirst({ where: { name: a.name } });
    if (existing) {
      // Ensure it's tagged to retail_onboarding even if already exists.
      if (!existing.processTemplates.includes(KEY)) {
        await prisma.applicationSystem.update({
          where: { id: existing.id },
          data: { processTemplates: [...existing.processTemplates, KEY] },
        });
        console.log(`     + retagged existing row to retail_onboarding: ${a.name}`);
        added++;
      } else {
        console.log(`     ↺ already exists and tagged: ${a.name}`);
        skipped++;
      }
      continue;
    }
    await prisma.applicationSystem.create({
      data: { name: a.name, color: a.color, description: a.description, processTemplates: [KEY] },
    });
    console.log(`     + added: ${a.name}`);
    added++;
  }
  console.log(`     → ${added} added, ${skipped} already present`);
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("  Seed US vendor names — retail_onboarding");
  console.log("══════════════════════════════════════════════════════════════════");

  await applyRenames();
  await addNewVendors();

  const seated = await prisma.applicationSystem.findMany({
    where: { processTemplates: { has: KEY } },
    orderBy: { name: "asc" },
  });

  console.log(`\nFinal seated count for retail_onboarding: ${seated.length}`);
  for (const s of seated) console.log(`     ✓ ${s.name}`);

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  Done.");
  console.log("══════════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
