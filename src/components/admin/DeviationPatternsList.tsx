"use client";

import { useState } from "react";

type Reason = {
  category: "legitimate" | "operational" | "compliance" | "data_quality";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  investigationHint: string;
  valueModel: string;
  apaAgent?: string;
};

type Pattern = {
  id: string;
  patternKey: string;
  type: string;
  stepKeyword: string;
  reasons: Reason[];
};

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  skip:           { bg: "rgba(239,68,68,0.08)", text: "#C0392B" },
  loop:           { bg: "rgba(255,172,9,0.08)", text: "#B07800" },
  out_of_order:   { bg: "rgba(168,85,247,0.08)", text: "#7C3AED" },
  extra_step:     { bg: "rgba(26,90,255,0.08)", text: "#1A5AFF" },
};

const CATEGORY_DOTS: Record<string, string> = {
  legitimate:   "#1A8F4F",
  operational:  "#B07800",
  compliance:   "#C0392B",
  data_quality: "#9AAABB",
};

const SEVERITY_DOT: Record<string, string> = {
  low:      "#9AAABB",
  medium:   "#1A5AFF",
  high:     "#FFAC09",
  critical: "#EF4444",
};

export function DeviationPatternsList({ patterns, onChanged }: { patterns: Pattern[]; onChanged: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [editingReasonIdx, setEditingReasonIdx] = useState<{ patternId: string; idx: number } | null>(null);

  async function deletePattern(id: string) {
    if (!confirm("Delete this entire deviation pattern (and all its reasons)?")) return;
    const res = await fetch(`/api/admin/deviation-patterns/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  async function deleteReason(pattern: Pattern, idx: number) {
    if (!confirm("Delete this reason?")) return;
    const newReasons = pattern.reasons.filter((_, i) => i !== idx);
    const res = await fetch(`/api/admin/deviation-patterns/${pattern.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasons: newReasons }),
    });
    if (res.ok) onChanged();
  }

  async function saveReason(pattern: Pattern, idx: number, updated: Reason) {
    const newReasons = pattern.reasons.map((r, i) => (i === idx ? updated : r));
    const res = await fetch(`/api/admin/deviation-patterns/${pattern.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasons: newReasons }),
    });
    if (res.ok) {
      setEditingReasonIdx(null);
      onChanged();
    }
  }

  async function savePattern(pattern: Pattern, body: Partial<Pattern>) {
    const res = await fetch(`/api/admin/deviation-patterns/${pattern.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditingPattern(null);
      onChanged();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {patterns.map((p) => {
        const ts = TYPE_STYLES[p.type] ?? TYPE_STYLES.skip;
        const isExpanded = expandedId === p.id;
        const isEditingThis = editingPattern === p.id;

        return (
          <div key={p.id} style={{ borderRadius: 10, border: "1px solid #DDE3EC", overflow: "hidden", background: "#fff" }}>
            {/* Pattern header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#FAFBFC" }}>
              <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", flex: 1, textAlign: "left", padding: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 4, background: ts.bg, color: ts.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {p.type.replace("_", " ")}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditingThis ? (
                    <PatternEditor pattern={p} onSave={(body) => savePattern(p, body)} onCancel={() => setEditingPattern(null)} />
                  ) : (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", fontFamily: "monospace" }}>{p.patternKey}</div>
                      <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 1 }}>
                        matches <code style={{ background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #EEF2F8" }}>/{p.stepKeyword}/</code>
                      </div>
                    </>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#5C6E84" }}>
                  {p.reasons.length} reason{p.reasons.length !== 1 ? "s" : ""}
                </span>
                <svg width="12" height="12" fill="none" stroke="#9AAABB" viewBox="0 0 24 24"
                  style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button onClick={() => setEditingPattern(isEditingThis ? null : p.id)}
                style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 14, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>
                {isEditingThis ? "Cancel" : "Edit"}
              </button>
              <button onClick={() => deletePattern(p.id)}
                style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 14, background: "transparent", color: "#9AAABB", border: "none", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            {isExpanded && (
              <div style={{ padding: "12px 14px", borderTop: "1px solid #F0F3F7" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.reasons.map((r, i) => {
                    const isEditingReason = editingReasonIdx?.patternId === p.id && editingReasonIdx?.idx === i;
                    return (
                      <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF2F8" }}>
                        {isEditingReason ? (
                          <ReasonEditor reason={r} onSave={(updated) => saveReason(p, i, updated)} onCancel={() => setEditingReasonIdx(null)} />
                        ) : (
                          <ReasonView reason={r}
                            onEdit={() => setEditingReasonIdx({ patternId: p.id, idx: i })}
                            onDelete={() => deleteReason(p, i)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  function ReasonView({ reason, onEdit, onDelete }: { reason: Reason; onEdit: () => void; onDelete: () => void }) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_DOTS[reason.category] ?? "#9AAABB" }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>{reason.category.replace("_", " ")}</span>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_DOT[reason.severity] ?? "#9AAABB" }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>{reason.severity}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onEdit} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>Edit</button>
          <button onClick={onDelete} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 12, background: "transparent", color: "#9AAABB", border: "none", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", marginBottom: 4 }}>{reason.title}</div>
        <div style={{ fontSize: 11, color: "#374D6C", lineHeight: 1.5, marginBottom: 6 }}>{reason.description}</div>
        <div style={{ fontSize: 10, color: "#5C6E84", lineHeight: 1.5 }}>
          <strong>Investigate:</strong> {reason.investigationHint}
        </div>
        <div style={{ fontSize: 10, color: "#5C6E84", lineHeight: 1.5, marginTop: 2 }}>
          <strong>Value model:</strong> {reason.valueModel}
        </div>
        {reason.apaAgent && (
          <div style={{ fontSize: 10, color: "#1A5AFF", marginTop: 4 }}>
            → <strong>{reason.apaAgent}</strong>
          </div>
        )}
      </>
    );
  }
}

function PatternEditor({ pattern, onSave, onCancel }: { pattern: Pattern; onSave: (body: Partial<Pattern>) => void; onCancel: () => void }) {
  const [patternKey, setPatternKey] = useState(pattern.patternKey);
  const [type, setType] = useState(pattern.type);
  const [stepKeyword, setStepKeyword] = useState(pattern.stepKeyword);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input value={patternKey} onChange={(e) => setPatternKey(e.target.value)} style={inputStyle} placeholder="patternKey" />
      <div style={{ display: "flex", gap: 4 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, flexShrink: 0 }}>
          <option value="skip">skip</option>
          <option value="loop">loop</option>
          <option value="out_of_order">out_of_order</option>
          <option value="extra_step">extra_step</option>
        </select>
        <input value={stepKeyword} onChange={(e) => setStepKeyword(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="stepKeyword regex" />
        <button onClick={() => onSave({ patternKey, type, stepKeyword })} style={btnPrimary}>Save</button>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

function ReasonEditor({ reason, onSave, onCancel }: { reason: Reason; onSave: (r: Reason) => void; onCancel: () => void }) {
  const [r, setR] = useState(reason);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <select value={r.category} onChange={(e) => setR({ ...r, category: e.target.value as Reason["category"] })} style={inputStyle}>
          <option value="legitimate">legitimate</option>
          <option value="operational">operational</option>
          <option value="compliance">compliance</option>
          <option value="data_quality">data_quality</option>
        </select>
        <select value={r.severity} onChange={(e) => setR({ ...r, severity: e.target.value as Reason["severity"] })} style={inputStyle}>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>
      </div>
      <input value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} style={inputStyle} placeholder="Title" />
      <textarea value={r.description} onChange={(e) => setR({ ...r, description: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Description" />
      <textarea value={r.investigationHint} onChange={(e) => setR({ ...r, investigationHint: e.target.value })} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} placeholder="Investigation hint" />
      <textarea value={r.valueModel} onChange={(e) => setR({ ...r, valueModel: e.target.value })} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} placeholder="Value model" />
      <input value={r.apaAgent ?? ""} onChange={(e) => setR({ ...r, apaAgent: e.target.value || undefined })} style={inputStyle} placeholder="Recommended APA agent (optional)" />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onSave(r)} style={btnPrimary}>Save</button>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 11, padding: "6px 10px", border: "1px solid #DDE3EC", borderRadius: 6, background: "#fff", outline: "none", color: "#001C3D", fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, padding: "6px 14px", borderRadius: 14, background: "#1A5AFF", color: "#fff", border: "none", cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, padding: "6px 14px", borderRadius: 14, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer",
};
