"use client";

import { useState } from "react";
import type { DataRequest, DataRequestItem, MoSCoW } from "@/app/api/engagements/[id]/data-request/route";

const MOSCOW: Record<MoSCoW, { label: string; bg: string; border: string; text: string; dot: string; description: string }> = {
  must_have: {
    label: "Must Have",
    bg: "rgba(239,68,68,0.04)",
    border: "rgba(239,68,68,0.15)",
    text: "#ef4444",
    dot: "#EF4444",
    description: "Cannot build digital twin without this",
  },
  should_have: {
    label: "Should Have",
    bg: "rgba(255,172,9,0.04)",
    border: "rgba(255,172,9,0.15)",
    text: "#FFAC09",
    dot: "#FFAC09",
    description: "Enables bottleneck & workload analysis",
  },
  could_have: {
    label: "Could Have",
    bg: "rgba(51,102,255,0.04)",
    border: "rgba(51,102,255,0.15)",
    text: "#7aa3ff",
    dot: "#3366FF",
    description: "Advanced analytics, not blocking",
  },
};

const TIERS: MoSCoW[] = ["must_have", "should_have", "could_have"];

function FieldPills({ fields }: { fields: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? fields : fields.slice(0, 3);
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((f) => (
        <span key={f} className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ background: "rgba(51,102,255,0.07)", border: "1px solid rgba(51,102,255,0.12)", color: "#6B8EFF" }}>
          {f}
        </span>
      ))}
      {fields.length > 3 && (
        <button onClick={() => setExpanded((v) => !v)}
          className="text-xs underline"
          style={{ color: "#9AAABB" }}>
          {expanded ? "less" : `+${fields.length - 3} more`}
        </button>
      )}
    </div>
  );
}

function TierAccordion({ items, tier, defaultOpen }: { items: DataRequestItem[]; tier: MoSCoW; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const s = MOSCOW[tier];
  if (items.length === 0) return null;

  return (
    <div style={{ border: `1px solid ${s.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
      {/* Tier header — clickable */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", background: s.bg, border: "none", cursor: "pointer",
          textAlign: "left", borderBottom: open ? `1px solid ${s.border}` : "none",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: s.text, flex: 1 }}>{s.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: s.dot + "18", color: s.text }}>
          {items.length} file{items.length !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: 10, color: "#9AAABB", marginLeft: 4 }}>{s.description}</span>
        <svg
          width="14" height="14" fill="none" stroke={s.text} viewBox="0 0 24 24"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0, opacity: 0.7, marginLeft: 8 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Table */}
      {open && (
        <div className="overflow-x-auto" style={{ background: "#fff" }}>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "30%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid #F0F3F7" }}>
                {["System", "File / Extract", "Key Fields", "Format", "Digital Twin Value"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold"
                    style={{ color: "#9AAABB", letterSpacing: "0.07em", textTransform: "uppercase", fontSize: 9, background: "#FAFBFC" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{
                  borderBottom: i < items.length - 1 ? "1px solid #F5F7F9" : undefined,
                  background: i % 2 === 1 ? "#FAFBFC" : "#fff",
                }}>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.systemColor || "#3366FF", flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#001C3D" }}>{item.systemName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "#4F6EF7" }}>{item.fileName}</div>
                    <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 2, lineHeight: 1.45 }}>{item.description}</div>
                    {item.linkedSteps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.linkedSteps.map((step) => (
                          <span key={step} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(38,188,113,0.07)", border: "1px solid rgba(38,188,113,0.15)", color: "#26BC71", fontWeight: 600 }}>
                            {step}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <FieldPills fields={item.fields} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div style={{ fontSize: 11, fontWeight: 500, color: "#374D6C" }}>{item.format}</div>
                    <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 1 }}>{item.timeRange}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-1.5">
                      <span style={{ color: s.dot, marginTop: 1, flexShrink: 0, fontSize: 10 }}>◆</span>
                      <span style={{ fontSize: 11, color: "#374D6C", lineHeight: 1.45 }}>{item.digitalTwinValue}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface Props {
  engagementId: string;
  processId?: string;
  hasProcessMap: boolean;
  initialDataRequest: DataRequest | null;
  compact?: boolean;
}

export function DataRequestSection({ engagementId, processId, hasProcessMap, initialDataRequest, compact }: Props) {
  const validInitial = initialDataRequest && Array.isArray((initialDataRequest as DataRequest).items)
    ? initialDataRequest
    : null;
  const [dataRequest, setDataRequest] = useState<DataRequest | null>(validInitial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/engagements/${engagementId}/data-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processId ? { processId } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setDataRequest(json.dataRequest as DataRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  const grouped = dataRequest
    ? {
        must_have:   dataRequest.items.filter((i) => i.moscow === "must_have"),
        should_have: dataRequest.items.filter((i) => i.moscow === "should_have"),
        could_have:  dataRequest.items.filter((i) => i.moscow === "could_have"),
      }
    : null;

  // ── Compact mode: embedded inside DiscoverPageContent card ──────────────
  if (compact) {
    return (
      <div style={{ padding: "16px 24px 24px" }}>
        {/* Action row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          {dataRequest ? (
            <span style={{ fontSize: 11, color: "#9AAABB" }}>
              Generated {new Date(dataRequest.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {" · "}{dataRequest.items.length} files across {new Set(dataRequest.items.map((i) => i.systemName)).size} systems
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#5C6E84" }}>
              {hasProcessMap
                ? "Click Generate to produce a MoSCoW-prioritised data collection plan."
                : "Complete the process map first."}
            </span>
          )}

          {hasProcessMap && (
            <button onClick={generate} disabled={loading}
              style={{
                fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 20, cursor: loading ? "wait" : "pointer",
                background: "rgba(139,92,246,0.08)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.2)",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              {loading ? (
                <>
                  <span style={{ width: 8, height: 8, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#8B5CF6", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  Generating…
                </>
              ) : `✦ ${dataRequest ? "Regenerate" : "Generate"}`}
            </button>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 11, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        {dataRequest && (
          <>
            {/* Covering note — collapsible */}
            <button
              onClick={() => setNoteOpen((v) => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", marginBottom: 12, borderRadius: 8, background: "#FAFBFC",
                border: "1px solid #EEF2F8", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 11, fontStyle: "italic", color: "#5C6E84", flex: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: noteOpen ? "normal" : "nowrap" }}>
                {dataRequest.coveringNote}
              </span>
              <svg width="12" height="12" fill="none" stroke="#9AAABB" viewBox="0 0 24 24"
                style={{ transform: noteOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0, marginLeft: 8 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Tier accordions */}
            {TIERS.map((tier, idx) => (
              <TierAccordion key={tier} tier={tier} items={grouped![tier]} defaultOpen={idx === 0} />
            ))}
          </>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Standalone mode (legacy, kept for backwards compat) ─────────────────
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: dataRequest ? "rgba(38,188,113,0.15)" : "rgba(255,172,9,0.12)", color: dataRequest ? "#26BC71" : "#FFAC09" }}>
            {dataRequest ? "✓" : "2"}
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Data Request</h3>
        </div>
        {hasProcessMap && (
          <button onClick={generate} disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-2"
            style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)", cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Generating…" : `✦ ${dataRequest ? "Regenerate" : "Generate Data Request"}`}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md text-xs"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {!hasProcessMap ? (
        <p className="text-xs text-text-muted">Complete and save your process map first.</p>
      ) : !dataRequest ? (
        <p className="text-xs text-text-muted">Click <strong>Generate Data Request</strong> to produce a MoSCoW-prioritised data collection plan.</p>
      ) : (
        <div className="space-y-3 mt-3">
          {TIERS.map((tier, idx) => (
            <TierAccordion key={tier} tier={tier} items={grouped![tier]} defaultOpen={idx === 0} />
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
