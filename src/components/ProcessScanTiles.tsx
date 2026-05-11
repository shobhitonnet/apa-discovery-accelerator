"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  engagementId: string;
  processId: string;
  hasProcessMap: boolean;
  hasDataRequest: boolean;
  ingestionMappedCount?: number;
  ingestionTotalCount?: number;
  hasActivityTable?: boolean;
}

type StepStatus = "done" | "next" | "locked";

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 4,
        background: "rgba(38,188,113,0.12)", color: "#1F8F5A",
        letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        <span style={{ fontSize: 11, lineHeight: 1 }}>✓</span> Done
      </span>
    );
  }
  if (status === "next") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 4,
        background: "rgba(255,172,9,0.15)", color: "#B07800",
        letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        <span style={{ fontSize: 11, lineHeight: 1, fontWeight: 900 }}>!</span> Next to do
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 4,
      background: "#F5F7F9", color: "#9AAABB",
      letterSpacing: "0.08em", textTransform: "uppercase",
    }}>
      <span style={{ fontSize: 10, lineHeight: 1 }}>◔</span> Coming soon
    </span>
  );
}

function StepTile({
  stepNumber, label, sublabel, description, status, href, accentColor,
}: {
  stepNumber: number;
  label: string;
  sublabel: string;
  description: string;
  status: StepStatus;
  href: string;
  accentColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = status !== "locked";

  const card = (
    <div
      onMouseEnter={() => clickable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: status === "locked" ? "#FAFBFC" : "#fff",
        borderRadius: 14,
        padding: "20px 22px",
        border: status === "next"
          ? `1.5px solid ${accentColor}80`
          : hovered && clickable
            ? `1.5px solid ${accentColor}`
            : "1.5px solid #DDE3EC",
        boxShadow: hovered && clickable ? `0 4px 20px ${accentColor}1f` : "none",
        transform: hovered && clickable ? "translateY(-2px)" : "none",
        transition: "all 0.15s",
        cursor: clickable ? "pointer" : "default",
        minHeight: 210,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: status === "locked" ? 0.78 : 1,
      }}
    >
      <div>
        {/* Top row: step number label + status badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 800,
            color: status === "locked" ? "#9AAABB" : accentColor,
            letterSpacing: "0.14em", textTransform: "uppercase",
            padding: "3px 8px", borderRadius: 4,
            background: status === "locked" ? "transparent" : `${accentColor}12`,
          }}>
            Step {stepNumber}
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Main title — BIG uppercase bold */}
        <div style={{
          fontSize: 18, fontWeight: 800,
          color: status === "locked" ? "#5C6E84" : "#091C35",
          letterSpacing: "0.005em",
          textTransform: "uppercase",
          marginBottom: 4,
          lineHeight: 1.2,
        }}>
          {label}
        </div>

        {/* Subtitle in parens */}
        <div style={{
          fontSize: 12, color: "#9AAABB", fontWeight: 400,
          marginBottom: 12, lineHeight: 1.4,
        }}>
          ({sublabel})
        </div>

        {/* Description */}
        <div style={{ fontSize: 12, color: status === "locked" ? "#9AAABB" : "#5C6E84", lineHeight: 1.55 }}>
          {description}
        </div>
      </div>

      {/* Bottom CTA */}
      {clickable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 18,
          fontSize: 12, fontWeight: 700, color: accentColor,
        }}>
          {status === "done" ? "Review" : "Get started"} →
        </div>
      )}
    </div>
  );

  if (clickable) {
    return <Link href={href} style={{ textDecoration: "none" }}>{card}</Link>;
  }
  return card;
}

export function ProcessScanTiles({
  engagementId, processId, hasProcessMap, hasDataRequest,
  hasActivityTable = false,
}: Props) {
  const step1Done = hasProcessMap && hasDataRequest;
  const step1Status: StepStatus = step1Done ? "done" : "next";

  const step2Status: StepStatus = hasActivityTable
    ? "done"
    : step1Done
      ? "next"
      : "locked";

  const step3Status: StepStatus = "locked";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      <StepTile
        stepNumber={1}
        label="Setup Process"
        sublabel="Process Model and Data Request"
        description="Map the process steps, assign systems and actors, then generate a MoSCoW-prioritised data request for the client."
        status={step1Status}
        href={`/engagements/${engagementId}/processes/${processId}/discover`}
        accentColor="#1A5AFF"
      />

      <StepTile
        stepNumber={2}
        label="Create Digital Twin"
        sublabel="Ingestion and Digital Twin"
        description={
          hasActivityTable
            ? "Digital twin built. Explore variants, the process cockpit, deviations, and findings."
            : "Upload the client's CSV exports, map them to the data request, then build the digital twin of the actual process."
        }
        status={step2Status}
        href={`/engagements/${engagementId}/processes/${processId}/ingest`}
        accentColor="#001C3D"
      />

      <StepTile
        stepNumber={3}
        label="Simulate APA"
        sublabel="APA Simulation and Value Recovery"
        description="Run AI-powered automation simulations against the digital twin and quantify the value opportunity for the client."
        status={step3Status}
        href="#"
        accentColor="#2ECC71"
      />
    </div>
  );
}
