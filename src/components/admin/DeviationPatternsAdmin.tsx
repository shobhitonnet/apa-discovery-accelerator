"use client";

import { useEffect, useState } from "react";

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
  processKey: string | null;
  country: string | null;
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

export function DeviationPatternsAdmin() {
  const [items, setItems] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/deviation-patterns");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = filterType ? items.filter((i) => i.type === filterType) : items;

  if (loading) return <div style={{ padding: 12, color: "#9AAABB", fontSize: 12 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</span>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={inputStyle}>
          <option value="">All types</option>
          <option value="skip">Skip</option>
          <option value="loop">Loop / Rework</option>
          <option value="out_of_order">Out of Order</option>
          <option value="extra_step">Extra Step</option>
        </select>
        <span style={{ fontSize: 11, color: "#9AAABB", flex: 1 }}>{filtered.length} pattern{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.map((p) => {
        const ts = TYPE_STYLES[p.type] ?? TYPE_STYLES.skip;
        const isExpanded = expandedId === p.id;
        return (
          <div key={p.id} style={{ borderRadius: 10, border: "1px solid #DDE3EC", overflow: "hidden", background: "#fff" }}>
            <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 4, background: ts.bg, color: ts.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {p.type.replace("_", " ")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", fontFamily: "monospace" }}>{p.patternKey}</div>
                <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 1 }}>
                  matches <code style={{ background: "#F5F7F9", padding: "1px 4px", borderRadius: 3 }}>/{p.stepKeyword}/</code>
                  {p.processKey && <> · {p.processKey}</>}
                  {p.country && <> · {p.country}</>}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#5C6E84" }}>
                {p.reasons.length} reason{p.reasons.length !== 1 ? "s" : ""}
              </span>
              <svg width="12" height="12" fill="none" stroke="#9AAABB" viewBox="0 0 24 24"
                style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div style={{ padding: "12px 14px", borderTop: "1px solid #F0F3F7", background: "#FAFBFC" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.reasons.map((r, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "#fff", border: "1px solid #EEF2F8" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_DOTS[r.category] ?? "#9AAABB" }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.category.replace("_", " ")}</span>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_DOT[r.severity] ?? "#9AAABB" }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.severity}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", marginBottom: 4 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: "#374D6C", lineHeight: 1.5, marginBottom: 6 }}>{r.description}</div>
                      <div style={{ fontSize: 10, color: "#5C6E84", lineHeight: 1.5 }}>
                        <strong>Investigate:</strong> {r.investigationHint}
                      </div>
                      <div style={{ fontSize: 10, color: "#5C6E84", lineHeight: 1.5, marginTop: 2 }}>
                        <strong>Value model:</strong> {r.valueModel}
                      </div>
                      {r.apaAgent && (
                        <div style={{ fontSize: 10, color: "#1A5AFF", marginTop: 4 }}>
                          → <strong>{r.apaAgent}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "#9AAABB", fontSize: 12, background: "#FAFBFC", borderRadius: 10 }}>
          No deviation patterns. Run the seed script to populate the library from the codebase.
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 11, padding: "5px 10px", border: "1px solid #DDE3EC", borderRadius: 6, background: "#fff", outline: "none", color: "#001C3D",
};
