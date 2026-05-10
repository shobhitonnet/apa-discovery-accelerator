"use client";

import { useState } from "react";

type CapabilityStatus = "digital" | "partial" | "manual" | null;
type IntegrationStatus = "integrated" | "partial_integration" | "siloed" | null;

interface SubProcess {
  key: string;
  label: string;
  description: string;
}

const CAPABILITIES_CONFIG: Record<string, SubProcess[]> = {
  retail_onboarding: [
    { key: "customer_application",  label: "Customer Application",       description: "Submission of initial application form and personal details" },
    { key: "identity_verification", label: "Identity Verification",      description: "ID document capture, liveness check and biometric match" },
    { key: "kyc_aml_screening",     label: "KYC / AML Screening",        description: "Screening against sanctions lists, PEP lists and watchlists" },
    { key: "account_opening",       label: "Account Opening",            description: "Core banking account creation and product setup" },
    { key: "card_issuance",         label: "Card Issuance",              description: "Debit card production, personalisation and delivery" },
    { key: "digital_enrollment",    label: "Digital Banking Enrollment", description: "Mobile app and online banking activation" },
  ],
  retail_personal_loan: [
    { key: "loan_application",         label: "Loan Application",          description: "Customer submits loan request with required details" },
    { key: "identity_verification",    label: "Identity Verification",     description: "ID verification and customer authentication" },
    { key: "credit_bureau_check",      label: "Credit Bureau Check",       description: "Automated credit score and history retrieval" },
    { key: "affordability_assessment", label: "Affordability Assessment",  description: "Income verification and debt-to-income calculation" },
    { key: "document_collection",      label: "Document Collection",       description: "Payslips, bank statements, and proof of address" },
    { key: "underwriting_decision",    label: "Underwriting & Decision",   description: "Credit decisioning and approval workflow" },
    { key: "offer_acceptance",         label: "Offer & Acceptance",        description: "Loan offer presentation and customer e-signature" },
    { key: "disbursement",             label: "Disbursement",              description: "Funds transfer to customer account" },
  ],
};

const STATUS_OPTIONS: { value: CapabilityStatus; label: string; color: string; bg: string; border: string }[] = [
  { value: "digital", label: "Digital",  color: "#1A8F4F", bg: "rgba(46,204,113,0.12)", border: "rgba(46,204,113,0.3)" },
  { value: "partial", label: "Partial",  color: "#B07800", bg: "rgba(255,172,9,0.12)",  border: "rgba(255,172,9,0.3)"  },
  { value: "manual",  label: "Manual",   color: "#C0392B", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
];

const INTEGRATION_OPTIONS: { value: IntegrationStatus; label: string; sublabel: string; color: string; bg: string; border: string }[] = [
  {
    value: "integrated",
    label: "Integrated",
    sublabel: "Systems are connected end-to-end — data flows automatically with no manual re-entry",
    color: "#1A8F4F", bg: "rgba(46,204,113,0.08)", border: "rgba(46,204,113,0.25)",
  },
  {
    value: "partial_integration",
    label: "Partially Integrated",
    sublabel: "Some systems are connected but manual handoffs or re-keying still occur between steps",
    color: "#B07800", bg: "rgba(255,172,9,0.08)",  border: "rgba(255,172,9,0.25)",
  },
  {
    value: "siloed",
    label: "Siloed",
    sublabel: "Systems operate independently — data must be manually transferred or re-entered at each step",
    color: "#C0392B", bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.22)",
  },
];

interface Props {
  engagementId: string;
  processId: string;
  processKey: string;
  initialCapabilities: Record<string, string> | null;
}

export function ProcessCapabilitiesForm({ engagementId, processId, processKey, initialCapabilities }: Props) {
  const subProcesses = CAPABILITIES_CONFIG[processKey] ?? [];

  const [values, setValues] = useState<Record<string, CapabilityStatus>>(() => {
    const init: Record<string, CapabilityStatus> = {};
    for (const sp of subProcesses) {
      const raw = initialCapabilities?.[sp.key];
      init[sp.key] = (raw === "digital" || raw === "partial" || raw === "manual") ? raw : null;
    }
    return init;
  });

  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(() => {
    const raw = initialCapabilities?.integrationStatus;
    return (raw === "integrated" || raw === "partial_integration" || raw === "siloed") ? raw : null;
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (subProcesses.length === 0) return null;

  function toggleStatus(key: string, status: CapabilityStatus) {
    setValues((v) => ({ ...v, [key]: v[key] === status ? null : status }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...values, integrationStatus };
      const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processCapabilities: payload }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  const answeredCount = Object.values(values).filter(Boolean).length;
  const digitalCount  = Object.values(values).filter((v) => v === "digital").length;
  const partialCount  = Object.values(values).filter((v) => v === "partial").length;
  const manualCount   = Object.values(values).filter((v) => v === "manual").length;
  const canSave = answeredCount > 0 || integrationStatus !== null;

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", padding: "24px 28px", marginBottom: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C6E84", marginBottom: 4 }}>
            Current Capabilities
          </div>
          <div style={{ fontSize: 12, color: "#9AAABB" }}>
            How is each sub-process being handled today?
          </div>
        </div>
        {answeredCount > 0 && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {digitalCount > 0 && <SummaryPill count={digitalCount} label="Digital"  color="#1A8F4F" bg="rgba(46,204,113,0.1)"  border="rgba(46,204,113,0.2)" />}
            {partialCount > 0 && <SummaryPill count={partialCount} label="Partial"  color="#B07800" bg="rgba(255,172,9,0.1)"   border="rgba(255,172,9,0.2)"  />}
            {manualCount  > 0 && <SummaryPill count={manualCount}  label="Manual"   color="#C0392B" bg="rgba(239,68,68,0.08)"  border="rgba(239,68,68,0.2)"  />}
          </div>
        )}
      </div>

      {/* Sub-process rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 24 }}>
        {subProcesses.map((sp, i) => {
          const current = values[sp.key];
          return (
            <div
              key={sp.key}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "10px 12px", borderRadius: 10,
                background: i % 2 === 0 ? "#FAFBFC" : "#fff",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", marginBottom: 1 }}>{sp.label}</div>
                <div style={{ fontSize: 11, color: "#9AAABB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sp.description}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {STATUS_OPTIONS.map((opt) => {
                  const selected = current === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleStatus(sp.key, opt.value)}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                        transition: "all 0.15s",
                        background: selected ? opt.bg : "transparent",
                        color: selected ? opt.color : "#9AAABB",
                        border: selected ? `1px solid ${opt.border}` : "1px solid #EEF2F8",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration question */}
      <div style={{ borderTop: "1px solid #EEF2F8", paddingTop: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", marginBottom: 4 }}>
          Are these processes integrated end-to-end digitally, or are they siloed?
        </div>
        <div style={{ fontSize: 11, color: "#9AAABB", marginBottom: 14 }}>
          This tells us whether digital steps are connected or operate as separate islands.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INTEGRATION_OPTIONS.map((opt) => {
            const selected = integrationStatus === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setIntegrationStatus(integrationStatus === opt.value ? null : opt.value)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left",
                  padding: "12px 16px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                  background: selected ? opt.bg : "#FAFBFC",
                  border: selected ? `1.5px solid ${opt.border}` : "1.5px solid #EEF2F8",
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  border: selected ? `2px solid ${opt.color}` : "2px solid #DDE3EC",
                  background: selected ? opt.color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: selected ? opt.color : "#374D6C", marginBottom: 2 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#9AAABB", lineHeight: 1.5 }}>
                    {opt.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          style={{
            fontSize: 12, fontWeight: 700, padding: "8px 22px", borderRadius: 30,
            background: saved ? "rgba(46,204,113,0.12)" : !canSave ? "#F5F7F9" : "#1A5AFF",
            color: saved ? "#1A8F4F" : !canSave ? "#9AAABB" : "#fff",
            border: saved ? "1px solid rgba(46,204,113,0.25)" : "none",
            cursor: saving || !canSave ? "default" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Capabilities"}
        </button>
      </div>
    </div>
  );
}

function SummaryPill({ count, label, color, bg, border }: { count: number; label: string; color: string; bg: string; border: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
      padding: "4px 10px", borderRadius: 20, background: bg, color, border: `1px solid ${border}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{count}</span>
      {label}
    </div>
  );
}
