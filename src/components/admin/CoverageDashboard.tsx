"use client";

import { useEffect, useState } from "react";

type Coverage = {
  countries: string[];
  processes: Array<{ key: string; name: string }>;
  cells: Record<string, {
    hasActiveTemplate: boolean;
    templateVersion: number | null;
    coefficientCount: number;
    deviationCount: number;
    completeness: "full" | "partial" | "missing";
  }>;
  totals: {
    activeTemplates: number;
    countries: number;
    coefficients: number;
    deviationPatterns: number;
  };
};

const STATUS = {
  full:    { bg: "rgba(38,188,113,0.12)",  border: "rgba(38,188,113,0.3)", text: "#1A8F4F", icon: "✓" },
  partial: { bg: "rgba(255,172,9,0.12)",   border: "rgba(255,172,9,0.3)",  text: "#B07800", icon: "⚠" },
  missing: { bg: "#F5F7F9",                  border: "#EEF2F8",              text: "#9AAABB", icon: "·" },
};

export function CoverageDashboard() {
  const [data, setData] = useState<Coverage | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/coverage").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div style={{ color: "#9AAABB", fontSize: 12 }}>Loading coverage…</div>;

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", padding: "20px 24px", marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", margin: 0 }}>Repository Coverage</h3>
          <p style={{ fontSize: 11, color: "#9AAABB", margin: 0, marginTop: 1 }}>
            What's seeded for each (country × process) combination
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#5C6E84" }}>
          <span><strong style={{ color: "#001C3D" }}>{data.totals.activeTemplates}</strong> active templates</span>
          <span><strong style={{ color: "#001C3D" }}>{data.totals.countries}</strong> countries</span>
          <span><strong style={{ color: "#001C3D" }}>{data.totals.coefficients}</strong> coefficients</span>
          <span><strong style={{ color: "#001C3D" }}>{data.totals.deviationPatterns}</strong> deviation patterns</span>
        </div>
      </div>

      {/* Empty states */}
      {data.countries.length === 0 || data.processes.length === 0 ? (
        <div style={{ padding: "20px", color: "#9AAABB", fontSize: 12, textAlign: "center", background: "#FAFBFC", borderRadius: 10 }}>
          No data seeded yet. Use the tabs below to add a Process Template or Value Coefficients.
        </div>
      ) : (
        /* Matrix */
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4, minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left", paddingLeft: 8 }}>Country ↓ / Process →</th>
                {data.processes.map((p) => (
                  <th key={p.key} style={thStyle}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#001C3D" }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "#9AAABB", fontFamily: "monospace" }}>{p.key}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.countries.map((country) => (
                <tr key={country}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 12, color: "#001C3D", textAlign: "left", paddingLeft: 8 }}>
                    {country}
                  </td>
                  {data.processes.map((p) => {
                    const k = `${country}|${p.key}`;
                    const cell = data.cells[k];
                    const s = STATUS[cell?.completeness ?? "missing"];
                    const isHovered = hovered === k;
                    return (
                      <td key={p.key} style={tdStyle}>
                        <div
                          onMouseEnter={() => setHovered(k)}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            position: "relative",
                            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
                            padding: "10px 8px",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                            cursor: "default",
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 800, color: s.text, lineHeight: 1 }}>{s.icon}</span>
                          <span style={{ fontSize: 9, fontWeight: 600, color: s.text, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                            {cell?.completeness ?? "missing"}
                          </span>
                          {isHovered && cell && (
                            <div style={{
                              position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                              zIndex: 10, padding: "8px 10px", borderRadius: 8,
                              background: "#001C3D", color: "#fff", fontSize: 10,
                              whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                            }}>
                              <div>Template: {cell.hasActiveTemplate ? `v${cell.templateVersion} active` : "none active"}</div>
                              <div>Coefficients: {cell.coefficientCount}</div>
                              <div>Deviations: {cell.deviationCount}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10, color: "#5C6E84" }}>
        {(["full", "partial", "missing"] as const).map((s) => {
          const st = STATUS[s];
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: st.bg, border: `1px solid ${st.border}`, color: st.text, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{st.icon}</span>
              <span style={{ textTransform: "capitalize" }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 8px",
  background: "#FAFBFC",
  borderBottom: "1px solid #EEF2F8",
  textAlign: "center",
  verticalAlign: "bottom",
};

const tdStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 0,
};
