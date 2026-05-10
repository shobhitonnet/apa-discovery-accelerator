"use client";

import { useState } from "react";

type FieldConfig = { label: string; key: string; suffix?: string };

const METRICS_CONFIG: Record<string, FieldConfig[]> = {
  retail_mortgage: [
    { label: "Applications per year",  key: "applicationsPerYear" },
    { label: "Completions per year",   key: "completionsPerYear" },
    { label: "Avg turnaround time",    key: "avgTatDays",   suffix: "days" },
    { label: "Drop-off rate",          key: "dropOffRate",  suffix: "%" },
  ],
  retail_onboarding: [
    { label: "New applications per year",        key: "applicationsPerYear" },
    { label: "Successful onboardings per year",  key: "onboardingsPerYear" },
    { label: "Avg time to onboard",              key: "avgOnboardDays", suffix: "days" },
    { label: "KYC failure rate",                 key: "kycFailureRate", suffix: "%" },
  ],
  retail_dispute: [
    { label: "Disputes raised per year",   key: "disputesPerYear" },
    { label: "Disputes resolved per year", key: "resolvedPerYear" },
    { label: "Avg resolution time",        key: "avgResolutionDays", suffix: "days" },
    { label: "Customer escalation rate",   key: "escalationRate",    suffix: "%" },
  ],
  retail_personal_loan: [
    { label: "Applications per year",    key: "applicationsPerYear" },
    { label: "Loans disbursed per year", key: "disbursedPerYear" },
    { label: "Avg turnaround time",      key: "avgTatDays",   suffix: "days" },
    { label: "Decline rate",             key: "declineRate",  suffix: "%" },
  ],
  sme_loan: [
    { label: "Loan applications per year", key: "applicationsPerYear" },
    { label: "Loans disbursed per year",   key: "disbursedPerYear" },
    { label: "Avg turnaround time",        key: "avgTatDays",    suffix: "days" },
    { label: "Decline rate",               key: "declineRate",   suffix: "%" },
  ],
};

interface Props {
  engagementId: string;
  processId: string;
  processKey: string;
  initialMetrics: Record<string, string> | null;
}

export function ProcessMetricsForm({ engagementId, processId, processKey, initialMetrics }: Props) {
  const fields = METRICS_CONFIG[processKey] ?? [];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { notes: initialMetrics?.notes ?? "" };
    for (const f of fields) init[f.key] = initialMetrics?.[f.key] ?? "";
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (fields.length === 0) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/engagements/${engagementId}/processes/${processId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processMetrics: values }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", padding: "24px 28px", marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C6E84", marginBottom: 16 }}>
        Process Metrics
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#5C6E84", display: "block", marginBottom: 5 }}>
              {f.label}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                min={0}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder="—"
                style={{
                  width: "100%", padding: f.suffix ? "9px 40px 9px 12px" : "9px 12px",
                  borderRadius: 8, border: "1px solid #DDE3EC", fontSize: 13, color: "#001C3D",
                  background: "#F5F7F9", outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              {f.suffix && (
                <span style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  fontSize: 11, color: "#9AAABB", pointerEvents: "none",
                }}>
                  {f.suffix}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#5C6E84", display: "block", marginBottom: 5 }}>
          Additional context
        </label>
        <textarea
          value={values.notes ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          placeholder="Any process-specific notes, pain points, or context for the discovery team…"
          rows={3}
          style={{
            width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #DDE3EC",
            fontSize: 13, color: "#001C3D", background: "#F5F7F9", resize: "vertical",
            outline: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5,
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            fontSize: 12, fontWeight: 700, padding: "8px 22px", borderRadius: 30,
            background: saved ? "rgba(46,204,113,0.12)" : "#1A5AFF",
            color: saved ? "#1A8F4F" : "#fff",
            border: saved ? "1px solid rgba(46,204,113,0.25)" : "none",
            cursor: saving ? "wait" : "pointer", transition: "all 0.2s",
          }}
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Metrics"}
        </button>
      </div>
    </div>
  );
}
