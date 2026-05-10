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

function Tile1({ href, hasProcessMap, hasDataRequest }: { href: string; hasProcessMap: boolean; hasDataRequest: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#fff", borderRadius: 16, padding: "24px",
          border: hovered ? "1.5px solid #1A5AFF" : "1.5px solid #DDE3EC",
          boxShadow: hovered ? "0 4px 20px rgba(26,90,255,0.1)" : "none",
          transform: hovered ? "translateY(-2px)" : "none",
          transition: "all 0.15s", cursor: "pointer", minHeight: 200,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "rgba(26,90,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}>
            <svg width="18" height="18" fill="none" stroke="#1A5AFF" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", marginBottom: 4 }}>
            Process Model & Data Request
          </div>
          <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5, marginBottom: 16 }}>
            Map the process steps, assign systems and actors, then generate a MoSCoW-prioritised data request for the client.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill done={hasProcessMap} label="Process Map" />
            <StatusPill done={hasDataRequest} label="Data Request" />
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 20,
          fontSize: 12, fontWeight: 700, color: "#1A5AFF",
        }}>
          {hasProcessMap ? "Continue" : "Get started"} →
        </div>
      </div>
    </Link>
  );
}

function Tile2({
  href, enabled, mappedCount, totalCount,
}: { href: string; enabled: boolean; mappedCount: number; totalCount: number }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = "#06B6D4";

  if (!enabled) {
    return (
      <LockedTile
        accentColor={accentColor}
        icon={
          <svg width="18" height="18" fill="none" stroke={accentColor} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        }
        title="Data Ingestion & Digital Twin"
        description="Upload event log exports from client systems and build a live digital twin of the process."
        bulletPoints={[
          "Upload CSV / Excel event logs",
          "Automated schema inference & correlation",
          "Build process graph from real case data",
          "Identify variants, exceptions, dark processes",
        ]}
      />
    );
  }

  const allMapped = mappedCount === totalCount && totalCount > 0;

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#fff", borderRadius: 16, padding: "24px",
          border: hovered ? `1.5px solid ${accentColor}` : "1.5px solid #DDE3EC",
          boxShadow: hovered ? `0 4px 20px ${accentColor}1f` : "none",
          transform: hovered ? "translateY(-2px)" : "none",
          transition: "all 0.15s", cursor: "pointer", minHeight: 200,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: `${accentColor}15`,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}>
            <svg width="18" height="18" fill="none" stroke={accentColor} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", marginBottom: 4 }}>
            Data Ingestion & Digital Twin
          </div>
          <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5, marginBottom: 16 }}>
            Upload the client&apos;s CSV exports, map them to the data request, then build the digital twin of the actual process.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill done={mappedCount > 0} label={`${mappedCount} / ${totalCount} files`} />
            <StatusPill done={allMapped} label="Activity Table" />
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 20,
          fontSize: 12, fontWeight: 700, color: accentColor,
        }}>
          {mappedCount > 0 ? "Continue" : "Get started"} →
        </div>
      </div>
    </Link>
  );
}

function Tile3({ href, enabled }: { href: string; enabled: boolean }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = "#26BC71";

  if (!enabled) {
    return (
      <LockedTile
        accentColor={accentColor}
        icon={
          <svg width="18" height="18" fill="none" stroke={accentColor} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
        title="Process Cockpit"
        description="Categorised KPI dashboard — time, quality, outcome, cost, CX, workforce, compliance — with RAG status against benchmarks."
        bulletPoints={[
          "Direct metrics from event log",
          "Inferred metrics with country FTE rates",
          "Red / amber / green vs targets",
          "Auto-flags off-target categories",
        ]}
      />
    );
  }

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#fff", borderRadius: 16, padding: "24px",
          border: hovered ? `1.5px solid ${accentColor}` : "1.5px solid #DDE3EC",
          boxShadow: hovered ? `0 4px 20px ${accentColor}1f` : "none",
          transform: hovered ? "translateY(-2px)" : "none",
          transition: "all 0.15s", cursor: "pointer", minHeight: 200,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: `${accentColor}15`,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}>
            <svg width="18" height="18" fill="none" stroke={accentColor} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", marginBottom: 4 }}>
            Process Cockpit
          </div>
          <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5, marginBottom: 16 }}>
            Categorised KPIs against banking benchmarks. Time, quality, outcome, cost, CX, workforce, compliance — all with red / amber / green status.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, fontSize: 12, fontWeight: 700, color: accentColor }}>
          Open cockpit →
        </div>
      </div>
    </Link>
  );
}

function LockedTile({
  icon, title, description, bulletPoints, accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  bulletPoints: string[];
  accentColor: string;
}) {
  return (
    <div style={{
      background: "#FAFBFC", borderRadius: 16, padding: "24px",
      border: "1.5px solid #EEF2F8", minHeight: 200,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      position: "relative", overflow: "hidden",
    }}>
      <div>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: `${accentColor}15`,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#374D6C", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "#9AAABB", lineHeight: 1.5, marginBottom: 14 }}>
          {description}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {bulletPoints.map((b) => (
            <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: accentColor, marginTop: 6, flexShrink: 0, opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: "#9AAABB", lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6, marginTop: 20,
        fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20,
        background: `${accentColor}10`, color: accentColor, alignSelf: "flex-start",
      }}>
        Coming Soon
      </div>
    </div>
  );
}

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600,
      padding: "3px 8px", borderRadius: 20,
      background: done ? "rgba(46,204,113,0.1)" : "#F5F7F9",
      color: done ? "#1A8F4F" : "#5C6E84",
      border: `1px solid ${done ? "rgba(46,204,113,0.2)" : "#DDE3EC"}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: done ? "#2ECC71" : "#DDE3EC", flexShrink: 0 }} />
      {label}
    </div>
  );
}

export function ProcessScanTiles({
  engagementId, processId, hasProcessMap, hasDataRequest,
  ingestionMappedCount = 0, ingestionTotalCount = 0, hasActivityTable = false,
}: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      <Tile1
        href={`/engagements/${engagementId}/processes/${processId}/discover`}
        hasProcessMap={hasProcessMap}
        hasDataRequest={hasDataRequest}
      />

      <Tile2
        href={`/engagements/${engagementId}/processes/${processId}/ingest`}
        enabled={hasDataRequest}
        mappedCount={ingestionMappedCount}
        totalCount={ingestionTotalCount}
      />

      <LockedTile
        accentColor="#FFAC09"
        icon={
          <svg width="18" height="18" fill="none" stroke="#FFAC09" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
        title="APA Simulation & Value Recovery"
        description="Run AI-powered automation simulations against the digital twin and quantify the value opportunity."
        bulletPoints={[
          "Simulate APA agents on each process step",
          "Calculate cycle time & cost reduction",
          "Generate value recovery scenarios",
          "Export ROI model for client presentation",
        ]}
      />
    </div>
  );
}
