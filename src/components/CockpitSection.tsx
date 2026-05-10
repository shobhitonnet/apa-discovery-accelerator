"use client";

import { useEffect, useState } from "react";
import { CockpitView } from "@/components/CockpitView";
import type { CockpitResult } from "@/lib/cockpitMetrics";

interface Props {
  engagementId: string;
  processId: string;
}

export function CockpitSection({ engagementId, processId }: Props) {
  const [result, setResult] = useState<CockpitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}/cockpit`);
      if (!res.ok) throw new Error("Failed to load cockpit");
      setResult(await res.json() as CockpitResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on first mount — cockpit is deterministic and fast (no AI).
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [engagementId, processId]);

  return (
    <div style={{ borderRadius: 12, border: "1px solid #DDE3EC", overflow: "hidden", background: "#fff" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: "rgba(38,188,113,0.04)", borderBottom: "1px solid rgba(38,188,113,0.15)",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, flexShrink: 0,
          background: result?.computed ? "rgba(38,188,113,0.15)" : "rgba(38,188,113,0.08)",
          color: result?.computed ? "#1A8F4F" : "#26BC71",
        }}>
          {result?.computed ? "✓" : "4"}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C6E84", padding: "3px 8px", borderRadius: 4, background: "#fff", border: "1px solid #EEF2F8" }}>
          Stage 4 of 5 — KPI Cockpit
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: result?.computed ? "#1A8F4F" : "#5C6E84", flex: 1 }}>
          {result?.computed
            ? (() => {
                const allMetrics = Object.values(result.metricsByCategory).flat();
                const computable = allMetrics.filter((m) => m.computable).length;
                const off = allMetrics.filter((m) => m.status === "red").length;
                return `${computable} / ${allMetrics.length} metrics computable · ${off} off target`;
              })()
            : "Categorised KPIs against banking benchmarks"}
        </span>
        <button
          onClick={load}
          disabled={loading}
          style={{
            fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 20,
            cursor: loading ? "wait" : "pointer",
            background: loading ? "#DDE3EC" : "linear-gradient(135deg,#26BC71,#06B6D4)",
            color: loading ? "#9AAABB" : "#fff", border: "none",
            display: "flex", alignItems: "center", gap: 6,
          }}>
          {loading ? (
            <>
              <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              Computing…
            </>
          ) : `Refresh ↻`}
        </button>
      </div>

      <div style={{ padding: result ? 16 : "16px" }}>
        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 11, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#C0392B" }}>
            {error}
          </div>
        )}
        {!result && loading && (
          <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5 }}>
            Computing the categorised KPI dashboard — direct metrics from your event log + inferred metrics from country FTE rates + assumed defaults from the process template, all with red / amber / green vs benchmarks.
          </div>
        )}
        {!result && !loading && !error && (
          <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5 }}>
            No cockpit yet. Click <strong>Refresh</strong> to compute.
          </div>
        )}
        {result && (
          <CockpitView cockpit={result} engagementId={engagementId} processId={processId} onMetricUpdated={load} />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
