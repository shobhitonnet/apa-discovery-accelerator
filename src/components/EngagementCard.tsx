"use client";

import Link from "next/link";
import { PROCESS_TEMPLATES } from "@/types";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  created:   { bg: "rgba(26,90,255,0.08)",   text: "#1A5AFF", label: "Created" },
  uploading: { bg: "rgba(245,158,11,0.08)",  text: "#F59E0B", label: "Uploading" },
  analyzing: { bg: "rgba(6,182,212,0.08)",   text: "#06B6D4", label: "Analyzing" },
  completed: { bg: "rgba(46,204,113,0.08)",  text: "#2ECC71", label: "Completed" },
};

const STEPS = [
  { key: "hasProcessMap",   label: "Process Map" },
  { key: "hasDataRequest",  label: "Data Request" },
  { key: "hasUploads",      label: "Data Uploaded" },
  { key: "hasAnalysis",     label: "Analysed" },
] as const;

interface EngagementCardProps {
  engagement: {
    id: string;
    name: string;
    clientName: string;
    processTemplate?: string | null;
    status: string;
    createdAt: Date;
    createdBy: { name: string };
    _count: { uploads: number; eventLogs: number };
    hasProcessMap: boolean;
    hasDataRequest: boolean;
    hasUploads: boolean;
    hasAnalysis: boolean;
  };
}

export function EngagementCard({ engagement }: EngagementCardProps) {
  const status = STATUS_COLORS[engagement.status] ?? STATUS_COLORS.created;
  const template = engagement.processTemplate
    ? PROCESS_TEMPLATES.find((t) => t.id === engagement.processTemplate)
    : undefined;
  const doneCount = STEPS.filter((s) => engagement[s.key]).length;

  return (
    <Link
      href={`/engagements/${engagement.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{
        background: "#fff",
        border: "1px solid #DDE3EC",
        borderRadius: 16,
        padding: "20px 22px",
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: "0 1px 3px rgba(0,28,61,0.06)",
      }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "#1A5AFF";
          el.style.boxShadow = "0 4px 16px rgba(26,90,255,0.12)";
          el.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "#DDE3EC";
          el.style.boxShadow = "0 1px 3px rgba(0,28,61,0.06)";
          el.style.transform = "translateY(0)";
        }}
      >
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#001C3D", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {engagement.name}
            </h3>
            <p style={{ fontSize: 12, color: "#5C6E84" }}>{engagement.clientName}</p>
          </div>
          <span style={{ marginLeft: 12, flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 30, background: status.bg, color: status.text }}>
            {status.label}
          </span>
        </div>

        {/* Process template */}
        <div style={{ fontSize: 11, color: "#374D6C", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A5AFF", display: "inline-block", flexShrink: 0 }} />
          {template?.name ?? engagement.processTemplate}
        </div>

        {/* Progress steps */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            {STEPS.map((step) => {
              const done = engagement[step.key];
              return (
                <div key={step.key} style={{ flex: 1, height: 3, borderRadius: 2, background: done ? "#1A5AFF" : "#E8EDF4", transition: "background 0.2s" }} />
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#5C6E84" }}>
            {doneCount === 0 && "Start by modelling the process"}
            {doneCount === 1 && "Generate data request next"}
            {doneCount === 2 && "Upload data from client"}
            {doneCount === 3 && "Ready to analyse"}
            {doneCount === 4 && "✓ Analysis complete"}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #EEF2F8", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ fontSize: 11, color: "#5C6E84" }}>
              {engagement._count.uploads} file{engagement._count.uploads !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 11, color: "#5C6E84" }}>
              {engagement._count.eventLogs.toLocaleString()} events
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1A5AFF" }}>Open →</span>
        </div>
      </div>
    </Link>
  );
}
