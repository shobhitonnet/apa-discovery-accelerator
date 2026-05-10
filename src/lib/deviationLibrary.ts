/**
 * Banking deviation-reason library.
 *
 * When a process graph reveals a deviation (skipped step, looped activity,
 * out-of-order events, an extra step), this library returns a ranked list of
 * candidate reasons — categorised as legitimate / operational / compliance /
 * data-quality, each with a severity, an investigation hint, a value-model
 * stub for quantification, and (where applicable) a recommended APA agent.
 *
 * Used by Stage 5 (Findings): Claude takes the actual deviation data + this
 * library + the engagement's process metrics, and produces a ranked findings
 * report tailored to the bank.
 *
 * No AI — pure data lookup.
 */

export type DeviationCategory = "legitimate" | "operational" | "compliance" | "data_quality";
export type DeviationSeverity = "low" | "medium" | "high" | "critical";
export type DeviationType = "skip" | "loop" | "out_of_order" | "extra_step";

export type DeviationReason = {
  category: DeviationCategory;
  severity: DeviationSeverity;
  title: string;
  description: string;
  investigationHint: string; // what to look at in the data to confirm/deny
  valueModel: string;        // how a consultant should quantify the impact
  apaAgent?: string;         // recommended APA agent if this maps to one
};

export type DeviationPattern = {
  id: string;
  type: DeviationType;
  // Matches against the activity / step name (case-insensitive)
  stepKeyword: RegExp;
  reasons: DeviationReason[];
};

// ──────────────────────────────────────────────────────────────────────────
// Library — banking-specific deviation patterns + their candidate reasons
// ──────────────────────────────────────────────────────────────────────────

export const DEVIATION_LIBRARY: DeviationPattern[] = [

  // ── SKIPS ──────────────────────────────────────────────────────────────
  {
    id: "skip_kyc",
    type: "skip",
    stepKeyword: /(kyc|identity|aml|customer\s*due\s*dilig|sanctions)/i,
    reasons: [
      {
        category: "compliance",
        severity: "critical",
        title: "KYC bypass — AML regulatory breach",
        description: "Cases progressed without completing KYC / sanctions screening. Direct violation of Money Laundering Regulations (UK) / 6AMLD (EU) / BSA (US). Per-case fines start at £500k for individuals, £5M+ for institutions.",
        investigationHint: "Check the customer segment and product. If commercial / high-value account, this is a Tier-1 AML breach. If private banking, check whether enhanced due diligence (EDD) was deferred to relationship manager — sometimes legitimate but rarely well-documented.",
        valueModel: "Regulatory exposure × case count. UK FCA 2024 KYC enforcement avg: £18k per case in fines + £45k per case remediation cost.",
        apaAgent: "AML / KYC Verification Agent",
      },
      {
        category: "legitimate",
        severity: "low",
        title: "Re-onboarding existing customer (within 12 months)",
        description: "Existing customers re-applying for an additional product can have KYC carried over from prior verification per most banking policies (90-day to 12-month window).",
        investigationHint: "Look at customer_id history — was there a prior KYC event for this customer within the last 12 months? If yes, this is a sanctioned shortcut, not a breach.",
        valueModel: "If legitimate, this is process efficiency, not a leak. Document as approved variant. Avoided KYC effort: ~30 mins per case × volume.",
      },
      {
        category: "operational",
        severity: "high",
        title: "KYC system outage — manual workaround",
        description: "Front-line staff bypassed digital KYC due to system unavailability and approved manually. Often documented in side-spreadsheets, not in the LOS / core banking system.",
        investigationHint: "Cluster cases by date. Look for spikes — KYC skips concentrated in a 2-day window suggests an outage, not policy.",
        valueModel: "Risk exposure: cases × probability of unverified customer × avg fraud loss per unverified customer (~£2.4k UK retail).",
        apaAgent: "KYC Resilience Agent",
      },
      {
        category: "operational",
        severity: "medium",
        title: "Branch-staff override / SLA pressure",
        description: "Branch CSRs bypass KYC at month-end / campaign deadlines to hit acquisition targets. Common pattern in retail banking despite policy.",
        investigationHint: "Check if skips concentrate in last week of month / specific branches / specific staff IDs.",
        valueModel: "Compliance risk × volume + cultural cost (signals weak controls).",
      },
    ],
  },

  {
    id: "skip_credit_check",
    type: "skip",
    stepKeyword: /(credit|bureau|affordability|score)/i,
    reasons: [
      {
        category: "legitimate",
        severity: "low",
        title: "No-credit product (savings, basic current account)",
        description: "Products without credit exposure (savings, basic accounts, prepaid cards) don't require credit assessment. The skip is correct policy.",
        investigationHint: "Check product_type / product_code on the case. If savings/current/basic, no action needed.",
        valueModel: "No leak. Document as approved variant.",
      },
      {
        category: "operational",
        severity: "high",
        title: "Bureau API outage — manual or no check",
        description: "Credit bureau API (Experian / Equifax / TransUnion) was unavailable; cases approved without credit data, often with conservative manual underwriting or no underwriting.",
        investigationHint: "Time-cluster the skipped cases. If concentrated, check vendor SLA records for outage windows.",
        valueModel: "Cases × default rate uplift for un-screened customers. UK retail unsecured: ~3.2% default vs ~1.4% screened. Loss per default: 60-80% of exposure.",
        apaAgent: "Credit Bureau Resilience Agent",
      },
      {
        category: "compliance",
        severity: "high",
        title: "Affordability assessment skipped — Consumer Duty breach",
        description: "FCA Consumer Duty (UK 2023) requires evidenced affordability for any credit product. Skipping this exposes the bank to retrospective complaints + s140 unfair-relationship claims.",
        investigationHint: "Filter cases with credit-bearing products + skip → these are Consumer Duty exceptions. Each is a complaint risk.",
        valueModel: "Complaint provision: ~£800-£3.2k per case. Plus FOS (Financial Ombudsman) case fee £750.",
      },
      {
        category: "legitimate",
        severity: "low",
        title: "Pre-approved channel (employer payroll, partner)",
        description: "Some channels carry pre-vetted customers (employer payroll deals, white-label partners). Credit was assessed upstream.",
        investigationHint: "Check the channel attribute. Filter by partner / employer. If consistent, document as approved.",
        valueModel: "No leak. Variant analysis should call this out.",
      },
    ],
  },

  {
    id: "skip_fraud_screening",
    type: "skip",
    stepKeyword: /(fraud|risk\s*screen)/i,
    reasons: [
      {
        category: "compliance",
        severity: "critical",
        title: "Fraud control bypass — direct loss exposure",
        description: "Fraud screening (CIFAS / Synectics / National Fraud Database) skipped. UK CIFAS membership bylaws require all account openings be screened — non-compliance can void bank's fraud insurance.",
        investigationHint: "All cases not screened are fraud-exposure. Check for known-fraud customers in the skipped set.",
        valueModel: "Cases × P(fraud) × avg loss. UK retail account opening fraud rate ~0.4%, avg loss £4.8k per fraudulent account.",
        apaAgent: "Fraud Screening Agent",
      },
      {
        category: "operational",
        severity: "medium",
        title: "Low-amount fast-track exemption",
        description: "Some banks have policy-authorised fast-tracks for sub-£50 prepaid cards / basic accounts. Fraud risk minimal, control deferred to monitoring.",
        investigationHint: "Check product limits. If sub-threshold, document as variant. If above threshold, escalate.",
        valueModel: "If within policy, no leak. If outside policy, treat as critical exposure.",
      },
      {
        category: "operational",
        severity: "medium",
        title: "System integration gap",
        description: "Process model includes fraud screening but front-end system never enforces it — workflow gap, not staff error.",
        investigationHint: "Check whether ANY case in the period had a fraud event. If consistently 0%, the integration is broken — not a behavioural issue.",
        valueModel: "Implementation cost to fix: typically £80-150k for an existing LOS integration.",
        apaAgent: "Fraud Screening Agent",
      },
    ],
  },

  {
    id: "skip_document_collection",
    type: "skip",
    stepKeyword: /(document|docs)\s*(coll|gather|upload|provid)/i,
    reasons: [
      {
        category: "legitimate",
        severity: "low",
        title: "Documents already on file (existing customer)",
        description: "Re-applying customers may have valid passport/utility-bill on file from prior application. Reuse is policy-permitted.",
        investigationHint: "Look up customer_id history. Verify document expiry > application date.",
        valueModel: "No leak. Approved efficiency.",
      },
      {
        category: "compliance",
        severity: "high",
        title: "EDD documents skipped for high-risk segment",
        description: "Enhanced Due Diligence (EDD) for PEPs / high-risk countries / large transactions requires additional documents (source of funds, beneficial owner). Skipping breaches FATF Recommendation 10.",
        investigationHint: "Filter cases by risk score / sanctions hits / country code. EDD-required cases without doc collection are critical.",
        valueModel: "FCA EDD enforcement: ~£35-90k per case in fines.",
      },
    ],
  },

  // ── LOOPS / REWORK ─────────────────────────────────────────────────────
  {
    id: "loop_kyc",
    type: "loop",
    stepKeyword: /(kyc|identity|aml)/i,
    reasons: [
      {
        category: "operational",
        severity: "medium",
        title: "Customer document quality (blurred photo, expired ID)",
        description: "Most common cause of KYC retries — customer-uploaded photo ID is illegible, cropped, or expired. Drives rework loop in compliance.",
        investigationHint: "Check verification_outcome on the looped events. If 'document_quality_fail', it's customer side. Tells you to invest in client-side validation.",
        valueModel: "Rework cost: cases × 2-4 mins re-verification per attempt × FTE rate (£35/hr UK ops).",
        apaAgent: "Document Quality Pre-validation Agent",
      },
      {
        category: "operational",
        severity: "medium",
        title: "Sanctions/PEP false-positives",
        description: "Initial automated screening flagged a false positive (common name match, etc.); compliance officer cleared after manual review, triggering a second event.",
        investigationHint: "Check if the looped event has a different actor (officer vs system). If yes, false positive review.",
        valueModel: "FTE-hours × case volume. Typical UK bank: 20% of KYC events are false-positive reruns. Per case: ~15 mins compliance review.",
        apaAgent: "Sanctions False-Positive Triage Agent",
      },
      {
        category: "compliance",
        severity: "high",
        title: "Initial verification was insufficient (compliance breach)",
        description: "First KYC pass shouldn't have approved — case was reopened by audit/compliance after the fact. Indicates a control gap.",
        investigationHint: "Look at the time gap between KYC events. >7 days = likely audit-driven reopening.",
        valueModel: "Audit findings × remediation cost (~£12-25k per case). Plus compliance officer cost.",
      },
    ],
  },

  {
    id: "loop_document_collection",
    type: "loop",
    stepKeyword: /(document|docs)/i,
    reasons: [
      {
        category: "operational",
        severity: "medium",
        title: "Underwriter requested additional supporting documents",
        description: "Initial document set was insufficient for the loan/account decision. Common in mortgage/SME lending where income evidence varies.",
        investigationHint: "Check what additional document_type was added on the second event. Pattern reveals what's missing in the upfront ask.",
        valueModel: "Cycle-time impact: 3-7 day delay per re-request × case count. Customer abandonment: 8-14% per re-request loop.",
        apaAgent: "Document Sufficiency Pre-check Agent",
      },
    ],
  },

  // ── OUT-OF-ORDER ───────────────────────────────────────────────────────
  {
    id: "decision_before_checks_complete",
    type: "out_of_order",
    stepKeyword: /(decision|underwrit|approval|verdict)/i,
    reasons: [
      {
        category: "compliance",
        severity: "critical",
        title: "Decision recorded before required checks completed",
        description: "Case shows a decision (approved/declined) timestamped BEFORE Credit/KYC/Fraud events. Either the controls are advisory not enforced, OR there's a workflow bug. Either way, voids the underwriting evidence chain.",
        investigationHint: "Correlate with manual override flags. If consistently same staff/branch, training issue. If random, system bug.",
        valueModel: "Audit risk + retrospective decision-quality reviews. Per case: ~£8-30k remediation if a complaint follows.",
      },
      {
        category: "data_quality",
        severity: "low",
        title: "Timestamp drift between systems",
        description: "Different source systems use different clocks; events recorded within seconds of each other can appear out of order due to clock skew.",
        investigationHint: "Check the time delta. If events are within 30 seconds, likely clock skew. If hours apart, real ordering issue.",
        valueModel: "No business impact, but data-quality cost: 1-2 days engineering to fix clock sync.",
      },
    ],
  },

  {
    id: "account_before_approval",
    type: "out_of_order",
    stepKeyword: /(account.*open|account.*creat|account.*setup)/i,
    reasons: [
      {
        category: "compliance",
        severity: "critical",
        title: "Account opened without final approval",
        description: "Core banking has account creation events timestamped before the underwriting/decision event. Often an integration bug — system-of-record races ahead of the gating decision.",
        investigationHint: "Check if BOTH events have valid timestamps and aren't due to timezone issues. If real, it's a hard control failure.",
        valueModel: "Customer-facing impact (welcomed before approval, then potentially rescinded) + compliance breach + brand damage.",
      },
    ],
  },

  // ── EXTRA STEPS ────────────────────────────────────────────────────────
  {
    id: "extra_manual_review",
    type: "extra_step",
    stepKeyword: /(manual\s*review|escalat|override|exception)/i,
    reasons: [
      {
        category: "operational",
        severity: "medium",
        title: "Borderline credit / risk cases sent to manual review",
        description: "Decision engine couldn't auto-approve — score in grey zone, sent to underwriter for manual call. Normal but expensive when frequent.",
        investigationHint: "Check the rate. <5% of cases = healthy. 15%+ = thresholds need re-tuning.",
        valueModel: "Manual review cost: ~£18-30 per case (15 min underwriter time at £80/hr loaded).",
        apaAgent: "Decision-Engine Threshold Tuning Agent",
      },
      {
        category: "compliance",
        severity: "high",
        title: "Compliance escalation (sanctions hit, PEP, structured payment)",
        description: "Mandatory escalation to MLRO / compliance officer. Required by AML rules.",
        investigationHint: "Should never be reduced — these are audit-critical. Look at handle time and outcome distribution.",
        valueModel: "Cost is part of compliance overhead, not a reducible leak.",
      },
      {
        category: "operational",
        severity: "high",
        title: "Senior-staff override / favour",
        description: "Manager intervened to push through a case that didn't meet automated rules. Sometimes legitimate; sometimes a fraud / collusion red flag.",
        investigationHint: "Cluster overrides by approver. If concentrated on one or two staff, escalate to internal audit.",
        valueModel: "Internal fraud risk + concentration audit cost.",
      },
    ],
  },

];

// ──────────────────────────────────────────────────────────────────────────
// Lookup
// ──────────────────────────────────────────────────────────────────────────

/**
 * Returns candidate reasons for a deviation observed in the process graph.
 * Used by Stage 5 (Findings) to enrich Claude's prompt with banking-specific
 * priors so the generated findings are grounded, not generic.
 *
 * Multiple patterns may match (e.g. "skip" + "kyc" matches one pattern; if the
 * activity also contains "credit", another could match). All matching reasons
 * are returned — Claude / consultant picks the most likely one.
 */
export function getDeviationInsights(opts: {
  type: DeviationType;
  step: string;
}): DeviationReason[] {
  const matches = DEVIATION_LIBRARY.filter((p) =>
    p.type === opts.type && p.stepKeyword.test(opts.step)
  );
  return matches.flatMap((m) => m.reasons);
}

/**
 * Format the library as a Claude-friendly markdown table for prompt injection.
 * Truncates to relevant patterns to keep prompt size manageable.
 */
export function formatLibraryForPrompt(matches: DeviationReason[]): string {
  if (matches.length === 0) return "(no banking-specific patterns matched — apply general process-mining judgment)";
  const lines = matches.map((r, i) =>
    `${i + 1}. [${r.category.toUpperCase()} · ${r.severity}] **${r.title}**
   - Description: ${r.description}
   - How to investigate: ${r.investigationHint}
   - Value model: ${r.valueModel}${r.apaAgent ? `\n   - Recommended APA agent: ${r.apaAgent}` : ""}`
  );
  return lines.join("\n\n");
}
