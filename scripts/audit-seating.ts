/**
 * Seating audit — for retail_onboarding and home_mortgage, show:
 *   - Systems seated to this template (processTemplates contains the key)
 *   - Steps wired to this template
 *   - Actors that exist globally (banking actors are global by data model)
 *   - Gaps vs the expected actor/system list from the seed scripts
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/audit-seating.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/lib/db";

const TEMPLATES = ["retail_onboarding", "home_mortgage"];

// Expected actors/systems per template (from the seed scripts).
// retail_onboarding seed never seeded actors/systems — left empty deliberately.
const EXPECTED: Record<string, { actors: string[]; systems: string[] }> = {
  retail_onboarding: {
    // Based on UK retail onboarding patterns (subProcesses keys imply these roles)
    actors: [
      "Retail Applicant",
      "Branch Customer Service Rep",
      "Digital Onboarding Bot",
      "KYC / AML Analyst",
      "Credit Underwriter",
      "Fraud Analyst",
      "Compliance Officer",
      "Onboarding Operations",
    ],
    systems: [
      "Online Banking Portal",
      "Identity Verification Provider",
      "KYC / AML Screening Platform",
      "Credit Bureau (Experian / Equifax / TransUnion)",
      "Fraud Database (CIFAS / Synectics)",
      "Decision Engine",
      "Core Banking System",
      "Card Production / Issuance System",
      "Digital Banking Enrollment",
    ],
  },
  home_mortgage: {
    // From scripts/fix-home-mortgage.ts (lines 39-60)
    actors: [
      "Mortgage Borrower",
      "Mortgage Loan Officer",
      "Loan Processor",
      "Mortgage Underwriter",
      "Property Appraiser",
      "Title Company",
      "Mortgage Closer",
      "Compliance Officer",
      "Automated Underwriting",
    ],
    systems: [
      "Encompass (ICE Mortgage Tech)",
      "Fannie Mae Desktop Underwriter",
      "Freddie Mac Loan Product Advisor",
      "Experian / Equifax / TransUnion",
      "AppraisalPort / Mercury",
      "First American / Fidelity Title",
      "DocuSign / Notarize",
      "MERS",
      "FIS IBS / Fiserv LoanServ",
    ],
  },
};

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  SEATING AUDIT — retail_onboarding + home_mortgage");
  console.log("══════════════════════════════════════════════════════════════════");

  const allActors = await prisma.processActor.findMany({ orderBy: { name: "asc" } });
  console.log(`\nGlobal ProcessActor pool: ${allActors.length} rows`);

  for (const key of TEMPLATES) {
    console.log(`\n──────────────────────────────────────────────────────────────────`);
    console.log(`  ${key}`);
    console.log(`──────────────────────────────────────────────────────────────────`);

    const template = await prisma.processTemplate.findFirst({
      where: { processKey: key },
      orderBy: { version: "desc" },
    });
    if (!template) { console.log("  ✗ TEMPLATE NOT FOUND"); continue; }

    const subProcesses = (template.subProcesses ?? []) as Array<{ label: string }>;
    const metrics = (template.metricDefinitions ?? []) as Array<unknown>;
    console.log(`\n  Template: "${template.name}" v${template.version} ${template.isActive ? "[ACTIVE]" : "[draft]"}`);
    console.log(`     subProcesses: ${subProcesses.length} · metrics: ${metrics.length}`);

    // Steps
    const steps = await prisma.processStepTemplate.findMany({
      where: { processTemplate: key },
      orderBy: { order: "asc" },
    });
    console.log(`\n  STEPS (${steps.length} rows wired via processTemplate="${key}"):`);
    if (steps.length === 0) console.log(`     (none)`);
    for (const s of steps) console.log(`     [${String(s.order).padStart(2, " ")}] ${s.label}`);

    // Systems
    const seatedSystems = await prisma.applicationSystem.findMany({
      where: { processTemplates: { has: key } },
      orderBy: { name: "asc" },
    });
    console.log(`\n  SYSTEMS SEATED (${seatedSystems.length}) — processTemplates contains "${key}":`);
    if (seatedSystems.length === 0) console.log(`     (none — UI will show "No systems linked to this process.")`);
    for (const s of seatedSystems) console.log(`     ✓ ${s.name}`);

    const expectedSys = EXPECTED[key].systems;
    const seatedSysNames = seatedSystems.map((s) => s.name);
    const missingSys = expectedSys.filter((name) => !seatedSysNames.includes(name));
    console.log(`\n  SYSTEMS EXPECTED (${expectedSys.length}) vs SEATED (${seatedSysNames.length}):`);
    for (const name of expectedSys) {
      const ok = seatedSysNames.includes(name);
      console.log(`     ${ok ? "✓" : "✗ MISSING"}  ${name}`);
    }
    if (missingSys.length > 0) {
      console.log(`\n  → ${missingSys.length} expected system(s) NOT SEATED to ${key}`);
    }

    // Actors (global) — but check which ones the template "expects"
    const expectedActors = EXPECTED[key].actors;
    const globalActorNames = allActors.map((a) => a.name);
    console.log(`\n  ACTORS EXPECTED (${expectedActors.length}) vs IN GLOBAL POOL:`);
    const actorGaps: string[] = [];
    for (const name of expectedActors) {
      const exists = globalActorNames.includes(name);
      console.log(`     ${exists ? "✓ in pool" : "✗ MISSING from global pool"}  ${name}`);
      if (!exists) actorGaps.push(name);
    }
    if (actorGaps.length > 0) {
      console.log(`\n  → ${actorGaps.length} expected actor(s) NOT in ProcessActor pool`);
    }

    // Summary verdict
    const sysDone = missingSys.length === 0;
    const actorDone = actorGaps.length === 0;
    console.log(`\n  ──────────────────`);
    console.log(`  Verdict: ${sysDone && actorDone ? "✓ COMPLETE" : "⚠ GAPS PRESENT"}`);
    console.log(`     Systems seated: ${seatedSystems.length} of ${expectedSys.length} expected`);
    console.log(`     Actors in pool: ${expectedActors.length - actorGaps.length} of ${expectedActors.length} expected`);
  }

  console.log(`\n══════════════════════════════════════════════════════════════════`);
  console.log(`  Note on actors: ProcessActor rows are GLOBAL by data model`);
  console.log(`  (no per-template tag exists on the schema). The admin UI shows`);
  console.log(`  all actors on every template page. "Missing" actors here mean`);
  console.log(`  no row with that name exists in the global pool yet.`);
  console.log(`══════════════════════════════════════════════════════════════════\n`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
