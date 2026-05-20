"use client";

import { useState } from "react";
import type { VariantsSummary } from "@/lib/variants";

interface Props {
  variants: VariantsSummary;
  initialRank?: number;
  onClose: () => void;
}

/**
 * Case Simulator — focused popup that walks through one variant's case journey.
 *
 * Left:  vertical pipe diagram of the variant's activities. Happy-path steps
 *        are blue, off-path / repeat-visit steps are red ("exceptions"). For
 *        truncated variants (declined / withdrawn / abandoned) the terminus
 *        is rendered as a red EXIT marker instead of the green END dot.
 *
 * Right: at-a-glance metrics for the selected variant — case count, cycle
 *        time, human touch time, cycle efficiency, cost per case, steps.
 *        Touch time is summed from per-activity estimates so long-wait
 *        processes (disputes, paper-mail dispatch) don't get over-estimated
 *        by a flat fraction of wall-clock.
 */
export function CaseSimulator({ variants, initialRank = 1, onClose }: Props) {
  const [selectedRank, setSelectedRank] = useState(initialRank);
  const [playKey, setPlayKey] = useState(0);

  const selected = variants.topVariants.find((v) => v.rank === selectedRank);
  if (!selected) return null;

  const isHappyPath = selectedRank === 1;
  const happyPath = variants.topVariants[0]?.activities ?? [];
  const happyPathSet = new Set(happyPath);
  const happyPathEnd = happyPath[happyPath.length - 1];

  // Tag each step in the variant: 'happy' if it's a first visit to a happy-path
  // activity; 'exception' for off-path activities or repeat visits (loops).
  type Step = { activity: string; type: "happy" | "exception"; index: number };
  const steps: Step[] = [];
  const visitCount = new Map<string, number>();
  selected.activities.forEach((act, i) => {
    const visit = (visitCount.get(act) ?? 0) + 1;
    visitCount.set(act, visit);
    const isHappy = happyPathSet.has(act) && visit === 1;
    steps.push({ activity: act, type: isHappy ? "happy" : "exception", index: i });
  });

  // Truncation = case exited before reaching the canonical last activity.
  const lastVariantStep = selected.activities[selected.activities.length - 1];
  const isTruncated = selected.activities.length > 0
    && selected.activities.length < happyPath.length
    && lastVariantStep !== happyPathEnd;

  const exceptionCount = steps.filter((s) => s.type === "exception").length;
  const isExceptionVariant = !isHappyPath && (exceptionCount > 0 || isTruncated);
  const cycleHours = selected.avgCycleHours;
  const cycleDays = cycleHours / 24;

  // Human touch minutes per activity — generic banking-ops estimates. Falls
  // back to 8 min for unmapped activities. Summing step-level touch times
  // avoids the trap of "touch = 18% of cycle" which over-counts on long-wait
  // processes (chargeback cycles, paper-mail dispatch, Reg E waits).
  const STEP_TOUCH_MIN: Record<string, number> = {
    "Receive Dispute Notification": 3,
    "Capture Dispute Details": 15,
    "Upload Supporting Documents": 5,
    "Validate Member Identity": 5,
    "Verify Transaction Detail": 10,
    "Assess Reg E Eligibility": 10,
    "Issue Provisional Credit": 5,
    "Submit Chargeback to Network": 10,
    "Receive Merchant Evidence": 0,
    "Review Final Determination": 30,
    "Notify Member of Outcome": 5,
    "Mail Outcome Letter": 8,
    "Close Dispute Case": 3,
    // Onboarding-style steps for generic processes
    "Submit Application": 5,
    "Verify Identity": 5,
    "KYC Screening": 10,
    "Credit Decision": 15,
    "Account Provisioning": 5,
    // Off-path / exception activities
    "Compliance Officer Review": 30,
    "Document Rework": 15,
    "EDD Escalation": 25,
    "Manual Underwriting": 20,
    "Reverse Provisional Credit": 5,
  };
  const DEFAULT_TOUCH_MIN = 8;
  const touchMinutes = selected.activities.reduce(
    (sum, act) => sum + (STEP_TOUCH_MIN[act] ?? DEFAULT_TOUCH_MIN),
    0,
  );
  const touchHours = touchMinutes / 60;
  const cycleEfficiency = cycleHours > 0 ? (touchHours / cycleHours) * 100 : 0;
  const fteRate = 48;
  const costPerCase = touchHours * fteRate;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(9,28,53,0.6)",
        backdropFilter: "blur(3px)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 92vw)", height: "min(760px, 92vh)",
          background: "#fff", borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #DDE3EC", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#5C6E84", letterSpacing: "0.1em", textTransform: "uppercase" }}>Case Simulator</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#091C35", marginTop: 2 }}>
              {isHappyPath ? "Happy path" : `Deviation #${selectedRank}`} — {selected.caseCount.toLocaleString()} cases ({selected.pct.toFixed(1)}%)
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <select
            value={selectedRank}
            onChange={(e) => { setSelectedRank(Number(e.target.value)); setPlayKey((k) => k + 1); }}
            style={{ padding: "8px 12px", border: "1px solid #DDE3EC", borderRadius: 8, fontSize: 12, background: "#fff", cursor: "pointer", color: "#091C35", fontWeight: 600 }}
          >
            {variants.topVariants.map((v) => (
              <option key={v.rank} value={v.rank}>
                #{v.rank} {v.rank === 1 ? "Happy Path" : "Deviation"} · {v.caseCount.toLocaleString()} · {v.pct.toFixed(1)}%
              </option>
            ))}
          </select>
          <button
            onClick={() => setPlayKey((k) => k + 1)}
            style={{ padding: "8px 14px", background: "#1A5AFF", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            ▶ Replay
          </button>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "1px solid #DDE3EC", fontSize: 18, fontWeight: 700, cursor: "pointer", color: "#5C6E84" }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Body — 2-column: pipe diagram left, metrics right */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Left: vertical pipe diagram */}
          <div style={{ flex: 1, padding: "20px 28px", overflow: "auto", background: "#FAFBFC" }}>
            <PipeDiagram
              steps={steps}
              playKey={playKey}
              isTruncated={isTruncated}
              skippedStepCount={happyPath.length - selected.activities.length}
            />
          </div>

          {/* Right: metrics callout */}
          <div style={{ width: 320, padding: 24, borderLeft: "1px solid #DDE3EC", background: "#fff", overflow: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#5C6E84", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
              Key Metrics
            </div>

            <MetricCard
              label="Cases on this journey"
              value={selected.caseCount.toLocaleString()}
              sub={`${selected.pct.toFixed(1)}% of all ${variants.totalCases.toLocaleString()} cases`}
            />
            <MetricCard
              label="Avg cycle time"
              value={cycleDays >= 1 ? `${cycleDays.toFixed(1)} d` : `${cycleHours.toFixed(1)} hr`}
              sub={cycleDays >= 1 ? `${cycleHours.toFixed(0)} hours total` : undefined}
            />
            <MetricCard
              label="Human touch time"
              value={touchHours >= 1 ? `${touchHours.toFixed(1)} hr` : `${touchMinutes} min`}
              sub={`${touchMinutes} min active work per case`}
            />
            <MetricCard
              label="Cycle efficiency"
              value={cycleEfficiency < 1 ? `${cycleEfficiency.toFixed(1)}%` : `${cycleEfficiency.toFixed(0)}%`}
              sub="touch / wall-clock"
            />
            <MetricCard
              label="Cost per case"
              value={`$${Math.round(costPerCase).toLocaleString()}`}
              sub={`${touchHours.toFixed(2)} hr × $${fteRate}/hr`}
            />
            <MetricCard
              label="Steps in journey"
              value={`${selected.activities.length}`}
              sub={
                isHappyPath
                  ? "Canonical happy path (all steps)"
                  : isTruncated && exceptionCount === 0
                  ? `Exited early · ${happyPath.length - selected.activities.length} step${happyPath.length - selected.activities.length === 1 ? "" : "s"} skipped`
                  : exceptionCount > 0
                  ? `${exceptionCount} exception step${exceptionCount === 1 ? "" : "s"}`
                  : undefined
              }
              statusColor={isExceptionVariant ? "#B07800" : undefined}
            />
          </div>
        </div>

        {/* Footer caption */}
        <div style={{
          padding: "10px 20px", borderTop: "1px solid #DDE3EC", background: "#FAFBFC",
          fontSize: 11, color: "#5C6E84", lineHeight: 1.4,
        }}>
          The case ball flows through every step in this variant&apos;s sequence.
          <span style={{ color: "#1A5AFF", fontWeight: 700 }}> Blue steps</span> are on the canonical happy path;
          <span style={{ color: "#C0392B", fontWeight: 700 }}> red steps</span> are exceptions (off-path activities or loops).
          A <span style={{ color: "#C0392B", fontWeight: 700 }}>red EXIT endpoint</span> means the case exited early (declined / withdrawn / abandoned).
        </div>
      </div>
    </div>
  );
}

// ─── Pipe diagram + animated case balls ──────────────────────────────────────

function PipeDiagram({
  steps, playKey, isTruncated, skippedStepCount,
}: {
  steps: Array<{ activity: string; type: "happy" | "exception"; index: number }>;
  playKey: number;
  isTruncated: boolean;
  skippedStepCount: number;
}) {
  const STEP_GAP = 56;
  const TOP_PAD = 30;
  const stepCount = steps.length;
  const height = TOP_PAD + stepCount * STEP_GAP + 70; // room for END marker

  // Animation: ball y travels from start to end over the diagram. Three staggered
  // balls give a sense of throughput.
  const ANIM_DURATION = 6;          // seconds per ball
  const STAGGER = 1.5;              // seconds between balls
  const ballY0 = TOP_PAD;
  const ballY1 = TOP_PAD + stepCount * STEP_GAP;
  const SPINE_X = 32;

  return (
    <svg
      key={playKey}
      width="100%"
      height={height}
      viewBox={`0 0 360 ${height}`}
      preserveAspectRatio="xMinYMin meet"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="cs-ball-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3D7BFF" />
          <stop offset="100%" stopColor="#1A5AFF" />
        </linearGradient>
      </defs>

      {/* START label */}
      <text x={SPINE_X + 20} y={TOP_PAD - 12} fontSize={10} fontWeight={800} fill="#5C6E84" letterSpacing={1}>START</text>
      <circle cx={SPINE_X} cy={TOP_PAD - 6} r={6} fill="#1A5AFF" />

      {/* Spine line */}
      <line x1={SPINE_X} y1={TOP_PAD} x2={SPINE_X} y2={ballY1} stroke="#DDE3EC" strokeWidth={2} />

      {/* Steps */}
      {steps.map((s, i) => {
        const y = TOP_PAD + (i + 1) * STEP_GAP - STEP_GAP / 2;
        const color = s.type === "happy" ? "#1A5AFF" : "#C0392B";
        const bg = s.type === "happy" ? "rgba(26,90,255,0.08)" : "rgba(192,57,43,0.08)";
        return (
          <g key={`${s.index}-${s.activity}`}>
            <circle cx={SPINE_X} cy={y} r={7} fill="#fff" stroke={color} strokeWidth={2.5} />
            <text x={SPINE_X + 20} y={y + 4} fontSize={12} fontWeight={600} fill="#091C35">
              {s.activity}
            </text>
            {s.type === "exception" && (
              <>
                <rect x={SPINE_X + 20} y={y + 8} rx={3} ry={3} width={70} height={14} fill={bg} />
                <text x={SPINE_X + 24} y={y + 18} fontSize={9} fontWeight={800} fill={color} letterSpacing={0.5}>
                  EXCEPTION
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* END / EXIT marker */}
      {isTruncated ? (
        <>
          <circle cx={SPINE_X} cy={ballY1 + 16} r={9} fill="#C0392B" stroke="#fff" strokeWidth={2} />
          <text x={SPINE_X} y={ballY1 + 20} fontSize={11} fontWeight={800} fill="#fff" textAnchor="middle">✕</text>
          <text x={SPINE_X + 20} y={ballY1 + 21} fontSize={11} fontWeight={800} fill="#C0392B" letterSpacing={1}>
            CASE EXITED
          </text>
          {skippedStepCount > 0 && (
            <text x={SPINE_X + 20} y={ballY1 + 36} fontSize={10} fill="#5C6E84">
              {skippedStepCount} happy-path step{skippedStepCount === 1 ? "" : "s"} skipped
            </text>
          )}
        </>
      ) : (
        <>
          <circle cx={SPINE_X} cy={ballY1 + 16} r={8} fill="#26BC71" />
          <text x={SPINE_X + 20} y={ballY1 + 21} fontSize={11} fontWeight={800} fill="#1A8F4F" letterSpacing={1}>END</text>
        </>
      )}

      {/* Animated case balls */}
      {[0, 1, 2].map((i) => (
        <circle key={`ball-${playKey}-${i}`} cx={SPINE_X} cy={ballY0} r={5} fill="url(#cs-ball-gradient)">
          <animate
            attributeName="cy"
            from={ballY0}
            to={ballY1}
            dur={`${ANIM_DURATION}s`}
            begin={`${i * STAGGER}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;1;0"
            keyTimes="0;0.05;0.5;0.95;1"
            dur={`${ANIM_DURATION}s`}
            begin={`${i * STAGGER}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

// ─── Metric card (right rail) ────────────────────────────────────────────────

function MetricCard({
  label, value, sub, statusColor,
}: { label: string; value: string; sub?: string; statusColor?: string }) {
  return (
    <div style={{ background: "#FAFBFC", border: "1px solid #EEF2F8", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "#5C6E84", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: statusColor ?? "#091C35", letterSpacing: "-0.02em", marginTop: 3, fontFeatureSettings: '"tnum"' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
