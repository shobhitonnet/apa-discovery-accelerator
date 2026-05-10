/**
 * Sample-data generator for the retail onboarding digital twin pipeline.
 *
 * Run with: npx tsx sample-data/retail-onboarding/generate.ts
 *
 * Produces 8 CSV files mirroring a typical retail-onboarding data request:
 *   - digital_banking_applications.csv     (1 row per case — application start)
 *   - identity_verification_events.csv     (1 row per case — KYC events)
 *   - kyc_aml_screening.csv                (1 row per case — AML check)
 *   - decision_engine_events.csv           (1 row per case — underwriting decision)
 *   - account_opening_events.csv           (1 row per APPROVED case)
 *   - card_issuance.csv                    (1 row per APPROVED case)
 *   - digital_enrollment.csv               (1 row per APPROVED case — most)
 *   - welcome_communications.csv           (1 row per APPROVED case)
 *
 * The data is deterministic (seeded RNG) and includes realistic deviations:
 *   • ~12% of cases get declined at decision
 *   • ~8% of cases re-run KYC (loop)
 *   • ~5% of cases never get a card issued (process gap)
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Deterministic RNG ─────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));

// ── Config ────────────────────────────────────────────────────────────────
const N_CASES = 100;
const START_DATE = new Date("2024-01-15T08:00:00Z");

const CHANNELS = ["web", "mobile_app", "branch", "phone"] as const;
const PRODUCTS = ["current_account", "savings_account", "joint_account"] as const;
const KYC_OUTCOMES = ["pass", "pass", "pass", "pass", "pass", "fail_retry", "fail"] as const;
const DECISION_OUTCOMES = ["approved", "approved", "approved", "approved", "approved", "approved", "approved", "declined"] as const;
const ACTORS = ["customer", "front_office_agent", "compliance_officer", "underwriter", "system"] as const;
const CARD_TYPES = ["debit_visa", "debit_mastercard"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtTs = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
const addMin = (d: Date, mins: number) => new Date(d.getTime() + mins * 60_000);
const addHours = (d: Date, hours: number) => addMin(d, hours * 60);
const addDays = (d: Date, days: number) => addHours(d, days * 24);

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(name: string, headers: string[], rows: (string | number | null)[][]) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  const path = join(__dirname, name);
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
  console.log(`✓ ${name} — ${rows.length} rows`);
}

// ── Generate cases ────────────────────────────────────────────────────────
type Case = {
  applicationId: string;
  customerId: string;
  channel: string;
  product: string;
  appliedAt: Date;
  kycRetryCount: number;
  decisionOutcome: "approved" | "declined";
  decisionAt: Date;
  approved: boolean;
  cardIssued: boolean;
  digitallyEnrolled: boolean;
};

const cases: Case[] = [];
for (let i = 0; i < N_CASES; i++) {
  const id = String(i + 1).padStart(4, "0");
  const applicationId = `APP-2024-${id}`;
  const customerId = `CUST-${100000 + i + 1}`;
  const appliedAt = addHours(START_DATE, i * between(2, 8));
  const channel = pick([...CHANNELS]);
  const product = pick([...PRODUCTS]);

  // KYC may need retries
  const kycOutcome = pick([...KYC_OUTCOMES]);
  const kycRetryCount = kycOutcome === "fail_retry" ? 1 : 0;

  // Decision: ~12% declined
  const decisionOutcome = pick([...DECISION_OUTCOMES]);
  const decisionDelay = between(8, 72) + kycRetryCount * 24;
  const decisionAt = addHours(appliedAt, decisionDelay);
  const approved = decisionOutcome === "approved";

  // ~5% of approved never get a card (process gap)
  const cardIssued = approved && rng() > 0.05;
  const digitallyEnrolled = approved && rng() > 0.15;

  cases.push({ applicationId, customerId, channel, product, appliedAt, kycRetryCount, decisionOutcome, decisionAt, approved, cardIssued, digitallyEnrolled });
}

// ── File 1: applications ──────────────────────────────────────────────────
writeCsv(
  "digital_banking_applications.csv",
  ["application_id", "customer_id", "submission_timestamp", "channel", "product_type", "applicant_name", "status"],
  cases.map((c) => [
    c.applicationId, c.customerId, fmtTs(c.appliedAt),
    c.channel, c.product,
    `Applicant ${c.applicationId.slice(-4)}`,
    "submitted",
  ])
);

// ── File 2: identity verification ─────────────────────────────────────────
{
  const rows: (string | number | null)[][] = [];
  for (const c of cases) {
    let attemptTs = addMin(c.appliedAt, between(2, 30));
    for (let attempt = 0; attempt <= c.kycRetryCount; attempt++) {
      rows.push([
        c.applicationId,
        `IDV-${c.applicationId.slice(-4)}-${attempt + 1}`,
        fmtTs(attemptTs),
        pick(["passport", "national_id", "drivers_license"]),
        attempt === c.kycRetryCount ? "verified" : "retry_required",
        attempt === 0 ? "system" : "compliance_officer",
      ]);
      attemptTs = addHours(attemptTs, between(4, 24));
    }
  }
  writeCsv(
    "identity_verification_events.csv",
    ["application_id", "verification_id", "verification_timestamp", "method", "outcome", "performed_by"],
    rows
  );
}

// ── File 3: KYC / AML screening ───────────────────────────────────────────
writeCsv(
  "kyc_aml_screening.csv",
  ["application_id", "screening_timestamp", "sanctions_check", "pep_check", "adverse_media", "outcome", "screened_by"],
  cases.map((c) => {
    const screenedAt = addHours(c.appliedAt, between(1, 6) + c.kycRetryCount * 4);
    return [
      c.applicationId,
      fmtTs(screenedAt),
      "clear", "clear", "clear",
      "passed",
      "compliance_officer",
    ];
  })
);

// ── File 4: decision engine ───────────────────────────────────────────────
writeCsv(
  "decision_engine_events.csv",
  ["application_id", "decision_timestamp", "decision_outcome", "decision_reason", "decision_score", "decided_by"],
  cases.map((c) => [
    c.applicationId,
    fmtTs(c.decisionAt),
    c.decisionOutcome,
    c.approved ? "criteria_met" : pick(["affordability_failed", "credit_score_low", "incomplete_documents"]),
    between(550, 850),
    "underwriter",
  ])
);

// ── File 5: account opening (only approved) ───────────────────────────────
writeCsv(
  "account_opening_events.csv",
  ["application_id", "customer_id", "account_id", "account_open_timestamp", "product_code", "branch_code"],
  cases.filter((c) => c.approved).map((c) => [
    c.applicationId, c.customerId,
    `ACC-${c.customerId.slice(-6)}`,
    fmtTs(addHours(c.decisionAt, between(2, 24))),
    c.product === "current_account" ? "CUR-001" : c.product === "savings_account" ? "SAV-001" : "JNT-001",
    pick(["BR-LON-001", "BR-MAN-002", "BR-BIR-003", "BR-EDI-004"]),
  ])
);

// ── File 6: card issuance (most approved) ─────────────────────────────────
writeCsv(
  "card_issuance.csv",
  ["customer_id", "card_id", "issuance_timestamp", "card_type", "card_status", "issued_by"],
  cases.filter((c) => c.cardIssued).map((c) => [
    c.customerId,
    `CARD-${c.customerId.slice(-6)}`,
    fmtTs(addDays(c.decisionAt, between(1, 5))),
    pick([...CARD_TYPES]),
    "active",
    "system",
  ])
);

// ── File 7: digital enrollment (most approved) ────────────────────────────
writeCsv(
  "digital_enrollment.csv",
  ["customer_id", "enrollment_timestamp", "channel", "biometric_setup", "mfa_enabled"],
  cases.filter((c) => c.digitallyEnrolled).map((c) => [
    c.customerId,
    fmtTs(addDays(c.decisionAt, between(1, 7))),
    pick(["mobile_app", "web"]),
    rng() > 0.3 ? "true" : "false",
    "true",
  ])
);

// ── File 8: welcome communications ────────────────────────────────────────
writeCsv(
  "welcome_communications.csv",
  ["customer_id", "communication_id", "sent_timestamp", "channel", "template_id", "delivery_status"],
  cases.filter((c) => c.approved).map((c) => [
    c.customerId,
    `COMM-${c.customerId.slice(-6)}`,
    fmtTs(addDays(c.decisionAt, between(1, 3))),
    pick(["email", "sms", "push"]),
    "WELCOME_V2",
    "delivered",
  ])
);

console.log(`\n${cases.length} cases generated. Sample CSVs ready in sample-data/retail-onboarding/`);
