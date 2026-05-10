"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeviationPatternsList } from "@/components/admin/DeviationPatternsList";
import { MetricDefinitionsAdmin } from "@/components/admin/MetricDefinitionsAdmin";
import type { MetricDefinition } from "@/lib/metricTypes";

type Template = {
  id: string;
  processKey: string;
  version: number;
  name: string;
  description: string;
  isActive: boolean;
  lineOfBusiness: string;
  applicableInstTypes: string[];
  subProcesses: { key: string; label: string; description: string }[];
  metricDefinitions: MetricDefinition[];
  notes: string;
};

type Step = { id: string; label: string; order: number; description: string };
type System = { id: string; name: string; color: string; description: string };
type Actor = { id: string; name: string; color: string; description: string; type: string };
type Reason = {
  category: "legitimate" | "operational" | "compliance" | "data_quality";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  investigationHint: string;
  valueModel: string;
  apaAgent?: string;
};
type DeviationPattern = {
  id: string;
  patternKey: string;
  type: string;
  stepKeyword: string;
  reasons: Reason[];
};

interface Props {
  template: Template;
  steps: Step[];
  systems: System[];
  actors: Actor[];
  deviationPatterns: DeviationPattern[];
}

const ACTOR_TYPE_COLOR: Record<string, string> = {
  customer: "#3366FF", "front-office": "#26BC71", "back-office": "#FFAC09",
  operations: "#F97316", fraud: "#EF4444", compliance: "#06B6D4",
  external: "#8B5CF6", automated: "#64748B",
};

export function ProcessTemplateDetail({ template, steps, systems, actors, deviationPatterns }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<string>("");

  async function runProcessExplorerAgent() {
    if (!confirm(`Run the Process Explorer Agent for "${template.name}"? It will generate steps, actors, systems, and deviation patterns. Existing data is preserved (legacy library is appended; ProcessTemplate + DeviationPatterns upsert).`)) return;
    setGenerating(true);
    setGenStatus("Process Explorer Agent running…");
    try {
      const res = await fetch("/api/admin/generate-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName: template.name, processTemplate: template.processKey, save: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Generation failed");
      }
      const data = await res.json();
      const g = data.generated;
      setGenStatus(`Agent finished — ${g.steps.length} steps · ${g.actors.length} actors · ${g.systems.length} systems · ${g.deviationPatterns?.length ?? 0} deviation patterns`);
      setTimeout(() => router.refresh(), 1200);
    } catch (e) {
      setGenStatus(`Error: ${(e as Error).message}`);
    } finally {
      setTimeout(() => setGenerating(false), 1200);
    }
  }

  async function toggleActive() {
    await fetch(`/api/admin/process-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !template.isActive }),
    });
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header card */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em",
                background: template.isActive ? "rgba(38,188,113,0.12)" : "#F5F7F9",
                color: template.isActive ? "#1A8F4F" : "#9AAABB",
                border: `1px solid ${template.isActive ? "rgba(38,188,113,0.25)" : "#DDE3EC"}`,
              }}>
                {template.isActive ? "Active" : "Draft"}
              </span>
              <span style={{ fontSize: 10, color: "#9AAABB", fontFamily: "monospace" }}>
                {template.processKey} · v{template.version}
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#001C3D", margin: 0, letterSpacing: "-0.01em" }}>
              {template.name}
            </h1>
            {template.description && (
              <p style={{ fontSize: 13, color: "#5C6E84", marginTop: 6, lineHeight: 1.5 }}>{template.description}</p>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: "#9AAABB" }}>
              {template.lineOfBusiness} ·{" "}
              {template.applicableInstTypes.length > 0
                ? template.applicableInstTypes.join(", ")
                : "all institution types"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={toggleActive}
              style={{
                fontSize: 11, fontWeight: 700, padding: "8px 16px", borderRadius: 20, cursor: "pointer",
                background: template.isActive ? "#F5F7F9" : "#1A8F4F",
                color: template.isActive ? "#5C6E84" : "#fff",
                border: template.isActive ? "1px solid #DDE3EC" : "none",
              }}>
              {template.isActive ? "Deactivate" : "Activate"}
            </button>
            <button onClick={runProcessExplorerAgent} disabled={generating}
              style={{
                fontSize: 11, fontWeight: 700, padding: "8px 16px", borderRadius: 20,
                cursor: generating ? "wait" : "pointer",
                background: generating ? "#DDE3EC" : "linear-gradient(135deg,#1A5AFF,#8B5CF6)",
                color: generating ? "#9AAABB" : "#fff", border: "none",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              {generating ? (
                <>
                  <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  Running…
                </>
              ) : "✦ Process Explorer Agent"}
            </button>
          </div>
        </div>

        {genStatus && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(26,90,255,0.06)", border: "1px solid rgba(26,90,255,0.18)", color: "#1A5AFF", fontSize: 11, fontWeight: 600 }}>
            {genStatus}
          </div>
        )}
      </div>

      {/* Steps */}
      <Section title="Steps" count={steps.length} description={`Process steps in execution order. AI generation populates this list automatically.`}>
        {steps.length === 0 ? (
          <Empty hint="No steps yet. Click ✦ Generate with AI above to populate." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {steps.map((s, i) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 12, padding: "10px 12px", borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF2F8" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9AAABB", fontFamily: "monospace", textAlign: "right" }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#001C3D" }}>{s.label}</div>
                  {s.description && <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 2, lineHeight: 1.5 }}>{s.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Systems */}
      <Section title="Systems" count={systems.length} description="Application systems involved in this process.">
        {systems.length === 0 ? (
          <Empty hint="No systems linked to this process." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {systems.map((sys) => (
              <div key={sys.id} style={{ padding: "10px 12px", borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF2F8", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: sys.color, marginTop: 4, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D" }}>{sys.name}</div>
                  {sys.description && <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 2, lineHeight: 1.45 }}>{sys.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Actors */}
      <Section title="Actors" count={actors.length} description="Banking roles + automated actors. Actors are global — not bound to a specific process — but listed here for context.">
        {actors.length === 0 ? (
          <Empty hint="No actors yet." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {actors.map((a) => {
              const tc = ACTOR_TYPE_COLOR[a.type] ?? "#64748B";
              return (
                <div key={a.id} style={{ padding: "10px 12px", borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF2F8", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: tc, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>
                      {a.type}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Deviation Library (process-scoped) */}
      <Section title="Deviation Library" count={deviationPatterns.length} description="Banking-specific reasons for skip / loop / out-of-order / extra-step deviations in this process. Stage 5 uses these as priors when generating findings.">
        {deviationPatterns.length === 0 ? (
          <Empty hint="No patterns yet. Click ✦ Process Explorer Agent above to generate them." />
        ) : (
          <DeviationPatternsList patterns={deviationPatterns} onChanged={() => router.refresh()} />
        )}
      </Section>

      {/* Sub-processes (capability rows) */}
      {template.subProcesses && template.subProcesses.length > 0 && (
        <Section title="Sub-processes (capability rows)" count={template.subProcesses.length} description="Sub-process keys used by the engagement capability assessment form (digital / partial / manual).">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {template.subProcesses.map((sp) => (
              <div key={sp.key} style={{ padding: "8px 12px", borderRadius: 8, background: "#FAFBFC", border: "1px solid #EEF2F8" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#001C3D" }}>{sp.label}</div>
                <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 1, fontFamily: "monospace" }}>{sp.key}</div>
                {sp.description && <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 4, lineHeight: 1.45 }}>{sp.description}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Metric definitions — full CRUD */}
      <Section title="Metric definitions" count={template.metricDefinitions?.length ?? 0} description="Direct metrics come from the event log; inferred metrics are computed from direct metrics × country values; assumed metrics are consultant inputs with defaults defined here. Engagements inherit these and override per engagement.">
        <MetricDefinitionsAdmin
          templateId={template.id}
          metrics={template.metricDefinitions ?? []}
          onChanged={() => router.refresh()}
        />
      </Section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Section({ title, count, description, children }: { title: string; count: number; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#9AAABB" }}>{count}</span>
      </div>
      <p style={{ fontSize: 11, color: "#9AAABB", margin: 0, marginBottom: 10 }}>{description}</p>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDE3EC", padding: 16 }}>{children}</div>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return <div style={{ padding: 16, textAlign: "center", color: "#9AAABB", fontSize: 12 }}>{hint}</div>;
}
