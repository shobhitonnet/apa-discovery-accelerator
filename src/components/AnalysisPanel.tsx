"use client";

import { useState } from "react";

interface AnalysisResult {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string | null;
  data: Record<string, unknown>;
}

interface CorrelationStats {
  systemsCorrelated: number;
  casesFound: number;
  eventsCreated: number;
}

interface AnalysisPanelProps {
  engagementId: string;
  uploadCount: number;
  initialResults: AnalysisResult[];
  initialEventCount: number;
}

type Stage = "idle" | "correlating" | "mining" | "opportunities" | "done" | "error";

const AUTOMATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "IDP Agent":                  { bg: "bg-accent-teal/10",  text: "text-accent-teal",  border: "border-accent-teal/20" },
  "Flow 2.0":                   { bg: "bg-accent-blue/10",  text: "text-accent-blue",  border: "border-accent-blue/20" },
  "Decision Automation":        { bg: "bg-accent-amber/10", text: "text-accent-amber", border: "border-accent-amber/20" },
  "Straight-Through Processing":{ bg: "bg-accent-green/10", text: "text-accent-green", border: "border-accent-green/20" },
};

const SEVERITY_COLORS: Record<string, string> = {
  high:   "bg-accent-red/10 text-accent-red",
  medium: "bg-accent-amber/10 text-accent-amber",
  low:    "bg-bg-secondary text-text-muted",
};

export function AnalysisPanel({
  engagementId,
  uploadCount,
  initialResults,
  initialEventCount,
}: AnalysisPanelProps) {
  const [stage, setStage] = useState<Stage>(
    initialResults.length > 0 ? "done" : "idle"
  );
  const [results, setResults] = useState<AnalysisResult[]>(initialResults);
  const [eventCount, setEventCount] = useState(initialEventCount);
  const [correlationStats, setCorrelationStats] = useState<CorrelationStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setError(null);
    setResults([]);

    // Stage 1: Correlate
    setStage("correlating");
    const corrRes = await fetch(`/api/engagements/${engagementId}/correlate`, {
      method: "POST",
    });
    if (!corrRes.ok) {
      const err = await corrRes.json();
      setError(err.error ?? "Correlation failed");
      setStage("error");
      return;
    }
    const corrData = await corrRes.json();
    setCorrelationStats(corrData.stats);
    setEventCount(corrData.stats.eventsCreated);

    // Stage 2: Mine
    setStage("mining");
    const analyzeRes = await fetch(`/api/engagements/${engagementId}/analyze`, {
      method: "POST",
    });
    if (!analyzeRes.ok) {
      const err = await analyzeRes.json();
      setError(err.error ?? "Analysis failed");
      setStage("error");
      return;
    }

    // Stage 3: Load results
    setStage("opportunities");
    const engRes = await fetch(`/api/engagements/${engagementId}`);
    const eng = await engRes.json();
    setResults(eng.analysisResults ?? []);
    setStage("done");
  }

  if (uploadCount === 0) return null;

  const cycleTimeResult = results.find((r) => r.type === "cycle_time");
  const darkZones = results.filter((r) => r.type === "dark_process");
  const reworkResults = results.filter((r) => r.type === "rework");
  const apaOpportunities = results.filter((r) => r.type === "apa_opportunity");

  return (
    <div className="mt-6 space-y-4">
      {/* Run Analysis button / progress */}
      {stage === "idle" && (
        <div className="rounded-lg border border-border bg-bg-card p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Ready to analyse</h3>
            <p className="text-xs text-text-muted mt-1">
              {uploadCount} file{uploadCount !== 1 ? "s" : ""} uploaded — correlate systems and mine for APA opportunities
            </p>
          </div>
          <button
            onClick={runAnalysis}
            className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run Analysis
          </button>
        </div>
      )}

      {(stage === "correlating" || stage === "mining" || stage === "opportunities") && (
        <div className="rounded-lg border border-border bg-bg-card p-6">
          <div className="space-y-3">
            <ProgressStep
              label="Correlating systems"
              sublabel="Linking cases across uploaded data sources"
              done={["mining", "opportunities", "done"].includes(stage)}
              active={stage === "correlating"}
            />
            <ProgressStep
              label="Mining process patterns"
              sublabel="Calculating cycle times, bottlenecks, dark zones"
              done={["opportunities", "done"].includes(stage)}
              active={stage === "mining"}
            />
            <ProgressStep
              label="Identifying APA opportunities"
              sublabel="Generating automation recommendations"
              done={["done"].includes(stage)}
              active={stage === "opportunities"}
            />
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="rounded-lg border border-accent-red/20 bg-accent-red/5 p-4">
          <p className="text-sm text-accent-red">{error}</p>
          <button
            onClick={runAnalysis}
            className="mt-3 text-xs text-accent-red underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {stage === "done" && results.length > 0 && (
        <>
          {/* Correlation summary bar */}
          {correlationStats && (
            <div className="rounded-lg border border-accent-green/20 bg-accent-green/5 px-5 py-3 flex items-center gap-6 text-xs text-accent-green">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {correlationStats.systemsCorrelated} systems correlated
              </span>
              <span>{correlationStats.casesFound} cases reconstructed</span>
              <span>{correlationStats.eventsCreated} events unified</span>
            </div>
          )}

          {!correlationStats && eventCount > 0 && (
            <div className="rounded-lg border border-accent-green/20 bg-accent-green/5 px-5 py-3 flex items-center gap-6 text-xs text-accent-green">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Analysis complete
              </span>
              <span>{eventCount} events in unified log</span>
            </div>
          )}

          {/* Cycle time */}
          {cycleTimeResult && (
            <CycleTimeCard result={cycleTimeResult} />
          )}

          {/* Dark process zones */}
          {darkZones.length > 0 && (
            <div className="rounded-lg border border-border bg-bg-card p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-accent-amber" />
                Dark Process Zones
                <span className="text-xs text-text-muted font-normal">— manual effort hidden between systems</span>
              </h3>
              <div className="space-y-3">
                {darkZones.map((zone) => {
                  const d = zone.data as {
                    fromActivity: string; toActivity: string;
                    fromSystem: string; toSystem: string;
                    gapHours: number; occurrences: number;
                  };
                  return (
                    <div key={zone.id} className="flex items-start gap-4 rounded-md border border-accent-amber/10 bg-accent-amber/5 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary">
                          {d.fromActivity} <span className="text-text-muted">→</span> {d.toActivity}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {d.fromSystem} → {d.toSystem} · {d.occurrences} case{d.occurrences !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-accent-amber whitespace-nowrap">
                        {d.gapHours}h avg gap
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rework loops */}
          {reworkResults.length > 0 && (
            <div className="rounded-lg border border-border bg-bg-card p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-accent-red" />
                Rework Loops
                <span className="text-xs text-text-muted font-normal">— steps repeated within a case</span>
              </h3>
              <div className="space-y-2">
                {reworkResults.map((r) => {
                  const d = r.data as { step: string; occurrences: number };
                  return (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-border bg-bg-secondary px-4 py-2.5">
                      <span className="text-xs text-text-primary">{d.step}</span>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${SEVERITY_COLORS[r.severity ?? "medium"]}`}>
                        {d.occurrences} case{d.occurrences !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* APA Opportunities */}
          {apaOpportunities.length > 0 && (
            <div className="rounded-lg border border-border bg-bg-card p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-accent-blue" />
                APA Automation Opportunities
                <span className="text-xs text-text-muted font-normal">— Backbase platform recommendations</span>
              </h3>
              <div className="space-y-3">
                {apaOpportunities.map((opp) => {
                  const d = opp.data as {
                    title: string; automationType: string; targetSteps: string[];
                    timeSavedHours: number; description: string;
                    businessImpact: string; complexity: string;
                  };
                  const colors = AUTOMATION_COLORS[d.automationType] ?? AUTOMATION_COLORS["Flow 2.0"];
                  return (
                    <div key={opp.id} className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${colors.text}`}>
                            {d.automationType}
                          </span>
                          <span className={`text-xs rounded-full px-2 py-0.5 ${SEVERITY_COLORS[opp.severity ?? "medium"]}`}>
                            {opp.severity} impact
                          </span>
                          <span className="text-xs text-text-muted">
                            complexity: {d.complexity}
                          </span>
                        </div>
                        {d.timeSavedHours > 0 && (
                          <span className={`text-sm font-semibold ${colors.text} whitespace-nowrap`}>
                            {d.timeSavedHours >= 24
                              ? `${Math.round(d.timeSavedHours / 24 * 10) / 10}d saved`
                              : `${d.timeSavedHours}h saved`}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-text-primary mb-1">{d.title}</h4>
                      <p className="text-xs text-text-secondary leading-relaxed">{d.description}</p>
                      <p className="text-xs text-text-muted mt-2 italic">{d.businessImpact}</p>
                      {d.targetSteps?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {d.targetSteps.map((step) => (
                            <span key={step} className="rounded px-1.5 py-0.5 text-xs bg-bg-secondary text-text-muted">
                              {step}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Re-run button */}
          <div className="flex justify-end">
            <button
              onClick={runAnalysis}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Re-run analysis
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ProgressStep({
  label, sublabel, active, done,
}: {
  label: string; sublabel: string; active: boolean; done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center">
        {done ? (
          <svg className="w-5 h-5 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : active ? (
          <svg className="w-4 h-4 text-accent-teal animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <div className="w-4 h-4 rounded-full border border-border" />
        )}
      </div>
      <div>
        <p className={`text-xs font-medium ${active ? "text-accent-teal" : done ? "text-text-secondary" : "text-text-muted"}`}>
          {label}
        </p>
        <p className="text-xs text-text-muted">{sublabel}</p>
      </div>
    </div>
  );
}

function CycleTimeCard({ result }: { result: AnalysisResult }) {
  const d = result.data as {
    avgCycleDays: number;
    totalCases: number;
    stepMetrics: Array<{ step: string; medianDays: number; medianHours: number; samples: number }>;
  };

  const maxDays = Math.max(...d.stepMetrics.map((s) => s.medianDays), 0.1);

  return (
    <div className="rounded-lg border border-border bg-bg-card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Process Cycle Times</h3>
          <p className="text-xs text-text-muted mt-0.5">{d.totalCases} cases analysed</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-text-primary">{d.avgCycleDays}d</p>
          <p className="text-xs text-text-muted">avg end-to-end</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {d.stepMetrics.slice(0, 8).map((step) => (
          <div key={step.step}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-secondary truncate max-w-[60%]">{step.step}</span>
              <span className="text-xs text-text-muted">
                {step.medianDays >= 1 ? `${step.medianDays}d` : `${step.medianHours}h`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-blue transition-all"
                style={{ width: `${Math.max((step.medianDays / maxDays) * 100, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
