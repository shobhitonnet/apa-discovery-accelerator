/**
 * v1.2.1 cleanup — non-destructive fixes from the v1.2 seating audit.
 *
 *   1. Add 4 missing retail_onboarding actors to the global ProcessActor pool.
 *   2. Replace home_mortgage ProcessStepTemplate rows with the canonical 14
 *      from fix-home-mortgage.ts (current 26 rows have non-canonical labels).
 *   3. Untag "home_mortgage" from 10 generic-named ApplicationSystems so the
 *      template detail page shows only the 9 US-specific vendors. Rows are
 *      preserved (other templates may still reference them).
 *
 * Idempotent — safe to re-run. Run audit-seating.ts after to verify.
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/cleanup-v1-2-1.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/lib/db";

// ── 1. Missing retail_onboarding actors ──────────────────────────────────
const retailActorsToAdd = [
  { name: "Retail Applicant",            color: "#3366FF", description: "Customer applying for a new retail current/savings account",                  type: "customer" },
  { name: "Branch Customer Service Rep", color: "#26BC71", description: "In-branch CSR who initiates / assists with account opening",                  type: "front-office" },
  { name: "Digital Onboarding Bot",      color: "#06B6D4", description: "Automated digital channel that captures applications and IDV via mobile/web", type: "automated" },
  { name: "KYC / AML Analyst",           color: "#FFAC09", description: "Performs sanctions, PEP, adverse media checks; resolves alerts",              type: "back-office" },
];

// ── 2. Canonical home_mortgage steps (from fix-home-mortgage.ts) ─────────
const homeMortgageCanonicalSteps = [
  { label: "Submit Mortgage Application",   description: "Borrower completes 1003 application via portal / RM / branch" },
  { label: "Send Loan Estimate (TRID)",     description: "Provide initial Loan Estimate within 3 business days (TILA-RESPA)" },
  { label: "Verify Income & Employment",    description: "Pay stubs, W-2s, tax returns; employer verification" },
  { label: "Verify Assets",                 description: "Bank statements, retirement accounts, source of down payment" },
  { label: "Pull Credit Report",            description: "Tri-merge credit pull (Experian, Equifax, TransUnion); FICO score" },
  { label: "Order Property Appraisal",      description: "Independent appraisal of property value (AMC-mediated for compliance)" },
  { label: "Conduct Title Search",          description: "Title insurance company verifies clear title and existing liens" },
  { label: "Underwriting Review",           description: "DTI, LTV, reserves, credit history — auto + manual underwriting" },
  { label: "Issue Underwriting Decision",   description: "Approve / approve-with-conditions / counter / decline" },
  { label: "Clear to Close",                description: "All stipulations cleared, insurance bound, final review" },
  { label: "Send Closing Disclosure (TRID)", description: "Final Closing Disclosure 3 business days before closing" },
  { label: "Conduct Closing & Signing",     description: "Borrower signs all documents (in-person or e-close)" },
  { label: "Fund & Record",                 description: "Funds wired to escrow; deed recorded with county" },
  { label: "Set Up Loan Servicing",         description: "Loan booked in core; payment schedule, escrow, MERS registration" },
];

// ── 3. Generic systems to untag from home_mortgage ────────────────────────
const homeMortgageGenericSystemsToUntag = [
  "AML Screening System",
  "Closing Management Platform",
  "Credit Bureau Interface",
  "Document Management System",
  "Income Verification Platform",
  "Loan Origination System",
  "Loan Servicing System",
  "Property Valuation System",
  "Underwriting Engine",
  "Core Banking System",
];

async function addRetailActors() {
  console.log("\n[1/3] Adding missing retail_onboarding actors to global pool");
  let added = 0; let skipped = 0;
  for (const a of retailActorsToAdd) {
    const existing = await prisma.processActor.findFirst({ where: { name: a.name } });
    if (existing) {
      console.log(`     ↺ already exists: ${a.name}`);
      skipped++;
    } else {
      await prisma.processActor.create({ data: a });
      console.log(`     + added: ${a.name}`);
      added++;
    }
  }
  console.log(`     → ${added} added, ${skipped} already present`);
}

async function dedupeHomeMortgageSteps() {
  console.log("\n[2/3] Replacing home_mortgage steps with canonical 14");

  const before = await prisma.processStepTemplate.count({ where: { processTemplate: "home_mortgage" } });
  console.log(`     before: ${before} ProcessStepTemplate rows`);

  // Check if canonical labels are already in place — idempotent guard
  const existing = await prisma.processStepTemplate.findMany({
    where: { processTemplate: "home_mortgage" },
    orderBy: { order: "asc" },
  });
  const existingLabels = new Set(existing.map((s) => s.label));
  const canonicalLabels = new Set(homeMortgageCanonicalSteps.map((s) => s.label));
  const isCanonical = existing.length === 14 && [...canonicalLabels].every((l) => existingLabels.has(l));

  if (isCanonical) {
    console.log(`     ↺ already canonical (14 rows, all labels match) — skipping`);
    return;
  }

  const deleted = await prisma.processStepTemplate.deleteMany({ where: { processTemplate: "home_mortgage" } });
  console.log(`     × deleted ${deleted.count} legacy rows`);

  for (let i = 0; i < homeMortgageCanonicalSteps.length; i++) {
    const s = homeMortgageCanonicalSteps[i];
    await prisma.processStepTemplate.create({
      data: { label: s.label, processTemplate: "home_mortgage", order: i + 1, description: s.description },
    });
    console.log(`     + [${String(i + 1).padStart(2, " ")}] ${s.label}`);
  }

  const after = await prisma.processStepTemplate.count({ where: { processTemplate: "home_mortgage" } });
  console.log(`     after:  ${after} rows`);
}

async function untagGenericHomeMortgageSystems() {
  console.log("\n[3/3] Untagging 10 generic systems from home_mortgage");
  let untagged = 0; let skipped = 0;

  for (const name of homeMortgageGenericSystemsToUntag) {
    const sys = await prisma.applicationSystem.findFirst({ where: { name } });
    if (!sys) {
      console.log(`     ? not found in DB: ${name}`);
      skipped++;
      continue;
    }
    if (!sys.processTemplates.includes("home_mortgage")) {
      console.log(`     ↺ already untagged: ${name}`);
      skipped++;
      continue;
    }
    const next = sys.processTemplates.filter((k) => k !== "home_mortgage");
    await prisma.applicationSystem.update({
      where: { id: sys.id },
      data: { processTemplates: next },
    });
    const remaining = next.length === 0 ? "(no template tags remaining)" : `(still tagged: ${next.join(", ")})`;
    console.log(`     − untagged: ${name} ${remaining}`);
    untagged++;
  }
  console.log(`     → ${untagged} untagged, ${skipped} skipped`);
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("  v1.2.1 cleanup — retail actors, mortgage steps, mortgage systems");
  console.log("══════════════════════════════════════════════════════════════════");

  await addRetailActors();
  await dedupeHomeMortgageSteps();
  await untagGenericHomeMortgageSystems();

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  Done. Run audit-seating.ts to verify.");
  console.log("══════════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
