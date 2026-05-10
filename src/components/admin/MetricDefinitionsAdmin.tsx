"use client";

import { useState } from "react";
import {
  type MetricDefinition, type MetricCategory, type MetricSource,
  METRIC_CATEGORY_META, METRIC_SOURCE_META,
} from "@/lib/metricTypes";

interface Props {
  templateId: string;
  metrics: MetricDefinition[];
  onChanged: () => void;
}

const ALL_CATEGORIES: MetricCategory[] = ["time", "volume", "quality", "outcome", "cost", "cx", "workforce", "compliance"];

export function MetricDefinitionsAdmin({ templateId, metrics, onChanged }: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function save(updated: MetricDefinition[]) {
    const res = await fetch(`/api/admin/process-templates/${templateId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metricDefinitions: updated }),
    });
    if (res.ok) onChanged();
  }

  async function upsert(metric: MetricDefinition, originalKey?: string) {
    const others = metrics.filter((m) => m.key !== (originalKey ?? metric.key));
    await save([...others, metric].sort((a, b) =>
      ALL_CATEGORIES.indexOf(a.category) - ALL_CATEGORIES.indexOf(b.category) || a.label.localeCompare(b.label)
    ));
    setEditingKey(null);
    setAdding(false);
  }

  async function remove(key: string) {
    if (!confirm("Delete this metric?")) return;
    await save(metrics.filter((m) => m.key !== key));
  }

  // Group by category
  const grouped = ALL_CATEGORIES.map((cat) => ({
    category: cat,
    items: metrics.filter((m) => m.category === cat),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#5C6E84" }}>{metrics.length} metric{metrics.length !== 1 ? "s" : ""} across {grouped.filter((g) => g.items.length > 0).length} categories</span>
        <button onClick={() => { setAdding(true); setEditingKey(null); }}
          style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: "#1A5AFF", color: "#fff", border: "none", cursor: "pointer" }}>
          + Add Metric
        </button>
      </div>

      {adding && (
        <MetricEditor
          metric={blankMetric()}
          onSave={(m) => upsert(m)}
          onCancel={() => setAdding(false)}
          existingKeys={metrics.map((m) => m.key)}
        />
      )}

      {grouped.map(({ category, items }) => {
        if (items.length === 0) return null;
        const cm = METRIC_CATEGORY_META[category];
        return (
          <div key={category}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, color: cm.text, textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "3px 8px", background: cm.bg, borderRadius: 4,
              }}>
                {cm.label} · {items.length}
              </span>
              <span style={{ fontSize: 10, color: "#9AAABB" }}>{cm.description}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {items.map((m) => {
                const isEditing = editingKey === m.key;
                if (isEditing) {
                  return (
                    <MetricEditor key={m.key} metric={m}
                      onSave={(updated) => upsert(updated, m.key)}
                      onCancel={() => setEditingKey(null)}
                      existingKeys={metrics.filter((x) => x.key !== m.key).map((x) => x.key)}
                    />
                  );
                }
                return <MetricRow key={m.key} metric={m} onEdit={() => setEditingKey(m.key)} onDelete={() => remove(m.key)} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricRow({ metric, onEdit, onDelete }: { metric: MetricDefinition; onEdit: () => void; onDelete: () => void }) {
  const sm = METRIC_SOURCE_META[metric.source];
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF2F8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: sm.bg, color: sm.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {sm.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", flex: 1 }}>{metric.label}</span>
        <span style={{ fontSize: 10, color: "#9AAABB", fontFamily: "monospace" }}>{metric.unit}</span>
        {metric.required && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(239,68,68,0.08)", color: "#C0392B" }}>Required</span>}
        <button onClick={onEdit} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>Edit</button>
        <button onClick={onDelete} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 12, background: "transparent", color: "#9AAABB", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ fontSize: 10, color: "#9AAABB", fontFamily: "monospace", marginBottom: 4 }}>{metric.key}</div>
      {metric.description && <div style={{ fontSize: 11, color: "#5C6E84", lineHeight: 1.5, marginBottom: 4 }}>{metric.description}</div>}

      {metric.source === "direct" && metric.computation && (
        <div style={{ fontSize: 10, color: "#5C6E84" }}>
          <strong>Computation:</strong> <code style={{ fontFamily: "monospace", background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #EEF2F8" }}>{metric.computation}</code>
        </div>
      )}
      {metric.source === "inferred" && metric.formula && (
        <div style={{ fontSize: 10, color: "#5C6E84" }}>
          <strong>Formula:</strong> <code style={{ fontFamily: "monospace", background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #EEF2F8" }}>{metric.formula}</code>
          {metric.dependencies && metric.dependencies.length > 0 && (
            <span style={{ marginLeft: 8 }}>
              <strong>Deps:</strong> {metric.dependencies.map((d) => <code key={d} style={{ fontFamily: "monospace", background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #EEF2F8", marginRight: 4 }}>{d}</code>)}
            </span>
          )}
        </div>
      )}
      {metric.source === "assumed" && (
        <div style={{ fontSize: 10, color: "#5C6E84" }}>
          {metric.defaultValue !== undefined && <><strong>Default:</strong> <code style={{ fontFamily: "monospace", background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #EEF2F8" }}>{metric.defaultValue} {metric.unit}</code> </>}
          {metric.sourceHint && <span style={{ marginLeft: 8 }}><em>{metric.sourceHint}</em></span>}
        </div>
      )}

      {(metric.goodThreshold !== undefined || metric.poorThreshold !== undefined) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 10, color: "#5C6E84" }}>
          <strong>Targets:</strong>
          {metric.direction && <span style={{ fontStyle: "italic" }}>({metric.direction.replace("_", " ")})</span>}
          {metric.goodThreshold !== undefined && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A8F4F" }} /> ≤ {metric.goodThreshold} {metric.unit}</span>}
          {metric.poorThreshold !== undefined && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} /> ≥ {metric.poorThreshold} {metric.unit}</span>}
        </div>
      )}
    </div>
  );
}

function MetricEditor({ metric, onSave, onCancel, existingKeys }: {
  metric: MetricDefinition;
  onSave: (m: MetricDefinition) => void;
  onCancel: () => void;
  existingKeys: string[];
}) {
  const [m, setM] = useState<MetricDefinition>(metric);
  const keyConflict = m.key !== metric.key && existingKeys.includes(m.key);
  const canSave = m.key && m.label && m.unit && !keyConflict;

  return (
    <div style={{ padding: 12, borderRadius: 10, background: "rgba(26,90,255,0.04)", border: "1px solid rgba(26,90,255,0.2)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input value={m.key} onChange={(e) => setM({ ...m, key: e.target.value.replace(/\s/g, "_").toLowerCase() })} placeholder="snake_case_key" style={{ ...inputStyle, fontFamily: "monospace" }} />
        <input value={m.label} onChange={(e) => setM({ ...m, label: e.target.value })} placeholder="Display label" style={inputStyle} />
      </div>
      {keyConflict && <div style={{ fontSize: 10, color: "#C0392B" }}>Key already exists</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <select value={m.category} onChange={(e) => setM({ ...m, category: e.target.value as MetricCategory })} style={inputStyle}>
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{METRIC_CATEGORY_META[c].label}</option>)}
        </select>
        <select value={m.source} onChange={(e) => setM({ ...m, source: e.target.value as MetricSource })} style={inputStyle}>
          <option value="direct">Direct (from event log)</option>
          <option value="inferred">Inferred (computed)</option>
          <option value="assumed">Assumed (consultant input)</option>
        </select>
        <input value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value })} placeholder="unit (days, %, GBP/case)" style={inputStyle} />
      </div>

      <textarea value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} placeholder="Description — what this measures" style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />

      {m.source === "direct" && (
        <input value={m.computation ?? ""} onChange={(e) => setM({ ...m, computation: e.target.value })} placeholder="Computation (e.g. avg(end - start) per case)" style={inputStyle} />
      )}
      {m.source === "inferred" && (
        <>
          <input value={m.formula ?? ""} onChange={(e) => setM({ ...m, formula: e.target.value })} placeholder="Formula (e.g. lead_time × fte_ops_hourly_rate)" style={inputStyle} />
          <input value={(m.dependencies ?? []).join(", ")} onChange={(e) => setM({ ...m, dependencies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Dependencies, comma-separated (e.g. lead_time, fte_ops_hourly_rate)" style={inputStyle} />
        </>
      )}
      {m.source === "assumed" && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 6 }}>
          <input type="number" step="0.01" value={m.defaultValue ?? ""} onChange={(e) => setM({ ...m, defaultValue: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Default value" style={{ ...inputStyle, fontFamily: "monospace" }} />
          <input value={m.sourceHint ?? ""} onChange={(e) => setM({ ...m, sourceHint: e.target.value || undefined })} placeholder="Source hint (where to find the real number)" style={inputStyle} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "120px 120px 160px auto auto auto", gap: 6, alignItems: "center" }}>
        <input type="number" step="0.01" value={m.goodThreshold ?? ""} onChange={(e) => setM({ ...m, goodThreshold: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Good ≤" style={{ ...inputStyle, fontFamily: "monospace" }} />
        <input type="number" step="0.01" value={m.poorThreshold ?? ""} onChange={(e) => setM({ ...m, poorThreshold: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Poor ≥" style={{ ...inputStyle, fontFamily: "monospace" }} />
        <select value={m.direction ?? ""} onChange={(e) => setM({ ...m, direction: e.target.value as "lower_is_better" | "higher_is_better" || undefined })} style={inputStyle}>
          <option value="">— direction —</option>
          <option value="lower_is_better">lower is better</option>
          <option value="higher_is_better">higher is better</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#5C6E84" }}>
          <input type="checkbox" checked={m.required ?? false} onChange={(e) => setM({ ...m, required: e.target.checked })} /> required
        </label>
        <button disabled={!canSave} onClick={() => onSave(m)}
          style={{ fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 14, background: canSave ? "#1A5AFF" : "#DDE3EC", color: canSave ? "#fff" : "#9AAABB", border: "none", cursor: canSave ? "pointer" : "not-allowed" }}>
          Save
        </button>
        <button onClick={onCancel} style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 14, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

function blankMetric(): MetricDefinition {
  return {
    key: "", label: "", category: "time", source: "direct", unit: "days",
    description: "", required: false,
  };
}

const inputStyle: React.CSSProperties = {
  fontSize: 11, padding: "6px 10px", border: "1px solid #DDE3EC", borderRadius: 6, background: "#fff", outline: "none", color: "#001C3D", fontFamily: "inherit",
};
