/**
 * Fix the home_mortgage template — it was saved with swapped processKey/name
 * fields (processKey="Home Mortgage", name="home_mortgage"). Also fills in the
 * missing description, deviation patterns, and metric definitions.
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/fix-home-mortgage.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { prisma } from "@/lib/db";

const COUNTRY_US = "United States";

// ──────────────────────────────────────────────────────────────────────────
// Hand-crafted Home Mortgage seed — US retail mortgage origination
// ──────────────────────────────────────────────────────────────────────────

const homeMortgage = {
  processKey: "home_mortgage",
  name: "Home Mortgage",
  description: "End-to-end retail mortgage origination: application capture, income/employment/asset verification, credit + risk assessment, property appraisal, underwriting decision, document collection, regulatory disclosures (TRID), closing, and funding. Calibrated for US retail banking under CFPB / TILA-RESPA / HMDA requirements.",
  lineOfBusiness: "retail",
  subProcesses: [
    { key: "submit_mortgage_application",   label: "Submit Mortgage Application",     description: "Borrower completes 1003 application via portal / RM / branch" },
    { key: "send_loan_estimate",             label: "Send Loan Estimate (TRID)",       description: "Provide initial Loan Estimate within 3 business days (TILA-RESPA)" },
    { key: "income_employment_verification", label: "Verify Income & Employment",      description: "Pay stubs, W-2s, tax returns; employer verification" },
    { key: "asset_verification",             label: "Verify Assets",                   description: "Bank statements, retirement accounts, source of down payment" },
    { key: "credit_check",                   label: "Pull Credit Report",              description: "Tri-merge credit pull (Experian, Equifax, TransUnion); FICO score" },
    { key: "property_appraisal",             label: "Order Property Appraisal",        description: "Independent appraisal of property value (AMC-mediated for compliance)" },
    { key: "title_search",                   label: "Conduct Title Search",            description: "Title insurance company verifies clear title and existing liens" },
    { key: "underwriting_review",            label: "Underwriting Review",             description: "DTI, LTV, reserves, credit history — auto + manual underwriting" },
    { key: "underwriting_decision",          label: "Issue Underwriting Decision",     description: "Approve / approve-with-conditions / counter / decline" },
    { key: "clear_to_close",                 label: "Clear to Close",                  description: "All stipulations cleared, insurance bound, final review" },
    { key: "send_closing_disclosure",        label: "Send Closing Disclosure (TRID)",   description: "Final Closing Disclosure 3 business days before closing" },
    { key: "closing_and_signing",            label: "Conduct Closing & Signing",        description: "Borrower signs all documents (in-person or e-close)" },
    { key: "funding_and_recording",          label: "Fund & Record",                   description: "Funds wired to escrow; deed recorded with county" },
    { key: "post_close_servicing_setup",     label: "Set Up Loan Servicing",           description: "Loan booked in core; payment schedule, escrow, MERS registration" },
  ],
  actors: [
    { name: "Mortgage Borrower",       color: "#3366FF", description: "Applicant / co-applicant on the loan",                             type: "customer" },
    { name: "Mortgage Loan Officer",   color: "#26BC71", description: "Originating MLO; primary borrower contact (NMLS-licensed)",        type: "front-office" },
    { name: "Loan Processor",          color: "#FFAC09", description: "Collects docs, tracks conditions, prepares file for UW",          type: "back-office" },
    { name: "Mortgage Underwriter",    color: "#06B6D4", description: "Reviews and decisions the loan",                                  type: "back-office" },
    { name: "Property Appraiser",      color: "#FFAC09", description: "External — appraises property value (via AMC)",                   type: "external" },
    { name: "Title Company",           color: "#8B2BE2", description: "External — title search, title insurance, closing agent",          type: "external" },
    { name: "Mortgage Closer",         color: "#26BC71", description: "Prepares closing docs and coordinates funding",                  type: "operations" },
    { name: "Compliance Officer",      color: "#EF4444", description: "Reviews TRID, fair-lending, HMDA reporting",                     type: "compliance" },
    { name: "Automated Underwriting",  color: "#64748B", description: "DU (Fannie Mae) / LP (Freddie Mac) automated underwriting",      type: "automated" },
  ],
  systems: [
    { name: "Encompass (ICE Mortgage Tech)",      color: "#3366FF", description: "Industry-leading mortgage LOS — workflow + document mgmt",   processTemplates: ["home_mortgage"] },
    { name: "Fannie Mae Desktop Underwriter",      color: "#06B6D4", description: "Automated underwriting for conforming loans",                processTemplates: ["home_mortgage"] },
    { name: "Freddie Mac Loan Product Advisor",    color: "#06B6D4", description: "Alternate automated underwriting platform",                  processTemplates: ["home_mortgage"] },
    { name: "Experian / Equifax / TransUnion",     color: "#FFAC09", description: "Tri-merge credit bureau",                                    processTemplates: ["home_mortgage"] },
    { name: "AppraisalPort / Mercury",             color: "#8B2BE2", description: "Appraisal Management Company (AMC) network",                processTemplates: ["home_mortgage"] },
    { name: "First American / Fidelity Title",     color: "#FFAC09", description: "Title insurance + closing services",                        processTemplates: ["home_mortgage"] },
    { name: "DocuSign / Notarize",                  color: "#3366FF", description: "E-signature / remote online notarization for closings",     processTemplates: ["home_mortgage"] },
    { name: "MERS",                                  color: "#64748B", description: "Mortgage Electronic Registration System — note holder",    processTemplates: ["home_mortgage"] },
    { name: "FIS IBS / Fiserv LoanServ",             color: "#F97316", description: "Core servicing platform — post-funding",                  processTemplates: ["home_mortgage"] },
  ],
  metricDefinitions: [
    { key: "mortgage_lead_time_days",       label: "Lead time — application to close (days)", category: "time",       source: "direct",   unit: "days",     description: "Calendar days from application to funding",     computation: "avg(case_end - case_start)",                                                                                              goodThreshold: 30, poorThreshold: 60, direction: "lower_is_better", required: true },
    { key: "mortgage_touch_time_hr",        label: "Touch time (hours)",                       category: "time",       source: "inferred", unit: "hours",    description: "Active staff effort per loan",                  dependencies: ["mortgage_lead_time_days", "fte_underwriter_hourly_rate"], formula: "lead_time_days × 8 × 0.18" },
    { key: "underwriting_turn_time_days",   label: "Underwriting turn time",                   category: "time",       source: "direct",   unit: "days",     description: "Days from full docs to underwriting decision",  computation: "avg(decision_event_ts - file_complete_event_ts)",                                                                          goodThreshold: 5,  poorThreshold: 15, direction: "lower_is_better" },
    { key: "clear_to_close_days",            label: "Clear-to-close time",                      category: "time",       source: "direct",   unit: "days",     description: "Days from initial approval to clear-to-close",   computation: "avg(ctc_event_ts - approval_event_ts)",                                                                                     goodThreshold: 7,  poorThreshold: 21, direction: "lower_is_better" },
    { key: "monthly_funding_volume",        label: "Loans funded / month",                    category: "volume",     source: "direct",   unit: "count",    description: "Number of mortgages funded per month",          computation: "count(distinct case_id where funded) by month",                                                                            required: true },
    { key: "application_volume_monthly",    label: "Applications / month",                    category: "volume",     source: "direct",   unit: "count",    description: "All mortgage applications received per month",   computation: "count(distinct case_id) by month" },
    { key: "pull_through_rate",             label: "Pull-through rate (%)",                    category: "quality",    source: "direct",   unit: "%",         description: "% of applications that fund",                    computation: "count(funded cases) / count(submitted cases) × 100",                                                                       goodThreshold: 70, poorThreshold: 45, direction: "higher_is_better", required: true },
    { key: "stp_rate_mortgage",             label: "Auto-decision rate (%)",                  category: "quality",    source: "direct",   unit: "%",         description: "% of loans approved by DU / LP without manual override", computation: "count(auto-approved) / total × 100",                                                                                       goodThreshold: 60, poorThreshold: 30, direction: "higher_is_better" },
    { key: "document_rework_rate_mortgage", label: "Document rework rate (%)",                category: "quality",    source: "direct",   unit: "%",         description: "% of loans where conditions / docs were re-requested", computation: "count(cases with doc loop) / total × 100",                                                                                  goodThreshold: 25, poorThreshold: 50, direction: "lower_is_better" },
    { key: "approval_rate_mortgage",        label: "Approval rate (%)",                        category: "outcome",    source: "direct",   unit: "%",         description: "% of applications approved",                    computation: "count(approved cases) / total × 100" },
    { key: "decline_rate_mortgage",         label: "Decline rate (%)",                         category: "outcome",    source: "direct",   unit: "%",         description: "% of applications declined",                    computation: "count(declined cases) / total × 100",                                                                                       goodThreshold: 12, poorThreshold: 25, direction: "lower_is_better" },
    { key: "withdrawal_rate_mortgage",      label: "Withdrawal rate (%)",                      category: "outcome",    source: "direct",   unit: "%",         description: "% withdrawn by borrower (rate-shopping, life event)", computation: "count(withdrawn cases) / total × 100",                                                                                     goodThreshold: 8,  poorThreshold: 20, direction: "lower_is_better" },
    { key: "cost_per_loan_mortgage",        label: "Cost per loan",                            category: "cost",       source: "inferred", unit: "USD/case", description: "Loaded cost per funded mortgage",                dependencies: ["mortgage_touch_time_hr", "fte_underwriter_hourly_rate"], formula: "touch_time_hr × blended_rate",                                                                              required: true },
    { key: "annual_mortgage_ops_cost",      label: "Annual ops cost",                          category: "cost",       source: "inferred", unit: "USD/year", description: "Annual operational cost of mortgage originations", dependencies: ["cost_per_loan_mortgage", "monthly_funding_volume"], formula: "cost_per_loan × monthly_volume × 12" },
    { key: "touchpoints_per_case_mortgage", label: "Customer touchpoints",                     category: "cx",         source: "direct",   unit: "count",    description: "Avg borrower interactions per loan",            computation: "avg(events with customer-side actor) per case" },
    { key: "abandonment_step_mortgage",     label: "Abandonment hotspot",                      category: "cx",         source: "direct",   unit: "label",    description: "Step where most withdrawals occur",              computation: "mode(last activity for withdrawn cases)" },
    { key: "mlo_capacity_per_year",         label: "MLO capacity (loans)",                     category: "workforce",  source: "assumed",  unit: "count",    description: "Loans an MLO can originate per year",            defaultValue: 80, sourceHint: "MBA / industry productivity benchmarks" },
    { key: "underwriter_throughput",        label: "Underwriter throughput (loans/day)",       category: "workforce",  source: "assumed",  unit: "count",    description: "Average loans an underwriter clears per day",   defaultValue: 4,  sourceHint: "Industry mortgage operations benchmarks" },
    { key: "trid_compliance_rate",          label: "TRID compliance rate (%)",                category: "compliance", source: "assumed",  unit: "%",         description: "% of loans meeting TRID timing requirements",   defaultValue: 99.2, sourceHint: "Internal compliance audit" },
    { key: "hmda_data_completeness",        label: "HMDA data completeness (%)",              category: "compliance", source: "assumed",  unit: "%",         description: "% of HMDA-LAR fields completed accurately",     defaultValue: 97.5, sourceHint: "HMDA data quality audit" },
    { key: "audit_flagged_rate_mortgage",   label: "Audit-flagged rate (%)",                  category: "compliance", source: "direct",   unit: "%",         description: "% of loans flagged by QC / audit",              computation: "count(cases with audit flag) / total × 100" },
  ],
  deviationPatterns: [
    {
      patternKey: "skip_appraisal_home_mortgage",
      type: "skip" as const,
      stepKeyword: "(appraisal|valuation)",
      reasons: [
        { category: "legitimate" as const, severity: "low" as const,    title: "Property Inspection Waiver granted by AUS",         description: "Fannie Mae's PIW or Freddie Mac's ACE waiver eliminated appraisal requirement — high-LTV cushion, sufficient data.", investigationHint: "Check whether AUS recommendation = PIW/ACE. If yes, no appraisal is correct.", valueModel: "No leak. Approved process variant." },
        { category: "compliance" as const, severity: "high" as const,   title: "Appraisal skipped on non-eligible loan",            description: "Loan didn't qualify for PIW but appraisal was still skipped. CFPB / OCC compliance issue.",                                                                            investigationHint: "Filter cases by AUS recommendation. If 'Appraisal Required' but no appraisal event, violation.",                                                                                              valueModel: "OCC finding: USD 850/case + remediation cost. Plus collateral valuation risk: full loan exposure." },
        { category: "operational" as const, severity: "high" as const,  title: "Appraisal delay caused workaround",                  description: "AMC bottleneck — MLO / processor pushed file through without appraisal to hit lock-extension deadline.",                                                                            investigationHint: "Cluster by time. Delays at month-end often correlate with this pattern.",                                                                                                                       valueModel: "Compliance risk + appraisal-bypass remediation: USD 5-15k per case if found by audit." },
      ],
    },
    {
      patternKey: "loop_documentation_home_mortgage",
      type: "loop" as const,
      stepKeyword: "(document|income|asset|verification)",
      reasons: [
        { category: "operational" as const, severity: "medium" as const, title: "Self-employed borrower income docs incomplete", description: "Self-employed borrowers — initial submission missing schedules (Schedule C/K-1), latest year, or P&L statements.",                                              investigationHint: "Filter by employment type. Self-employed clustering = needs upfront checklist improvement.",                                                                                                                                       valueModel: "Cycle-time impact: 10-21 day delay × volume. Borrower abandonment uplift: 15-22% on each loop.", apaAgent: "Document Sufficiency Pre-check Agent" },
        { category: "operational" as const, severity: "medium" as const, title: "Updated paystubs required (>30 days old at decision)", description: "Initial paystubs are stale by the time underwriting reviews — processor asks for fresh ones.",                                                                                                                       investigationHint: "Time between first paystub event and decision. >30 days = stale.",                                                                                                                                                                  valueModel: "Operational rework cost × volume.", apaAgent: "Document Freshness Watchdog Agent" },
        { category: "data_quality" as const, severity: "low" as const,    title: "VOE (Verification of Employment) not returned",      description: "Employer doesn't respond to VOE request; processor follows up multiple times.",                                                                                          investigationHint: "Look at VOE event count per case.",                                                                                                                                                                                                      valueModel: "Cycle-time impact + processor follow-up cost." },
      ],
    },
    {
      patternKey: "loop_underwriting_home_mortgage",
      type: "loop" as const,
      stepKeyword: "(underwrit|condition)",
      reasons: [
        { category: "operational" as const, severity: "medium" as const, title: "Conditions added during underwriting review",   description: "Underwriter adds stipulations (PUD homeowner association docs, gift letter, etc.) — file returns to processor for resolution.", investigationHint: "Look at condition count per case. >5 conditions = upfront file quality issue.",                                                                                                                                                       valueModel: "Cycle-time delay × volume + abandonment on slow files." },
        { category: "compliance" as const, severity: "high" as const,    title: "Disclosure timing failure (TRID re-disclosure)", description: "A material change triggered TRID re-disclosure — restarted 3-business-day waiting period, delayed closing.",                                                                              investigationHint: "Look for 're-disclosure' events or fee changes between LE and CD.",                                                                                                                                                                       valueModel: "Borrower frustration + compliance review cost. Per case: USD 850 OCC remediation if widespread." },
      ],
    },
    {
      patternKey: "out_of_order_funding_home_mortgage",
      type: "out_of_order" as const,
      stepKeyword: "(fund|wire|close|disburse)",
      reasons: [
        { category: "compliance" as const, severity: "critical" as const, title: "Funding before TRID 3-day waiting period", description: "Closing Disclosure must be delivered 3 business days BEFORE consummation per TILA-RESPA. Funding before this is a clear violation.",                                            investigationHint: "Compute time between CD-delivered event and funding event. <3 business days = TRID violation.",                                                                                                                                                                              valueModel: "CFPB civil money penalty: USD 5-50k per violation. Plus right of rescission risk if borrower discovers." },
        { category: "compliance" as const, severity: "high" as const,    title: "Funding before recording confirmed",        description: "Funds wired before deed recorded with county — risk of priority issues if intervening liens are filed.",                                                                              investigationHint: "Compare funding timestamp with recording confirmation timestamp.",                                                                                                                                                                                                                          valueModel: "Priority-risk losses if intervening lien is filed — potentially full loan exposure." },
      ],
    },
    {
      patternKey: "extra_step_manual_underwriting_home_mortgage",
      type: "extra_step" as const,
      stepKeyword: "(manual.?underwrit|exception|override|second.?look)",
      reasons: [
        { category: "operational" as const, severity: "medium" as const, title: "Borderline DTI sent to manual review",                       description: "Auto-underwriting refers loans with DTI in the 43-50% band for manual review per QM rules.",                                                                              investigationHint: "Cluster by DTI band. Heavy clustering at the threshold = policy / threshold tuning opportunity.",                                                                                                                                                                                                     valueModel: "Manual review cost: USD 110/hr × 1.5 hr = USD 165 per case.", apaAgent: "Decision-Engine Threshold Tuning Agent" },
        { category: "compliance" as const, severity: "high" as const,    title: "Fair-lending second look (ECOA)",                            description: "Mandatory fair-lending review for declined applications under ECOA / Regulation B.",                                                                                                                                                              investigationHint: "Should never be reduced — these are audit-critical.",                                                                                                                                                                                                                                                                 valueModel: "Cost is compliance overhead." },
        { category: "operational" as const, severity: "high" as const,   title: "MLO exception request to keep file alive",                    description: "MLO requests exception to underwriting findings to preserve the file — common at rate-lock expiration.",                                                                                                                          investigationHint: "Cluster exceptions by MLO. Concentrated requests = sales-pressure / quality issue.",                                                                                                                                                                                                                                  valueModel: "Concentration audit cost + portfolio risk if exceptions correlate with later default." },
      ],
    },
  ],
};

async function main() {
  console.log("Step 1 — Move legacy step rows from 'Home Mortgage' → 'home_mortgage'");
  const moved = await prisma.processStepTemplate.updateMany({
    where: { processTemplate: "Home Mortgage" },
    data: { processTemplate: "home_mortgage" },
  });
  console.log(`  ✓ Moved ${moved.count} step rows`);

  console.log("\nStep 2 — Delete the broken 'Home Mortgage' template row");
  const deleted = await prisma.processTemplate.deleteMany({ where: { processKey: "Home Mortgage" } });
  console.log(`  ✓ Deleted ${deleted.count} broken template`);

  console.log("\nStep 3 — Upsert proper home_mortgage template");
  await prisma.processTemplate.upsert({
    where: { processKey_version: { processKey: homeMortgage.processKey, version: 1 } },
    create: {
      processKey: homeMortgage.processKey, version: 1, isActive: true,
      name: homeMortgage.name, description: homeMortgage.description,
      lineOfBusiness: homeMortgage.lineOfBusiness,
      applicableInstTypes: ["bank", "credit_union", "neobank"],
      defaultProcessMap: {} as object,
      subProcesses: homeMortgage.subProcesses,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metricDefinitions: homeMortgage.metricDefinitions as any,
      notes: `Hand-curated seed. ${homeMortgage.subProcesses.length} steps · ${homeMortgage.actors.length} actors · ${homeMortgage.systems.length} systems · ${homeMortgage.deviationPatterns.length} deviation patterns · ${homeMortgage.metricDefinitions.length} metrics.`,
    },
    update: {
      isActive: true, name: homeMortgage.name, description: homeMortgage.description,
      lineOfBusiness: homeMortgage.lineOfBusiness,
      subProcesses: homeMortgage.subProcesses,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metricDefinitions: homeMortgage.metricDefinitions as any,
    },
  });
  console.log(`  ✓ Template upserted`);

  console.log("\nStep 4 — Seed actors, systems, deviation patterns");
  for (const a of homeMortgage.actors) {
    const existing = await prisma.processActor.findFirst({ where: { name: a.name } });
    if (!existing) await prisma.processActor.create({ data: { name: a.name, color: a.color, description: a.description, type: a.type } });
  }
  for (const s of homeMortgage.systems) {
    const existing = await prisma.applicationSystem.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.applicationSystem.create({ data: { name: s.name, color: s.color, description: s.description, processTemplates: s.processTemplates } });
  }
  for (const p of homeMortgage.deviationPatterns) {
    await prisma.deviationPattern.upsert({
      where: { patternKey: p.patternKey },
      create: {
        patternKey: p.patternKey, type: p.type, stepKeyword: p.stepKeyword,
        processKey: homeMortgage.processKey, country: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasons: p.reasons as any,
      },
      update: {
        type: p.type, stepKeyword: p.stepKeyword, processKey: homeMortgage.processKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasons: p.reasons as any,
      },
    });
  }
  console.log(`  ✓ Actors: ${homeMortgage.actors.length} ensured · Systems: ${homeMortgage.systems.length} ensured · Deviation patterns: ${homeMortgage.deviationPatterns.length} upserted`);

  console.log("\nStep 5 — Re-activate home_mortgage for United States");
  await prisma.countryProcessActivation.upsert({
    where: { country_processKey: { country: COUNTRY_US, processKey: "home_mortgage" } },
    create: { country: COUNTRY_US, processKey: "home_mortgage", basedOnTemplateVersion: 1, isActive: true, notes: "USA demo activation." },
    update: { isActive: true, basedOnTemplateVersion: 1 },
  });
  console.log("  ✓ Activated for United States");

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
