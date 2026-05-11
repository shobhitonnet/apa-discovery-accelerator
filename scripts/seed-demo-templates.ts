/**
 * Demo-prep seed script — fully offline, no Claude required.
 *
 * 1. Soft-deletes the duplicate `retail_account_opening` template if no
 *    engagements reference it.
 * 2. Seeds USA value coefficients (USD-denominated banking benchmarks).
 * 3. Seeds two new active ProcessTemplates:
 *      - commercial_onboarding (Commercial Account Onboarding)
 *      - sme_loan_origination (SME Loan Origination)
 *    Each with rich seed data — steps, actors, systems, deviation patterns,
 *    metric definitions — calibrated for US retail/commercial banking.
 * 4. Activates all four retail/commercial/SME templates for "United States"
 *    via CountryProcessActivation so the engagement-create flow picks them up.
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-demo-templates.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { prisma } from "@/lib/db";

const COUNTRY_US = "United States";

// ──────────────────────────────────────────────────────────────────────────
// USA value coefficients — parity with UK seed set, USD-denominated.
// ──────────────────────────────────────────────────────────────────────────

const usaCoefficients = [
  // FTE rates (loaded)
  { key: "fte_ops_hourly_rate",                value: 48,   unit: "USD/hr",   category: "operational", description: "Loaded hourly cost — back-office operations / KYC analyst", source: "US banking ops benchmarks 2024-2025" },
  { key: "fte_underwriter_hourly_rate",        value: 110,  unit: "USD/hr",   category: "operational", description: "Loaded hourly cost — credit underwriter", source: "US banking ops benchmarks 2024-2025" },
  { key: "fte_compliance_officer_hourly_rate", value: 95,   unit: "USD/hr",   category: "operational", description: "Loaded hourly cost — BSA/AML compliance officer", source: "US banking ops benchmarks 2024-2025" },
  { key: "fte_branch_csr_hourly_rate",         value: 38,   unit: "USD/hr",   category: "operational", description: "Loaded hourly cost — branch customer service rep", source: "US banking ops benchmarks 2024-2025" },
  { key: "fte_rm_hourly_rate",                 value: 145,  unit: "USD/hr",   category: "operational", description: "Loaded hourly cost — commercial relationship manager", source: "US commercial banking ops benchmarks" },

  // Regulatory exposure (US-specific — BSA, FinCEN, OCC, CFPB)
  { key: "kyc_breach_avg_fine",            value: 22000, unit: "USD/case", category: "regulatory", description: "Per-case BSA/CIP KYC failure exposure (avg across FinCEN/OCC enforcement)", source: "FinCEN/OCC enforcement statistics 2023-2024" },
  { key: "kyc_remediation_cost",           value: 58000, unit: "USD/case", category: "regulatory", description: "Per-case remediation cost for retrospective KYC failures", source: "Industry remediation programme benchmarks (US)" },
  { key: "edd_breach_avg_fine",            value: 75000, unit: "USD/case", category: "regulatory", description: "Enhanced Due Diligence breach (high-risk segment) per-case fine", source: "FinCEN EDD enforcement actions 2023-2024" },
  { key: "consumer_complaint_provision",   value: 3200,  unit: "USD/case", category: "regulatory", description: "Provision per CFPB-eligible complaint (Reg B / UDAAP)", source: "CFPB complaint resolution averages 2024" },
  { key: "occ_compliance_finding_cost",    value: 850,   unit: "USD/case", category: "regulatory", description: "Per-case cost of an OCC / state regulator compliance finding", source: "OCC published examination data" },

  // Risk / loss models
  { key: "credit_default_rate_screened",     value: 0.018, unit: "ratio",    category: "risk",        description: "Default rate for properly credit-screened US retail customers", source: "Federal Reserve consumer credit data 2024" },
  { key: "credit_default_rate_unscreened",   value: 0.041, unit: "ratio",    category: "risk",        description: "Default rate when credit screening is bypassed/incomplete", source: "Industry uplift studies (US)" },
  { key: "credit_avg_loss_pct_per_default",  value: 0.68,  unit: "ratio",    category: "risk",        description: "Loss given default — % of exposure typically lost", source: "Fed/FDIC LGD benchmarks" },
  { key: "fraud_rate_account_opening",       value: 0.006, unit: "ratio",    category: "risk",        description: "First-party + third-party fraud rate at account opening", source: "Javelin / Aite-Novarica fraud reports 2024" },
  { key: "fraud_avg_loss_per_case",          value: 6200,  unit: "USD/case", category: "risk",        description: "Average fraud loss per fraudulent account opened", source: "Javelin Strategy & Research 2024" },

  // SME / commercial-specific
  { key: "sme_loan_default_rate",            value: 0.038, unit: "ratio",    category: "risk",        description: "Default rate on SME loans (US, post-COVID baseline)", source: "SBA + Fed Small Business Credit Survey 2024" },
  { key: "sme_loan_avg_size",                value: 175000, unit: "USD/case", category: "operational", description: "Average SME term-loan size (US)", source: "SBA 7(a) program statistics 2024" },
  { key: "commercial_onboarding_avg_revenue", value: 28000, unit: "USD/year", category: "operational", description: "Average annual revenue per commercial banking customer (mid-market)", source: "ABA commercial banking benchmarks" },

  // Customer / commercial
  { key: "abandonment_revenue_loss_per_case", value: 480,  unit: "USD/case", category: "operational", description: "Lost lifetime value from a customer who abandons during onboarding", source: "US retail bank LTV/CAC studies" },
  { key: "rework_minutes_kyc",                value: 14,   unit: "minutes",  category: "operational", description: "Avg minutes of compliance officer time per KYC retry", source: "Industry process benchmarks" },
  { key: "rework_minutes_document",           value: 22,   unit: "minutes",  category: "operational", description: "Avg minutes of staff time per document re-request", source: "Industry process benchmarks" },
];

async function seedUsaCoefficients() {
  const validFrom = new Date("2024-01-01T00:00:00Z");
  let count = 0;
  for (const c of usaCoefficients) {
    await prisma.valueCoefficient.upsert({
      where: { country_institutionType_key_validFrom: { country: COUNTRY_US, institutionType: "", key: c.key, validFrom } },
      create: { country: COUNTRY_US, institutionType: "", key: c.key, value: c.value, unit: c.unit, category: c.category, description: c.description, source: c.source, validFrom },
      update: { value: c.value, unit: c.unit, category: c.category, description: c.description, source: c.source },
    });
    count++;
  }
  console.log(`✓ ValueCoefficient: seeded ${count} USA coefficients`);
}

// ──────────────────────────────────────────────────────────────────────────
// Commercial Account Onboarding
// ──────────────────────────────────────────────────────────────────────────

const commercialOnboarding = {
  processKey: "commercial_onboarding",
  name: "Commercial Account Onboarding",
  description: "End-to-end commercial onboarding for mid-market and corporate clients: entity verification, beneficial-ownership identification, enhanced due diligence (EDD), credit + risk assessment, mandate / signatory setup, product activation, and digital channel enablement.",
  lineOfBusiness: "commercial",
  steps: [
    { label: "Submit Commercial Application",   order: 1,  description: "RM or client portal captures entity details, intended products, projected volumes" },
    { label: "Verify Legal Entity",             order: 2,  description: "Validate entity existence and standing (Secretary of State, EIN, articles of incorporation)" },
    { label: "Identify Beneficial Owners",      order: 3,  description: "Capture UBO list (25%+ ownership) per FinCEN CDD rule" },
    { label: "Run Sanctions & PEP Screening",   order: 4,  description: "OFAC / SDN list, PEP, adverse media for entity + UBOs" },
    { label: "Conduct Enhanced Due Diligence",  order: 5,  description: "Source of funds, source of wealth, expected activity profile (high-risk segments)" },
    { label: "Assess Credit Risk Profile",      order: 6,  description: "D&B / Experian Business pull, internal risk rating, exposure consolidation" },
    { label: "Set Up Account Mandate",          order: 7,  description: "Capture signatories, authorisation matrix, payment limits" },
    { label: "Provision Account in Core",       order: 8,  description: "Open accounts in core banking, assign account numbers and product features" },
    { label: "Enable Treasury & Payments",      order: 9,  description: "Activate ACH, wire, FX, card services; integrate with client ERP if applicable" },
    { label: "Enroll Digital Banking",          order: 10, description: "Multi-user portal setup, role-based permissions, hardware tokens" },
    { label: "Conduct RM Welcome & Handoff",    order: 11, description: "RM completes welcome call, hands over to client servicing team" },
  ],
  actors: [
    { name: "Corporate Client",              color: "#3366FF", description: "Authorised signatory acting on behalf of the entity",                                  type: "customer" },
    { name: "Relationship Manager",          color: "#26BC71", description: "Commercial RM owns the onboarding journey end-to-end",                                  type: "front-office" },
    { name: "KYC Analyst (Commercial)",      color: "#FFAC09", description: "Performs entity verification, UBO collection, sanctions screening",                    type: "back-office" },
    { name: "BSA / AML Compliance Officer",  color: "#EF4444", description: "Approves EDD, escalations, high-risk entity decisions",                                type: "compliance" },
    { name: "Credit Underwriter",            color: "#06B6D4", description: "Reviews financials and assigns risk rating",                                            type: "back-office" },
    { name: "Onboarding Operations",         color: "#FFAC09", description: "Account provisioning and product activation",                                          type: "operations" },
    { name: "Treasury Services Specialist",  color: "#8B2BE2", description: "Configures payments, FX, ERP integration",                                              type: "back-office" },
    { name: "Core Banking System",           color: "#64748B", description: "Automated account provisioning",                                                        type: "automated" },
  ],
  systems: [
    { name: "Salesforce Financial Services Cloud", color: "#3366FF", description: "Front-office CRM and application capture",                                                     processTemplates: ["commercial_onboarding"] },
    { name: "nCino",                                color: "#06B6D4", description: "Commercial onboarding workflow + credit / underwriting",                                       processTemplates: ["commercial_onboarding"] },
    { name: "LexisNexis Bridger",                   color: "#EF4444", description: "Sanctions / PEP / adverse media screening",                                                     processTemplates: ["commercial_onboarding"] },
    { name: "Dun & Bradstreet",                     color: "#FFAC09", description: "Business credit bureau (entity verification + commercial credit)",                              processTemplates: ["commercial_onboarding"] },
    { name: "Refinitiv WorldCheck",                 color: "#EF4444", description: "Enhanced due-diligence + UBO research",                                                          processTemplates: ["commercial_onboarding"] },
    { name: "FIS IBS / Fiserv Premier",              color: "#F97316", description: "Core banking system — account provisioning",                                                    processTemplates: ["commercial_onboarding"] },
    { name: "Treasury Management Portal",            color: "#8B2BE2", description: "Digital channel for commercial client users",                                                   processTemplates: ["commercial_onboarding"] },
  ],
  metricDefinitions: [
    { key: "commercial_onboarding_lead_time_days", label: "Lead time (days)",        category: "time",       source: "direct",   unit: "days",     description: "Wall-clock days from application submission to account go-live", computation: "avg(case_end - case_start)",                                                                                               goodThreshold: 7, poorThreshold: 21, direction: "lower_is_better", required: true },
    { key: "commercial_onboarding_touch_time_hr",  label: "Touch time (hours)",     category: "time",       source: "inferred", unit: "hours",    description: "Active human effort per onboarded entity",                       dependencies: ["commercial_onboarding_lead_time_days", "fte_ops_hourly_rate"], formula: "lead_time_days × 8 × 0.18 (banking touch ratio)" },
    { key: "cycle_efficiency_commercial",          label: "Cycle efficiency",      category: "time",       source: "inferred", unit: "%",         description: "Touch time as % of lead time",                                   dependencies: ["commercial_onboarding_touch_time_hr", "commercial_onboarding_lead_time_days"], formula: "touch_time_hr / (lead_time_days × 24) × 100" },
    { key: "monthly_commercial_volume",            label: "Commercial onboardings / month", category: "volume", source: "direct",  unit: "count",  description: "New commercial entities onboarded per month",                    computation: "count(distinct case_id) grouped by month",                                                                                  required: true },
    { key: "stp_rate_commercial",                  label: "STP rate (%)",           category: "quality",    source: "direct",   unit: "%",         description: "% of cases that completed without manual exception",              computation: "count(cases on happy path) / total_cases × 100",                                                                            goodThreshold: 65, poorThreshold: 35, direction: "higher_is_better" },
    { key: "ubo_rework_rate",                      label: "UBO collection rework (%)", category: "quality",  source: "direct",   unit: "%",         description: "Cases where UBO docs were re-requested at least once",            computation: "count(cases with loop on UBO step) / total_cases × 100",                                                                    goodThreshold: 8, poorThreshold: 20, direction: "lower_is_better" },
    { key: "edd_approval_rate",                    label: "EDD pass rate (%)",      category: "outcome",    source: "direct",   unit: "%",         description: "% of EDD-flagged cases that successfully completed onboarding",   computation: "count(EDD cases approved) / count(EDD cases) × 100" },
    { key: "commercial_decline_rate",              label: "Decline rate (%)",       category: "outcome",    source: "direct",   unit: "%",         description: "% of applications declined for risk / compliance reasons",        computation: "count(declined cases) / total_cases × 100",                                                                                  goodThreshold: 5, poorThreshold: 15, direction: "lower_is_better" },
    { key: "commercial_abandonment_rate",          label: "Abandonment rate (%)",   category: "outcome",    source: "direct",   unit: "%",         description: "% of applications abandoned before final decision",                computation: "count(abandoned cases) / total_cases × 100",                                                                                 goodThreshold: 10, poorThreshold: 25, direction: "lower_is_better" },
    { key: "cost_per_commercial_onboarding",       label: "Cost per onboarding",    category: "cost",       source: "inferred", unit: "USD/case", description: "Loaded cost per onboarded entity",                                 dependencies: ["commercial_onboarding_touch_time_hr", "fte_underwriter_hourly_rate", "fte_compliance_officer_hourly_rate"], formula: "touch_time_hr × blended_fte_rate", required: true },
    { key: "annual_commercial_ops_cost",           label: "Annual ops cost",        category: "cost",       source: "inferred", unit: "USD/year", description: "Annual operational cost of commercial onboarding",                 dependencies: ["cost_per_commercial_onboarding", "monthly_commercial_volume"], formula: "cost_per_case × monthly_volume × 12" },
    { key: "touchpoints_per_case_commercial",      label: "Customer touchpoints",   category: "cx",         source: "direct",   unit: "count",     description: "Avg number of client-facing interactions per onboarding",         computation: "avg(events with customer-side actor) per case" },
    { key: "abandon_drop_off_step",                label: "Drop-off step",          category: "cx",         source: "direct",   unit: "label",     description: "Step where most abandonments occur",                              computation: "mode(last activity for abandoned cases)" },
    { key: "rm_capacity_per_year",                 label: "RM capacity (entities)", category: "workforce",  source: "assumed",  unit: "count",     description: "Number of new entities an RM can onboard per year at sustainable pace", defaultValue: 60, sourceHint: "Internal RM productivity baseline" },
    { key: "compliance_touch_rate",                label: "Compliance touch rate (%)", category: "workforce", source: "direct",  unit: "%",         description: "% of cases requiring a compliance-officer touch",                  computation: "count(cases with compliance actor) / total × 100" },
    { key: "gate_failure_rate_commercial",         label: "Gate failure rate (%)",  category: "compliance", source: "direct",   unit: "%",         description: "% of cases where a control gate failed at least once",            computation: "count(cases with failed gate) / total × 100",                                                                                goodThreshold: 5, poorThreshold: 15, direction: "lower_is_better" },
    { key: "audit_flagged_rate_commercial",        label: "Audit-flagged rate (%)", category: "compliance", source: "direct",   unit: "%",         description: "% of cases retrospectively flagged by audit / QA",                computation: "count(cases with audit flag) / total × 100" },
    { key: "ubo_data_completeness",                label: "UBO data completeness (%)", category: "compliance", source: "assumed", unit: "%",       description: "Field-level UBO data completeness per FinCEN CDD rule",           defaultValue: 92, sourceHint: "Internal data-quality audit" },
  ],
  deviationPatterns: [
    {
      patternKey: "skip_ubo_commercial_onboarding",
      type: "skip" as const,
      stepKeyword: "(ubo|beneficial|owner)",
      reasons: [
        { category: "compliance" as const, severity: "critical" as const, title: "FinCEN CDD beneficial-ownership rule violation", description: "Cases progressed without collecting UBO data per 31 CFR 1010.230. Direct regulatory breach.", investigationHint: "Filter cases by entity type — LLCs, corporations, and partnerships all require UBO. Check whether the UBO step has any event at all.", valueModel: "Per-case fine exposure: USD 22-75k depending on UBO size + remediation cost USD 58k/case." },
        { category: "legitimate" as const, severity: "low" as const,      title: "Exempt entity type (publicly traded, regulated)",       description: "Public companies and regulated financial institutions are exempt from UBO collection.",                              investigationHint: "Check entity type field — if exempt category, no UBO needed.",                                                                                          valueModel: "No leak. Document as approved variant." },
        { category: "operational" as const, severity: "high" as const,     title: "RM bypassed UBO to accelerate revenue",                  description: "RM marked UBO as 'collected' when only partial info available — typically to meet revenue targets.",                investigationHint: "Cluster by RM. Concentrated bypasses by specific RMs = sales-pressure issue.",                                                                            valueModel: "Compliance risk × volume + RM training cost." },
      ],
    },
    {
      patternKey: "skip_edd_commercial_onboarding",
      type: "skip" as const,
      stepKeyword: "(edd|enhanced.?due.?dilig|source.?of.?funds)",
      reasons: [
        { category: "compliance" as const, severity: "critical" as const, title: "Required EDD skipped for high-risk segment", description: "Cases flagged as high-risk (high-volume cash, high-risk geography, PEP-linked) progressed without EDD per BSA.", investigationHint: "Filter by risk-score band. If high-risk + no EDD events = violation.", valueModel: "FinCEN EDD fine: USD 75k/case avg + remediation USD 58k/case." },
        { category: "operational" as const, severity: "high" as const,     title: "Risk score recalibrated to avoid EDD trigger",                description: "Risk-scoring fields adjusted to keep cases below EDD threshold.",                                                                investigationHint: "Compare risk-score distributions over time. Bimodal clustering at the threshold edge = manipulation.",                                                  valueModel: "Audit risk + remediation cost." },
      ],
    },
    {
      patternKey: "loop_credit_commercial_onboarding",
      type: "loop" as const,
      stepKeyword: "(credit|underwrit|risk.?assess)",
      reasons: [
        { category: "operational" as const, severity: "medium" as const, title: "Financial statements re-requested by underwriter", description: "Initial financial docs were insufficient (incomplete schedules, missing tax returns) — underwriter asks for more.", investigationHint: "Look at the document_type added on the second request. Pattern reveals what's missing in the upfront ask.", valueModel: "Cycle-time impact: 5-12 day delay × volume. Customer abandonment uplift on re-request loops: 10-18%.", apaAgent: "Document Sufficiency Pre-check Agent" },
        { category: "operational" as const, severity: "medium" as const, title: "Risk rating contested by RM",                               description: "RM disputes underwriter's risk rating; case bounces back for second review.",                                                                                investigationHint: "Look at the actor on the looped event. RM vs underwriter = dispute pattern.",                                                                            valueModel: "FTE cost (underwriter at USD 110/hr × 3-5 hours) per disputed case." },
      ],
    },
    {
      patternKey: "out_of_order_mandate_commercial_onboarding",
      type: "out_of_order" as const,
      stepKeyword: "(mandate|signator|account.?open|provision)",
      reasons: [
        { category: "compliance" as const, severity: "high" as const, title: "Account provisioned before mandate confirmed", description: "Accounts created in core banking before signatory mandate was finalised. Creates control gap — payments could go out before authorised signers are set.", investigationHint: "Find cases where 'Provision Account' event timestamp predates 'Set Up Account Mandate'.", valueModel: "Unauthorised-payment risk × case count. Each incident: USD 5-50k recovery cost." },
        { category: "data_quality" as const, severity: "low" as const, title: "Timestamp drift between Salesforce and core banking",   description: "Different systems use different clocks; events within seconds of each other can appear out of order.",                                                          investigationHint: "Check time delta. <60 seconds = likely clock skew.",                                                                                                      valueModel: "No business impact, but 1-2 days engineering to fix clock sync." },
      ],
    },
    {
      patternKey: "extra_step_compliance_override_commercial",
      type: "extra_step" as const,
      stepKeyword: "(manual.?review|escalat|override|exception)",
      reasons: [
        { category: "compliance" as const, severity: "high" as const, title: "MLRO escalation (mandatory)",                       description: "Cases with PEP hits or structured-payment patterns must be escalated to MLRO. Required by BSA.",                                  investigationHint: "Should never be reduced — these are audit-critical. Look at handle time and outcome distribution.",                                                       valueModel: "Cost is part of compliance overhead, not a reducible leak." },
        { category: "operational" as const, severity: "medium" as const, title: "Borderline credit decision sent to senior underwriter",  description: "Risk-score in grey zone — auto-decision engine couldn't handle, sent to senior underwriter for manual call.",                                                  investigationHint: "Check rate. <5% = healthy. 15%+ = thresholds need re-tuning.",                                                                                            valueModel: "Senior underwriter cost: USD 110/hr × 45 min = USD 82.50 per case.", apaAgent: "Decision-Engine Threshold Tuning Agent" },
        { category: "operational" as const, severity: "high" as const, title: "RM-requested override / favour",                        description: "RM intervened to push through a borderline case for a strategic client.",                                                       investigationHint: "Cluster overrides by approver and client tier.",                                                                                                         valueModel: "Concentration audit cost + portfolio risk if pattern is systemic." },
      ],
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// SME Loan Origination
// ──────────────────────────────────────────────────────────────────────────

const smeLoanOrigination = {
  processKey: "sme_loan_origination",
  name: "SME Loan Origination",
  description: "End-to-end small / mid-size business loan origination: application capture, business + owner verification, financial-statement analysis, credit decisioning, collateral assessment, documentation, disbursement, and post-funding setup.",
  lineOfBusiness: "sme",
  steps: [
    { label: "Submit Loan Application",          order: 1,  description: "Business completes application via portal / RM / branch — purpose, amount, term" },
    { label: "Capture Business Documentation",    order: 2,  description: "Tax returns (2-3 years), financial statements, bank statements, AR/AP aging" },
    { label: "Verify Business Identity",         order: 3,  description: "Secretary of State, EIN, beneficial ownership for owners ≥25%" },
    { label: "Pull Business Credit",             order: 4,  description: "D&B Paydex, Experian Intelliscore, Equifax Business" },
    { label: "Pull Owner Personal Credit",       order: 5,  description: "Personal guarantors — FICO, Vantage, debt-to-income" },
    { label: "Analyse Financial Statements",     order: 6,  description: "Debt service coverage ratio (DSCR), liquidity, leverage analysis" },
    { label: "Assess Collateral",                order: 7,  description: "If secured — property appraisal, equipment valuation, UCC search" },
    { label: "Make Credit Decision",             order: 8,  description: "Auto-decision for amounts < USD 100k; manual underwriting above. Approve / decline / counter-offer" },
    { label: "Prepare & Send Loan Documents",    order: 9,  description: "Promissory note, security agreement, personal guarantees, opinion letters" },
    { label: "Receive Signed Documents",         order: 10, description: "E-sign or wet signature collection from all signatories" },
    { label: "Conduct Closing Review",           order: 11, description: "Closing checklist — all stipulations cleared, insurance bound, UCC filed" },
    { label: "Disburse Loan Funds",              order: 12, description: "Wire / ACH funds to business account" },
    { label: "Set Up Loan Servicing",            order: 13, description: "Payment schedule, autopay, servicing fees, regulatory reporting" },
  ],
  actors: [
    { name: "SME Borrower",                  color: "#3366FF", description: "Authorised business owner / signatory",                                          type: "customer" },
    { name: "Business Banker",               color: "#26BC71", description: "Front-office banker; primary client contact",                                    type: "front-office" },
    { name: "Loan Processor",                color: "#FFAC09", description: "Document collection, application setup, stipulation tracking",                    type: "back-office" },
    { name: "Credit Underwriter (SME)",      color: "#06B6D4", description: "Manual underwriting for cases above auto-decision threshold",                     type: "back-office" },
    { name: "Senior Underwriter",            color: "#8B2BE2", description: "Approves loans above standard underwriter limits",                                type: "back-office" },
    { name: "BSA / AML Compliance Officer",  color: "#EF4444", description: "Approves high-risk cases (LLCs with PEP-linked owners, etc.)",                    type: "compliance" },
    { name: "Property Appraiser",            color: "#FFAC09", description: "External — appraises real-estate collateral",                                     type: "external" },
    { name: "Loan Closer",                   color: "#26BC71", description: "Manages docs + closing checklist + UCC filings",                                  type: "operations" },
    { name: "Loan Decision Engine",          color: "#64748B", description: "Automated auto-decision for sub-USD-100k loans",                                  type: "automated" },
    { name: "Core Banking System",           color: "#64748B", description: "Loan booking and servicing setup",                                                type: "automated" },
  ],
  systems: [
    { name: "nCino",                          color: "#06B6D4", description: "SME loan origination workflow + underwriting",                              processTemplates: ["sme_loan_origination"] },
    { name: "Encompass",                      color: "#3366FF", description: "Document collection and stipulation tracking",                              processTemplates: ["sme_loan_origination"] },
    { name: "Dun & Bradstreet",               color: "#FFAC09", description: "Business credit bureau (Paydex, Intelliscore)",                             processTemplates: ["sme_loan_origination"] },
    { name: "Experian Business / Equifax",    color: "#FFAC09", description: "Business credit alternates + owner personal credit",                       processTemplates: ["sme_loan_origination"] },
    { name: "LexisNexis Bridger",             color: "#EF4444", description: "Sanctions / PEP screening for owners",                                       processTemplates: ["sme_loan_origination"] },
    { name: "iAppraise / AppraisalPort",      color: "#8B2BE2", description: "Real-estate collateral appraisal management",                                processTemplates: ["sme_loan_origination"] },
    { name: "DocuSign",                        color: "#3366FF", description: "E-signature for loan documents",                                            processTemplates: ["sme_loan_origination"] },
    { name: "FIS IBS / Fiserv Premier",        color: "#F97316", description: "Loan booking + servicing in core",                                          processTemplates: ["sme_loan_origination"] },
    { name: "UCC Filing Service",              color: "#64748B", description: "State UCC-1 filing for secured loans",                                      processTemplates: ["sme_loan_origination"] },
  ],
  metricDefinitions: [
    { key: "sme_lead_time_days",            label: "Lead time (days)",            category: "time",       source: "direct",   unit: "days",     description: "Calendar days from application to disbursement",        computation: "avg(case_end - case_start)",                                                                                                  goodThreshold: 14, poorThreshold: 45, direction: "lower_is_better", required: true },
    { key: "sme_touch_time_hr",             label: "Touch time (hours)",          category: "time",       source: "inferred", unit: "hours",    description: "Active human effort per loan",                          dependencies: ["sme_lead_time_days", "fte_underwriter_hourly_rate"], formula: "lead_time_days × 8 × 0.18" },
    { key: "underwriting_decision_days",    label: "Underwriting decision time",  category: "time",       source: "direct",   unit: "days",     description: "Days from full doc receipt to credit decision",         computation: "avg(decision_event_ts - last_doc_event_ts)",                                                                                  goodThreshold: 3,  poorThreshold: 10, direction: "lower_is_better" },
    { key: "monthly_sme_volume",            label: "Loans funded / month",        category: "volume",     source: "direct",   unit: "count",    description: "Loans disbursed per month",                              computation: "count(distinct case_id where disbursed) by month",                                                                            required: true },
    { key: "sme_application_volume",        label: "Applications / month",        category: "volume",     source: "direct",   unit: "count",    description: "All applications received per month",                    computation: "count(distinct case_id) by month" },
    { key: "sme_stp_rate",                  label: "STP rate (%)",                category: "quality",    source: "direct",   unit: "%",         description: "% of cases on the auto-decision happy path",            computation: "count(auto-decisioned cases) / total × 100",                                                                                  goodThreshold: 45, poorThreshold: 20, direction: "higher_is_better" },
    { key: "sme_doc_rework_rate",           label: "Document rework rate (%)",    category: "quality",    source: "direct",   unit: "%",         description: "Cases where documents were re-requested",               computation: "count(cases with doc loop) / total × 100",                                                                                    goodThreshold: 12, poorThreshold: 30, direction: "lower_is_better" },
    { key: "first_time_right_rate",         label: "First-time-right rate (%)",   category: "quality",    source: "direct",   unit: "%",         description: "Cases that completed without ANY rework loop",          computation: "count(no-rework cases) / total × 100" },
    { key: "sme_approval_rate",             label: "Approval rate (%)",           category: "outcome",    source: "direct",   unit: "%",         description: "% of applications approved",                            computation: "count(approved cases) / total × 100" },
    { key: "sme_decline_rate",              label: "Decline rate (%)",            category: "outcome",    source: "direct",   unit: "%",         description: "% of applications declined",                            computation: "count(declined cases) / total × 100",                                                                                          goodThreshold: 15, poorThreshold: 35, direction: "lower_is_better" },
    { key: "sme_withdrawal_rate",           label: "Withdrawal rate (%)",         category: "outcome",    source: "direct",   unit: "%",         description: "% of applications withdrawn by borrower",                computation: "count(withdrawn cases) / total × 100" },
    { key: "default_rate_funded",           label: "12-mo default rate (%)",       category: "outcome",    source: "assumed",  unit: "%",         description: "12-month post-funding default rate",                    defaultValue: 3.8, sourceHint: "Internal portfolio default report" },
    { key: "cost_per_sme_loan",             label: "Cost per loan",                category: "cost",       source: "inferred", unit: "USD/case", description: "Loaded cost per funded loan",                            dependencies: ["sme_touch_time_hr", "fte_underwriter_hourly_rate"], formula: "touch_time_hr × blended_underwriter_rate",                                                            required: true },
    { key: "annual_sme_ops_cost",           label: "Annual ops cost",              category: "cost",       source: "inferred", unit: "USD/year", description: "Annual operational cost of SME originations",            dependencies: ["cost_per_sme_loan", "monthly_sme_volume"], formula: "cost_per_loan × monthly_volume × 12" },
    { key: "sme_touchpoints_per_case",      label: "Customer touchpoints",         category: "cx",         source: "direct",   unit: "count",    description: "Avg client interactions per loan",                       computation: "avg(events with customer-side actor) per case" },
    { key: "sme_abandonment_step",          label: "Abandonment hotspot",          category: "cx",         source: "direct",   unit: "label",    description: "Step where most abandonments occur",                      computation: "mode(last activity for abandoned cases)" },
    { key: "underwriter_handle_time",       label: "Underwriter handle time",      category: "workforce",  source: "direct",   unit: "hours",    description: "Avg active underwriter time per loan",                   computation: "sum(durations on underwriter events) / cases" },
    { key: "processor_to_underwriter_ratio", label: "Processor:Underwriter ratio", category: "workforce", source: "assumed",  unit: "ratio",    description: "Operating ratio of processors to underwriters",          defaultValue: 2.5, sourceHint: "Industry SME-lending benchmarks" },
    { key: "gate_failure_rate_sme",         label: "Gate failure rate (%)",         category: "compliance", source: "direct",   unit: "%",         description: "% of cases with at least one control-gate failure",      computation: "count(cases with failed gate) / total × 100",                                                                                  goodThreshold: 8, poorThreshold: 20, direction: "lower_is_better" },
    { key: "ucc_filing_completeness",       label: "UCC filing completeness (%)",   category: "compliance", source: "assumed",  unit: "%",         description: "% of secured loans with UCC-1 filed timely",             defaultValue: 96, sourceHint: "Compliance audit report" },
  ],
  deviationPatterns: [
    {
      patternKey: "skip_collateral_sme_loan_origination",
      type: "skip" as const,
      stepKeyword: "(collateral|appraisal|ucc)",
      reasons: [
        { category: "legitimate" as const, severity: "low" as const,   title: "Unsecured loan (no collateral required)", description: "Loan structured as unsecured — typically smaller amounts to strong-credit borrowers.",                  investigationHint: "Check loan type field. If unsecured, no collateral assessment is correct.",                                                                                  valueModel: "No leak. Document as approved variant." },
        { category: "operational" as const, severity: "high" as const,   title: "UCC filing skipped post-funding",          description: "Loan disbursed but UCC-1 never filed. Bank's secured position not perfected — risk of subordination if borrower files for bankruptcy.", investigationHint: "Filter funded cases. If no UCC event after disbursement, perfection failure.",                                                                                valueModel: "Secured-position loss × volume. Per case: full loan exposure (avg USD 175k) at risk.", apaAgent: "UCC Filing Watchdog Agent" },
        { category: "compliance" as const, severity: "medium" as const,  title: "Appraisal skipped for amounts below threshold", description: "OCC permits desktop / evaluation appraisals for loans below USD 500k.",                                                              investigationHint: "Check loan amount. Below threshold + no formal appraisal = compliant variant.",                                                                                valueModel: "No leak if within OCC threshold." },
      ],
    },
    {
      patternKey: "loop_documentation_sme_loan_origination",
      type: "loop" as const,
      stepKeyword: "(document|capture|submit)",
      reasons: [
        { category: "operational" as const, severity: "medium" as const, title: "Tax returns / financials re-requested",   description: "Initial submission missing schedules, latest year, or specific line items — processor asks borrower again.",          investigationHint: "Look at the second-event document_type. Common gaps: K-1s, depreciation schedules, AR aging.",                                                                                              valueModel: "Cycle-time impact: 7-15 day delay × volume. Borrower abandonment uplift: 12-18% per loop.", apaAgent: "Document Sufficiency Pre-check Agent" },
        { category: "operational" as const, severity: "medium" as const, title: "Personal financial statements re-requested for guarantors", description: "Guarantors omitted personal financial statements or signed an outdated version.",                                                                                          investigationHint: "Count of distinct guarantors vs PFS events.",                                                                                                                                                valueModel: "FTE rework cost × volume." },
      ],
    },
    {
      patternKey: "loop_credit_sme_loan_origination",
      type: "loop" as const,
      stepKeyword: "(credit|underwrit)",
      reasons: [
        { category: "operational" as const, severity: "medium" as const, title: "DSCR contested by RM",                             description: "RM pushes back on underwriter's DSCR calculation — typically adds-back arguments for owner compensation or one-time items.", investigationHint: "Look at the looped event's actor. RM-initiated = sales-pressure pattern.",                                                                                                                    valueModel: "FTE cost (underwriter + senior) × dispute count + risk if approved despite weak DSCR." },
        { category: "data_quality" as const, severity: "low" as const,    title: "Re-pull of credit reports for stale data",          description: "Initial credit pull >90 days old at decision; must re-pull per policy.",                                                                                          investigationHint: "Check time between first credit-pull event and decision. >90 days = stale.",                                                                                                                  valueModel: "Operational cost only — USD 25-50 per re-pull × volume." },
      ],
    },
    {
      patternKey: "out_of_order_disbursement_sme_loan_origination",
      type: "out_of_order" as const,
      stepKeyword: "(disburse|fund|payout)",
      reasons: [
        { category: "compliance" as const, severity: "critical" as const, title: "Disbursement before closing-review complete", description: "Funds wired before closing checklist clears — stipulations may be unsatisfied (insurance not bound, UCC not filed, etc.).", investigationHint: "Find cases where 'Disburse Loan Funds' timestamp predates 'Closing Review' completion event.",                                                                              valueModel: "Per case: full loan exposure at risk if stipulation gap leads to default. USD 50-200k recovery cost per incident." },
        { category: "operational" as const, severity: "high" as const,     title: "Funds rushed for client deadline",                description: "Closer / RM pushed funds out before all docs returned to hit a borrower's payroll / acquisition deadline.",                                                                       investigationHint: "Check time delta between last doc event and disbursement. Sub-1-day = rushed.",                                                                                              valueModel: "Operational risk + reputational risk if loan goes bad and process gap is found." },
      ],
    },
    {
      patternKey: "extra_step_manual_review_sme_loan_origination",
      type: "extra_step" as const,
      stepKeyword: "(manual.?review|escalat|override|exception)",
      reasons: [
        { category: "operational" as const, severity: "medium" as const, title: "Borderline auto-decision sent to manual underwriter", description: "Loans just below auto-decision threshold (USD 95-99k) often get sent for sanity check despite passing rules.", investigationHint: "Cluster manual reviews by loan amount. Heavy clustering just below threshold = policy needs adjustment.",                                                                                                                                                                             valueModel: "Manual review cost: USD 110/hr × 1 hr = USD 110 per case avoidable.", apaAgent: "Decision-Engine Threshold Tuning Agent" },
        { category: "compliance" as const, severity: "high" as const, title: "Compliance escalation (sanctions hit, PEP-linked owner)", description: "Mandatory escalation to BSA officer.",                                                                       investigationHint: "Should never be reduced — these are audit-critical.",                                                                                                                                                                                                                                          valueModel: "Cost is compliance overhead, not reducible." },
        { category: "operational" as const, severity: "high" as const, title: "RM-requested exception for strategic client",            description: "RM requests override to approve a borderline case for a high-value or strategic SME relationship.",                                                                                                                              investigationHint: "Cluster by RM. Concentrated exceptions = RM-led portfolio risk.",                                                                                                                                                                                                                              valueModel: "Default-uplift risk if pattern is systemic." },
      ],
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// Save a hand-crafted template
// ──────────────────────────────────────────────────────────────────────────

type TemplateData = typeof commercialOnboarding | typeof smeLoanOrigination;

async function saveTemplate(t: TemplateData) {
  const subProcesses = t.steps.map((s) => ({
    key: s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    label: s.label, description: s.description,
  }));

  await prisma.processTemplate.upsert({
    where: { processKey_version: { processKey: t.processKey, version: 1 } },
    create: {
      processKey: t.processKey, version: 1, isActive: true,
      name: t.name, description: t.description,
      lineOfBusiness: t.lineOfBusiness,
      applicableInstTypes: ["bank", "credit_union", "neobank"],
      defaultProcessMap: {} as object,
      subProcesses,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metricDefinitions: t.metricDefinitions as any,
      notes: `Hand-curated seed. ${t.steps.length} steps · ${t.actors.length} actors · ${t.systems.length} systems · ${t.deviationPatterns.length} deviation patterns · ${t.metricDefinitions.length} metrics.`,
    },
    update: {
      isActive: true, name: t.name, lineOfBusiness: t.lineOfBusiness, subProcesses,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metricDefinitions: t.metricDefinitions as any,
    },
  });

  for (const s of t.steps) {
    const existing = await prisma.processStepTemplate.findFirst({ where: { processTemplate: t.processKey, label: s.label } });
    if (!existing) {
      await prisma.processStepTemplate.create({
        data: { label: s.label, processTemplate: t.processKey, order: s.order, description: s.description },
      });
    }
  }
  for (const a of t.actors) {
    const existing = await prisma.processActor.findFirst({ where: { name: a.name } });
    if (!existing) await prisma.processActor.create({ data: { name: a.name, color: a.color, description: a.description, type: a.type } });
  }
  for (const s of t.systems) {
    const existing = await prisma.applicationSystem.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.applicationSystem.create({ data: { name: s.name, color: s.color, description: s.description, processTemplates: s.processTemplates } });
  }

  for (const p of t.deviationPatterns) {
    await prisma.deviationPattern.upsert({
      where: { patternKey: p.patternKey },
      create: {
        patternKey: p.patternKey, type: p.type, stepKeyword: p.stepKeyword,
        processKey: t.processKey, country: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasons: p.reasons as any,
      },
      update: {
        type: p.type, stepKeyword: p.stepKeyword, processKey: t.processKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasons: p.reasons as any,
      },
    });
  }

  console.log(`✓ ${t.processKey} (active) — ${t.steps.length} steps · ${t.actors.length} actors · ${t.systems.length} systems · ${t.deviationPatterns.length} deviation patterns · ${t.metricDefinitions.length} metrics`);
}

async function deleteDuplicateRetailAccountOpening() {
  const ref = await prisma.engagementProcess.findMany({ where: { processKey: "retail_account_opening" }, select: { id: true, processName: true } });
  if (ref.length > 0) {
    console.log(`⚠  ${ref.length} engagementProcess row(s) still reference 'retail_account_opening' — keeping the template so they don't break.`);
    for (const e of ref) console.log(`     - ${e.processName} (${e.id})`);
    return;
  }
  const deleted = await prisma.processTemplate.deleteMany({ where: { processKey: "retail_account_opening" } });
  console.log(`✓ Deleted ${deleted.count} duplicate retail_account_opening template row(s)`);
}

async function activateForUSA(processKey: string) {
  await prisma.countryProcessActivation.upsert({
    where: { country_processKey: { country: COUNTRY_US, processKey } },
    create: { country: COUNTRY_US, processKey, basedOnTemplateVersion: 1, isActive: true, notes: "Activated for USA demo (seeded via script)." },
    update: { isActive: true, basedOnTemplateVersion: 1 },
  });
  console.log(`✓ CountryProcessActivation: ${COUNTRY_US} / ${processKey} (active)`);
}

// ──────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Step 1 — Delete duplicate retail_account_opening template");
  await deleteDuplicateRetailAccountOpening();

  console.log("\nStep 2 — Seed USA value coefficients");
  await seedUsaCoefficients();

  console.log("\nStep 3 — Seed Commercial Account Onboarding template");
  await saveTemplate(commercialOnboarding);

  console.log("\nStep 4 — Seed SME Loan Origination template");
  await saveTemplate(smeLoanOrigination);

  console.log("\nStep 5 — Activate all for United States");
  await activateForUSA("commercial_onboarding");
  await activateForUSA("sme_loan_origination");
  await activateForUSA("retail_onboarding");
  await activateForUSA("home_mortgage");

  await prisma.$disconnect();
  console.log("\nDone. New engagements with country=United States will see:");
  console.log("  - Retail Account Onboarding");
  console.log("  - Home Mortgage");
  console.log("  - Commercial Account Onboarding");
  console.log("  - SME Loan Origination");
}

main().catch((e) => { console.error(e); process.exit(1); });
