/**
 * Seed the process repository for UK × retail bank × retail_onboarding.
 *
 * This is the FIRST "active" reference. Other countries / institution types /
 * processes will be added incrementally and marked inactive ("coming soon")
 * until they're validated.
 *
 * Run: source .env.local && npx tsx scripts/seed-repository-uk-onboarding.ts
 */

import { prisma } from "@/lib/db";
import { DEVIATION_LIBRARY } from "@/lib/deviationLibrary";

const COUNTRY = "United Kingdom";
const PROCESS_KEY = "retail_onboarding";

// ──────────────────────────────────────────────────────────────────────────
// 1. ProcessTemplate — canonical onboarding model
// ──────────────────────────────────────────────────────────────────────────

const subProcesses = [
  { key: "customer_application",   label: "Customer Application",       description: "Channels & data capture for the application form" },
  { key: "identity_verification",  label: "Identity Verification",      description: "ID document capture + liveness / biometric checks" },
  { key: "kyc_aml_screening",      label: "KYC / AML Screening",        description: "Sanctions, PEP, adverse media, risk scoring" },
  { key: "credit_check",           label: "Credit Bureau Check",        description: "Credit bureau pull (Experian / Equifax / TransUnion)" },
  { key: "fraud_screening",        label: "Fraud Screening",            description: "CIFAS / Synectics / National Fraud Database lookup" },
  { key: "decision",               label: "Underwriting Decision",      description: "Auto / manual decision based on combined risk view" },
  { key: "account_opening",        label: "Account Opening",            description: "Core banking provisioning + account number issuance" },
  { key: "card_issuance",          label: "Card Issuance",              description: "Debit card production & delivery" },
  { key: "digital_enrollment",     label: "Digital Banking Enrollment", description: "Mobile/web enrollment, MFA, biometric setup" },
];

const metricDefinitions = [
  { key: "applicationsPerYear", label: "New applications per year",     unit: "count",   required: true },
  { key: "onboardingsPerYear",  label: "Successful onboardings per year", unit: "count", required: true },
  { key: "avgOnboardDays",      label: "Avg time to onboard (days)",    unit: "days",    required: true },
  { key: "kycFailureRate",      label: "KYC failure rate (%)",          unit: "percent", required: false },
  { key: "abandonmentRate",     label: "Application abandonment rate (%)", unit: "percent", required: false },
  { key: "fraudRate",           label: "Fraud incident rate (%)",       unit: "percent", required: false },
];

async function seedProcessTemplate() {
  // Pull a recent representative process map from an existing engagement, or
  // leave the default empty — admins will populate this through the canvas.
  // For now we seed with empty — the canvas auto-generates when first opened.
  await prisma.processTemplate.upsert({
    where: { processKey_version: { processKey: PROCESS_KEY, version: 1 } },
    create: {
      processKey: PROCESS_KEY,
      version: 1,
      isActive: true,
      name: "Retail Account Onboarding",
      description: "End-to-end new-customer onboarding for a retail current/savings account: application capture, identity verification, KYC/AML screening, credit & fraud checks, underwriting decision, account opening, card issuance, digital enrollment.",
      lineOfBusiness: "retail",
      applicableInstTypes: ["bank", "credit_union", "neobank", "building_society"],
      defaultProcessMap: {} as object, // Canvas will fill this
      subProcesses,
      metricDefinitions,
      notes: "Reference template based on UK retail onboarding patterns. FCA/PRA regulatory context applies. Calibrated for Tier-1 / mid-tier retail banks.",
    },
    update: {
      isActive: true,
      name: "Retail Account Onboarding",
      description: "End-to-end new-customer onboarding for a retail current/savings account: application capture, identity verification, KYC/AML screening, credit & fraud checks, underwriting decision, account opening, card issuance, digital enrollment.",
      subProcesses,
      metricDefinitions,
    },
  });
  console.log("✓ ProcessTemplate seeded");
}

// ──────────────────────────────────────────────────────────────────────────
// 2. ValueCoefficients — UK-specific banking values used by Stage 5
// ──────────────────────────────────────────────────────────────────────────

const ukCoefficients = [
  // FTE rates (loaded — salary + on-costs)
  { key: "fte_ops_hourly_rate",       value: 35,    unit: "GBP/hr",   category: "operational", description: "Loaded hourly cost — back-office operations / KYC analyst", source: "UK banking ops benchmarks 2024-2025" },
  { key: "fte_underwriter_hourly_rate", value: 80,  unit: "GBP/hr",   category: "operational", description: "Loaded hourly cost — credit underwriter", source: "UK banking ops benchmarks 2024-2025" },
  { key: "fte_compliance_officer_hourly_rate", value: 65, unit: "GBP/hr", category: "operational", description: "Loaded hourly cost — compliance officer / MLRO function", source: "UK banking ops benchmarks 2024-2025" },
  { key: "fte_branch_csr_hourly_rate", value: 28,   unit: "GBP/hr",   category: "operational", description: "Loaded hourly cost — branch customer service rep", source: "UK banking ops benchmarks 2024-2025" },

  // Regulatory exposure
  { key: "kyc_breach_avg_fine",        value: 18000, unit: "GBP/case", category: "regulatory", description: "Average per-case fine for KYC failures across FCA enforcement", source: "FCA Annual Report 2024 — enforcement statistics" },
  { key: "kyc_remediation_cost",       value: 45000, unit: "GBP/case", category: "regulatory", description: "Per-case remediation cost when KYC failures are identified retrospectively", source: "Industry remediation programme benchmarks" },
  { key: "edd_breach_avg_fine",        value: 60000, unit: "GBP/case", category: "regulatory", description: "Enhanced Due Diligence breach (high-risk segment) average fine", source: "FCA EDD enforcement actions 2023-2024" },
  { key: "consumer_duty_complaint_cost", value: 2500, unit: "GBP/case", category: "regulatory", description: "Provision per Consumer Duty complaint (FCA Sec 1B)", source: "Bank complaint provision data 2024" },
  { key: "fos_case_fee",               value: 750,   unit: "GBP/case", category: "regulatory", description: "Financial Ombudsman Service case fee (charged to firm regardless of outcome)", source: "FOS published fees 2024" },

  // Risk / loss models
  { key: "credit_default_rate_screened", value: 0.014, unit: "ratio", category: "risk", description: "Default rate for properly credit-screened retail customers", source: "UK Finance lending data 2024" },
  { key: "credit_default_rate_unscreened", value: 0.032, unit: "ratio", category: "risk", description: "Default rate when credit screening is bypassed/incomplete", source: "Industry uplift studies" },
  { key: "credit_avg_loss_pct_per_default", value: 0.7, unit: "ratio", category: "risk", description: "Loss given default — % of exposure typically lost", source: "UK Finance LGD benchmarks" },
  { key: "fraud_rate_account_opening", value: 0.004, unit: "ratio", category: "risk", description: "First-party + third-party fraud rate at account opening", source: "CIFAS Annual Fraudscape 2024" },
  { key: "fraud_avg_loss_per_case",   value: 4800, unit: "GBP/case", category: "risk", description: "Average fraud loss per fraudulent account opened", source: "CIFAS Annual Fraudscape 2024" },

  // Customer / commercial
  { key: "abandonment_revenue_loss_per_case", value: 320, unit: "GBP/case", category: "operational", description: "Lost lifetime value from a customer who abandons during onboarding", source: "Retail bank LTV/CAC studies" },
  { key: "rework_minutes_kyc",        value: 12,    unit: "minutes", category: "operational", description: "Avg minutes of compliance officer time per KYC retry", source: "Industry process benchmarks" },
  { key: "rework_minutes_document",   value: 18,    unit: "minutes", category: "operational", description: "Avg minutes of staff time per document re-request", source: "Industry process benchmarks" },
];

async function seedValueCoefficients() {
  let count = 0;
  const validFrom = new Date("2024-01-01T00:00:00Z");
  for (const c of ukCoefficients) {
    await prisma.valueCoefficient.upsert({
      where: {
        country_institutionType_key_validFrom: {
          country: COUNTRY,
          institutionType: "", // "" = applies to all institution types
          key: c.key,
          validFrom,
        },
      },
      create: {
        country: COUNTRY,
        institutionType: "",
        key: c.key,
        value: c.value,
        unit: c.unit,
        category: c.category,
        description: c.description,
        source: c.source,
        validFrom,
      },
      update: {
        value: c.value,
        unit: c.unit,
        category: c.category,
        description: c.description,
        source: c.source,
      },
    });
    count++;
  }
  console.log(`✓ ValueCoefficient: seeded ${count} UK coefficients`);
}

// ──────────────────────────────────────────────────────────────────────────
// 3. DeviationPattern — copy from TS library into DB (UK + retail_onboarding)
// ──────────────────────────────────────────────────────────────────────────

async function seedDeviationPatterns() {
  let count = 0;
  for (const p of DEVIATION_LIBRARY) {
    await prisma.deviationPattern.upsert({
      where: { patternKey: p.id },
      create: {
        patternKey: p.id,
        type: p.type,
        stepKeyword: p.stepKeyword.source,
        processKey: PROCESS_KEY,
        country: COUNTRY,
        reasons: p.reasons as unknown as object,
      },
      update: {
        type: p.type,
        stepKeyword: p.stepKeyword.source,
        reasons: p.reasons as unknown as object,
      },
    });
    count++;
  }
  console.log(`✓ DeviationPattern: seeded ${count} patterns from TS library`);
}

// ──────────────────────────────────────────────────────────────────────────
// 4. DataRequestTemplate — leave as draft for now (engagements still use AI)
// ──────────────────────────────────────────────────────────────────────────

async function seedDataRequestTemplate() {
  // We'll seed a real template later. For now, register the slot as inactive
  // so the engagement bootstrap knows to fall back to AI generation.
  await prisma.dataRequestTemplate.upsert({
    where: { processKey: PROCESS_KEY },
    create: {
      processKey: PROCESS_KEY,
      version: 1,
      isActive: false,
      items: [],
      notes: "Draft — engagements currently use AI generation. Will populate from real client data requests over time.",
    },
    update: {},
  });
  console.log("✓ DataRequestTemplate: registered as draft");
}

// ──────────────────────────────────────────────────────────────────────────

async function main() {
  await seedProcessTemplate();
  await seedValueCoefficients();
  await seedDeviationPatterns();
  await seedDataRequestTemplate();
  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
