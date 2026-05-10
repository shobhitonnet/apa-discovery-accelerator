/**
 * Rich metric definition used by ProcessTemplate.metricDefinitions and
 * (later) by engagement-level metric overrides.
 *
 * Three sources:
 * - direct:   computed from the event log (real, auditable)
 * - inferred: computed from direct metrics × repository values (e.g. cost = hours × FTE rate)
 * - assumed:  consultant input (defaults defined here, overridable per engagement)
 *
 * Eight categories — used to structure the Stage 5 findings narrative.
 */

export type MetricCategory =
  | "time" | "volume" | "quality" | "outcome"
  | "cost" | "cx" | "workforce" | "compliance";

export type MetricSource = "direct" | "inferred" | "assumed";

export type MetricDefinition = {
  key: string;                 // stable identifier (snake_case)
  label: string;               // display label
  category: MetricCategory;
  source: MetricSource;
  unit: string;                // "days" | "%" | "GBP/case" | "count" | "ratio" | etc.
  description: string;         // short explanation for the consultant

  // Direct-only: how the metric is computed from event log (informational; engine implements)
  computation?: string;

  // Inferred-only: which metric keys / coefficient keys feed into this
  dependencies?: string[];     // e.g. ["lead_time", "avg_handling_time", "fte_ops_hourly_rate"]
  formula?: string;            // human-readable formula

  // Assumed-only: starter value + how to source it
  defaultValue?: number;
  sourceHint?: string;         // "Pull from client survey if available, else industry avg 7.2"

  // Targets (red / amber / green). Direction tells us which side is "good".
  goodThreshold?: number;      // value at or beyond this is green
  poorThreshold?: number;      // value at or beyond this is red
  direction?: "lower_is_better" | "higher_is_better";

  required?: boolean;          // engagement must have a value for this
};

export const METRIC_CATEGORY_META: Record<MetricCategory, { label: string; bg: string; text: string; description: string }> = {
  time:        { label: "Time",        bg: "rgba(26,90,255,0.08)",  text: "#1A5AFF", description: "Lead time, processing time, wait time, throughput" },
  volume:      { label: "Volume",      bg: "rgba(6,182,212,0.08)",  text: "#06B6D4", description: "Cases per period, channels, segments" },
  quality:     { label: "Quality",     bg: "rgba(255,172,9,0.08)",  text: "#B07800", description: "Rework, STP rate, conformance, variants" },
  outcome:     { label: "Outcome",     bg: "rgba(46,204,113,0.08)", text: "#1A8F4F", description: "Approval, decline, completion, abandonment" },
  cost:        { label: "Cost",        bg: "rgba(245,158,11,0.08)", text: "#F97316", description: "Cost per case, FTE hours, step cost" },
  cx:          { label: "CX",          bg: "rgba(168,85,247,0.08)", text: "#8B5CF6", description: "Touchpoints, drop-off, customer effort proxies" },
  workforce:   { label: "Workforce",   bg: "rgba(20,184,166,0.08)", text: "#14B8A6", description: "Handling time per role, throughput per FTE" },
  compliance:  { label: "Compliance",  bg: "rgba(239,68,68,0.08)",  text: "#C0392B", description: "KYC freshness, audit flags, gate failures" },
};

export const METRIC_SOURCE_META: Record<MetricSource, { label: string; bg: string; text: string; description: string }> = {
  direct:   { label: "Direct",   bg: "rgba(46,204,113,0.1)",  text: "#1A8F4F", description: "Auto-computed from the event log" },
  inferred: { label: "Inferred", bg: "rgba(26,90,255,0.1)",   text: "#1A5AFF", description: "Computed from direct metrics × repository values" },
  assumed:  { label: "Assumed",  bg: "rgba(168,85,247,0.1)",  text: "#8B5CF6", description: "Consultant input — defaults set in template, overridable per engagement" },
};
