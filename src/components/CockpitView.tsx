"use client";

import { useState } from "react";
import type { CockpitResult, CockpitMetric } from "@/lib/cockpitMetrics";
import { METRIC_CATEGORY_META, METRIC_SOURCE_META, type MetricCategory } from "@/lib/metricTypes";

const STATUS_COLOR: Record<CockpitMetric["status"], { bg: string; text: string; dot: string; label: string }> = {
  green:   { bg: "rgba(38,188,113,0.12)", text: "#1A8F4F", dot: "#26BC71", label: "On target" },
  amber:   { bg: "rgba(255,172,9,0.12)",  text: "#B07800", dot: "#FFAC09", label: "At risk" },
  red:     { bg: "rgba(239,68,68,0.12)",  text: "#C0392B", dot: "#EF4444", label: "Off target" },
  neutral: { bg: "#F5F7F9",                text: "#5C6E84", dot: "#CBD5E1", label: "—" },
};

const ALL_CATEGORIES: MetricCategory[] = ["time", "quality", "outcome", "cost", "cx", "workforce", "compliance", "volume"];

export function CockpitView({ cockpit, engagementId, processId, onMetricUpdated }: {
  cockpit: CockpitResult;
  engagementId?: string;
  processId?: string;
  onMetricUpdated?: () => void;
}) {
  if (!cockpit.computed) {
    return (
      <div style={{ padding: 32, textAlign: "center", background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", color: "#9AAABB" }}>
        <div style={{ fontSize: 14, color: "#374D6C", fontWeight: 600 }}>Cockpit not yet available</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>{cockpit.reason ?? "Build the activity table first."}</div>
      </div>
    );
  }

  const t = cockpit.totals;

  // Sort metrics within each category: red first, then amber, neutral, green
  const statusOrder: CockpitMetric["status"][] = ["red", "amber", "neutral", "green"];
  function sortMetrics(arr: CockpitMetric[]): CockpitMetric[] {
    return [...arr].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
  }

  // Health summary across all metrics
  const allMetrics = Object.values(cockpit.metricsByCategory).flat();
  const counts = {
    red:     allMetrics.filter((m) => m.status === "red").length,
    amber:   allMetrics.filter((m) => m.status === "amber").length,
    green:   allMetrics.filter((m) => m.status === "green").length,
    neutral: allMetrics.filter((m) => m.status === "neutral").length,
  };
  const computable = allMetrics.filter((m) => m.computable).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top stats strip */}
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC",
        padding: "16px 20px", display: "flex", gap: 24,
        alignItems: "center", flexWrap: "wrap", rowGap: 12,
      }}>
        <Stat label="Cases"      value={t.cases.toLocaleString()} />
        <Stat label="Events"     value={t.events.toLocaleString()} />
        <Stat label="Activities" value={String(t.activities)} />
        <Stat label="Variants"   value={String(t.variants)} />
        <Stat label="Systems"    value={String(t.systems)} />
        <div style={{ flex: 1, minWidth: 0 }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#5C6E84",
          flexWrap: "wrap", flexShrink: 0,
        }}>
          <span style={{ whiteSpace: "nowrap" }}>
            <strong style={{ color: "#001C3D" }}>{computable}</strong> / {allMetrics.length} computable
          </span>
          {counts.red > 0     && <Pill color="#EF4444" label={`${counts.red} off target`} />}
          {counts.amber > 0   && <Pill color="#FFAC09" label={`${counts.amber} at risk`} />}
          {counts.green > 0   && <Pill color="#26BC71" label={`${counts.green} on target`} />}
        </div>
      </div>

      {/* Category cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {ALL_CATEGORIES.map((cat) => {
          const metrics = cockpit.metricsByCategory[cat] ?? [];
          if (metrics.length === 0) return null;
          const cm = METRIC_CATEGORY_META[cat];
          const sorted = sortMetrics(metrics);
          return (
            <div key={cat} style={{ background: "#fff", borderRadius: 14, border: "1px solid #DDE3EC", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, color: cm.text, textTransform: "uppercase", letterSpacing: "0.08em",
                  padding: "3px 8px", background: cm.bg, borderRadius: 4,
                }}>
                  {cm.label}
                </span>
                <span style={{ fontSize: 11, color: "#9AAABB" }}>{metrics.length} metric{metrics.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ fontSize: 11, color: "#9AAABB", lineHeight: 1.4 }}>{cm.description}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sorted.map((m) => (
                  <MetricRow key={m.key} metric={m}
                    engagementId={engagementId} processId={processId}
                    onUpdated={onMetricUpdated} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: "#9AAABB", textAlign: "right" }}>
        Generated {new Date(cockpit.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function MetricRow({ metric, engagementId, processId, onUpdated }: {
  metric: CockpitMetric;
  engagementId?: string;
  processId?: string;
  onUpdated?: () => void;
}) {
  const sc = STATUS_COLOR[metric.status];
  const sm = METRIC_SOURCE_META[metric.source];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(metric.value !== null ? String(metric.value) : "");
  const [saving, setSaving] = useState(false);

  const editable = metric.source === "assumed" && engagementId && processId;

  async function save() {
    if (!engagementId || !processId) return;
    setSaving(true);
    await fetch(`/api/engagements/${engagementId}/processes/${processId}/metric-overrides`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: metric.key, value: value === "" ? null : Number(value) }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated?.();
  }

  async function reset() {
    if (!engagementId || !processId) return;
    setSaving(true);
    await fetch(`/api/engagements/${engagementId}/processes/${processId}/metric-overrides`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: metric.key, value: null }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated?.();
  }

  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: sc.bg, border: `1px solid ${sc.text}30` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot, marginTop: 4 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#001C3D", flex: 1 }}>{metric.label}</span>
        {metric.isOverridden && (
          <span title={`Default ${metric.defaultValue ?? "—"} ${metric.unit}`}
            style={{ fontSize: 8, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 3, background: "rgba(168,85,247,0.1)" }}>
            Override
          </span>
        )}
        <span style={{ fontSize: 8, fontWeight: 700, color: sm.text, textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 3, background: sm.bg }}>
          {sm.label}
        </span>
      </div>

      {editing ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <input type="number" step="0.01" value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
            style={{ flex: 1, fontSize: 14, fontFamily: "monospace", fontWeight: 700, padding: "4px 8px", border: "1px solid #DDE3EC", borderRadius: 4, color: "#001C3D", outline: "none" }} />
          <span style={{ fontSize: 10, color: "#9AAABB", fontFamily: "monospace" }}>{metric.unit}</span>
          <button onClick={save} disabled={saving}
            style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 12, background: "#1A5AFF", color: "#fff", border: "none", cursor: "pointer" }}>
            {saving ? "…" : "Save"}
          </button>
          {metric.isOverridden && (
            <button onClick={reset} disabled={saving}
              style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 12, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>
              Reset
            </button>
          )}
          <button onClick={() => setEditing(false)} disabled={saving}
            style={{ fontSize: 10, color: "#9AAABB", background: "transparent", border: "none", cursor: "pointer" }}>
            ✕
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
          <span
            onClick={() => editable && setEditing(true)}
            title={editable ? "Click to edit" : undefined}
            style={{
              fontSize: 18, fontWeight: 800,
              color: metric.computable ? "#001C3D" : "#9AAABB",
              fontFamily: "monospace",
              cursor: editable ? "pointer" : "default",
              borderBottom: editable ? "1px dashed #CBD5E1" : "none",
            }}>
            {metric.formattedValue}
          </span>
          {metric.thresholdInfo && (
            <span style={{ fontSize: 9, color: "#9AAABB", fontFamily: "monospace" }} title={metric.thresholdInfo}>
              {sc.label}
            </span>
          )}
        </div>
      )}

      {metric.description && (
        <div style={{ fontSize: 10, color: "#5C6E84", lineHeight: 1.4 }}>{metric.description}</div>
      )}
      {!metric.computable && metric.source !== "assumed" && (
        <div style={{ fontSize: 9, color: "#9AAABB", fontStyle: "italic", marginTop: 4 }}>
          Computation not yet implemented for this key
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#001C3D", marginTop: 2, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: `${color}15`, color, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}
