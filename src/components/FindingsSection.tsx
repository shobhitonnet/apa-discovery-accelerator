"use client";

import { useEffect, useState } from "react";
import { METRIC_CATEGORY_META, type MetricCategory } from "@/lib/metricTypes";

type ElasticOpsVertex = "growth" | "efficiency" | "control";

type Finding = {
  rank: number;
  title: string;
  category: "value_leak" | "cycle_pain" | "blindspot" | "conformance_gap";
  cockpitCategory: MetricCategory;
  elasticOpsVertex?: ElasticOpsVertex;
  severity: "low" | "medium" | "high" | "critical";
  narrative: string;
  casesAffected: number;
  annualValueLeak: number;
  valueLeakBreakdown: string;
  deviationType: "skip" | "loop" | "out_of_order" | "extra_step";
  deviationStep: string;
  rootCause: string;
  recommendation: string;
  recommendedAPAAgent?: string;
  relatedMetricKeys?: string[];
};

type ElasticOpsBreakdown = {
  totalAnnualValueLeak: number;
  findingCount: number;
  mainFactors: string[];
  summary: string;
};

type FindingsResult = {
  generatedAt: string;
  summary: string;
  totalAnnualValueLeak: number;
  elasticOps?: {
    growth: ElasticOpsBreakdown;
    efficiency: ElasticOpsBreakdown;
    control: ElasticOpsBreakdown;
  };
  findings: Finding[];
};

const ELASTIC_OPS_META: Record<ElasticOpsVertex, { label: string; tag: string; color: string; bg: string; icon: string }> = {
  growth:     { label: "Growth",     tag: "Revenue & adoption",     color: "#1A8F4F", bg: "rgba(38,188,113,0.06)",  icon: "↗" },
  efficiency: { label: "Efficiency", tag: "Operational cost",       color: "#1A5AFF", bg: "rgba(26,90,255,0.06)",   icon: "⚙" },
  control:    { label: "Control",    tag: "Risk & compliance",      color: "#C0392B", bg: "rgba(239,68,68,0.06)",   icon: "◆" },
};

const CATEGORY_META: Record<Finding["category"], { label: string; bg: string; text: string; border: string }> = {
  value_leak:       { label: "Value Leak",       bg: "rgba(245,158,11,0.08)", text: "#B07800", border: "rgba(245,158,11,0.2)" },
  cycle_pain:       { label: "Cycle Pain",       bg: "rgba(26,90,255,0.08)",  text: "#1A5AFF", border: "rgba(26,90,255,0.2)" },
  blindspot:        { label: "Blindspot",        bg: "rgba(168,85,247,0.08)", text: "#7C3AED", border: "rgba(168,85,247,0.2)" },
  conformance_gap:  { label: "Conformance Gap",  bg: "rgba(239,68,68,0.08)",  text: "#C0392B", border: "rgba(239,68,68,0.2)" },
};

const SEVERITY_DOT: Record<string, string> = {
  low: "#9AAABB", medium: "#1A5AFF", high: "#FFAC09", critical: "#EF4444",
};

interface Props {
  engagementId: string;
  processId: string;
}

export function FindingsSection({ engagementId, processId }: Props) {
  const [result, setResult] = useState<FindingsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRank, setExpandedRank] = useState<number | null>(1);
  // True when we're showing cached findings (vs freshly generated this session).
  const [fromCache, setFromCache] = useState(false);

  // Load cached findings on mount; auto-generate once if nothing is cached.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/engagements/${engagementId}/processes/${processId}/findings`);
        if (!r.ok) throw new Error("Failed to load findings");
        const data = await r.json() as { cached: boolean; result?: FindingsResult; generatedAt?: string };
        if (cancelled) return;

        if (data.cached && data.result) {
          setResult(data.result);
          setFromCache(true);
          setLoading(false);
        } else {
          // First visit — auto-generate once.
          await generateInternal({ silent: false });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, processId]);

  async function generateInternal({ silent }: { silent: boolean }) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}/findings`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Findings failed");
      setResult(json as FindingsResult);
      setFromCache(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const generate = () => generateInternal({ silent: false });

  return (
    <div style={{ borderRadius: 12, border: "1px solid #DDE3EC", overflow: "hidden", background: "#fff" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: "rgba(38,188,113,0.04)", borderBottom: "1px solid rgba(38,188,113,0.15)",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, flexShrink: 0,
          background: result ? "rgba(38,188,113,0.15)" : "rgba(255,172,9,0.1)",
          color: result ? "#1A8F4F" : "#B07800",
        }}>
          {result ? "✓" : "5"}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C6E84", padding: "3px 8px", borderRadius: 4, background: "#fff", border: "1px solid #EEF2F8" }}>
          Stage 5 of 5 — Findings &amp; Value Leak
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: result ? "#1A8F4F" : "#5C6E84", flex: 1 }}>
          {result
            ? `${result.findings.length} findings · £${(result.totalAnnualValueLeak / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k annual leak${fromCache ? " · cached" : ""}`
            : (loading ? "Generating findings…" : "AI-generated findings ranked by value impact")}
        </span>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 20,
            cursor: loading ? "wait" : "pointer",
            background: loading ? "#DDE3EC" : "linear-gradient(135deg,#1A5AFF,#26BC71)",
            color: loading ? "#9AAABB" : "#fff",
            border: "none",
            display: "flex", alignItems: "center", gap: 6,
          }}>
          {loading ? (
            <>
              <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              Analysing…
            </>
          ) : `✦ Regenerate`}
        </button>
      </div>

      <div style={{ padding: "16px" }}>
        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 11, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#C0392B" }}>
            {error}
          </div>
        )}

        {!result && loading && (
          <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5 }}>
            Generating your first findings report — Claude is analysing variants, deviations, captured metrics, and the country / process repository to produce a ranked report with quantified £/$ value leak. Cached after first generation; <strong>Regenerate</strong> any time for a fresh narrative.
          </div>
        )}
        {!result && !loading && !error && (
          <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5 }}>
            No findings yet. Click <strong>Regenerate</strong> to produce a fresh report.
          </div>
        )}

        {result && (
          <>
            {/* Executive summary banner — full width */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#FAFBFC", border: "1px solid #EEF2F8", marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Executive Summary</div>
                <div style={{ fontSize: 12, color: "#001C3D", lineHeight: 1.5 }}>{result.summary}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right", paddingLeft: 14, borderLeft: "1px solid #EEF2F8" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total annual leak</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#001C3D", lineHeight: 1, fontFamily: "monospace" }}>
                  £{(result.totalAnnualValueLeak / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k
                </div>
                <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 2 }}>across {result.findings.length} findings</div>
              </div>
            </div>

            {/* Elastic Operations triangle — Growth · Efficiency · Control */}
            {result.elasticOps && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
                {(["growth", "efficiency", "control"] as ElasticOpsVertex[]).map((v) => {
                  const data = result.elasticOps![v];
                  const meta = ELASTIC_OPS_META[v];
                  const pct = result.totalAnnualValueLeak > 0 ? (data.totalAnnualValueLeak / result.totalAnnualValueLeak) * 100 : 0;
                  return (
                    <div key={v} style={{
                      padding: "14px 16px", borderRadius: 12,
                      background: meta.bg, border: `1px solid ${meta.color}30`,
                      display: "flex", flexDirection: "column", gap: 10,
                    }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 18, color: meta.color, lineHeight: 1, fontWeight: 800 }}>{meta.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: meta.color, letterSpacing: "0.02em", textTransform: "uppercase" }}>{meta.label}</div>
                          <div style={{ fontSize: 9, color: "#9AAABB", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 1 }}>{meta.tag}</div>
                        </div>
                      </div>

                      {/* Big number */}
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#001C3D", lineHeight: 1, fontFamily: "monospace" }}>
                          £{(data.totalAnnualValueLeak / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k
                        </div>
                        <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 3 }}>
                          {pct.toFixed(0)}% of total · {data.findingCount} finding{data.findingCount !== 1 ? "s" : ""}
                        </div>
                      </div>

                      {/* Summary */}
                      {data.summary && (
                        <div style={{ fontSize: 11, color: "#374D6C", lineHeight: 1.5 }}>
                          {data.summary}
                        </div>
                      )}

                      {/* Main factors */}
                      {data.mainFactors && data.mainFactors.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Main factors</div>
                          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, color: "#374D6C", lineHeight: 1.5 }}>
                            {data.mainFactors.map((f, i) => (
                              <li key={i} style={{ marginBottom: 2 }}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Findings grouped by cockpit category */}
            {(() => {
              // Group findings by cockpit category
              const byCategory = new Map<MetricCategory, Finding[]>();
              for (const f of result.findings) {
                const cat = f.cockpitCategory ?? "outcome";
                if (!byCategory.has(cat)) byCategory.set(cat, []);
                byCategory.get(cat)!.push(f);
              }

              // Order: highest total annual leak first
              const sortedCategories = Array.from(byCategory.entries())
                .map(([cat, list]) => ({ cat, list, total: list.reduce((s, f) => s + f.annualValueLeak, 0) }))
                .sort((a, b) => b.total - a.total);

              return sortedCategories.map(({ cat, list, total }) => {
                const cm = METRIC_CATEGORY_META[cat];
                return (
                  <div key={cat} style={{ marginBottom: 18 }}>
                    {/* Category header */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: cm.text, textTransform: "uppercase", letterSpacing: "0.08em",
                        padding: "3px 9px", background: cm.bg, borderRadius: 4,
                      }}>
                        {cm.label}
                      </span>
                      <span style={{ fontSize: 11, color: "#9AAABB" }}>
                        {list.length} finding{list.length !== 1 ? "s" : ""}
                      </span>
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: cm.text, fontFamily: "monospace" }}>
                        £{(total / 1000).toFixed(0)}k / yr
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {list.map((f) => {
                        const fm = CATEGORY_META[f.category] ?? CATEGORY_META.value_leak;
                        const isExpanded = expandedRank === f.rank;
                        return (
                          <div key={f.rank} style={{ borderRadius: 10, border: "1px solid #DDE3EC", overflow: "hidden", background: "#fff" }}>
                            <button
                              onClick={() => setExpandedRank(isExpanded ? null : f.rank)}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", border: "none", cursor: "pointer", textAlign: "left" }}>
                              <span style={{
                                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, fontWeight: 800, color: cm.text, background: cm.bg, border: `1px solid ${cm.text}30`,
                              }}>
                                #{f.rank}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#001C3D" }}>{f.title}</span>
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: fm.bg, color: fm.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    {fm.label}
                                  </span>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_DOT[f.severity] }} />
                                    {f.severity}
                                  </span>
                                </div>
                                <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 2 }}>
                                  {f.casesAffected.toLocaleString()} cases · {f.deviationType.replace("_", " ")} on {f.deviationStep}
                                </div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: cm.text, fontFamily: "monospace" }}>
                                  £{(f.annualValueLeak / 1000).toFixed(0)}k
                                </div>
                                <div style={{ fontSize: 9, color: "#9AAABB" }}>per year</div>
                              </div>
                              <svg width="14" height="14" fill="none" stroke="#9AAABB" viewBox="0 0 24 24"
                                style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {isExpanded && (
                              <div style={{ padding: "12px 14px", background: "#FAFBFC", borderTop: "1px solid #EEF2F8" }}>
                                <div style={{ fontSize: 12, color: "#374D6C", lineHeight: 1.6, marginBottom: 12 }}>{f.narrative}</div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                  <Field label="Root Cause">{f.rootCause}</Field>
                                  <Field label="Value Calculation"><code style={{ fontSize: 11, fontFamily: "monospace", background: "#fff", padding: "2px 4px", borderRadius: 3, border: "1px solid #EEF2F8" }}>{f.valueLeakBreakdown}</code></Field>
                                </div>

                                <Field label="Recommendation">{f.recommendation}</Field>

                                {f.relatedMetricKeys && f.relatedMetricKeys.length > 0 && (
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Related cockpit metrics</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {f.relatedMetricKeys.map((k) => (
                                        <code key={k} style={{ fontSize: 10, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3, background: "#fff", color: "#5C6E84", border: "1px solid #EEF2F8" }}>{k}</code>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {f.recommendedAPAAgent && (
                                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(26,90,255,0.04)", border: "1px solid rgba(26,90,255,0.15)", fontSize: 11, color: "#1A5AFF" }}>
                                    → Recommended APA agent: <strong>{f.recommendedAPAAgent}</strong>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}

            <div style={{ marginTop: 10, fontSize: 10, color: "#9AAABB", textAlign: "right" }}>
              Generated {new Date(result.generatedAt).toLocaleString()}
              {fromCache && <span style={{ marginLeft: 6, color: "#1A5AFF", fontWeight: 700 }}>· cached</span>}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#374D6C", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
