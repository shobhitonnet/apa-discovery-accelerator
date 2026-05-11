"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const status = STATUS_COLORS[engagement.status] ?? STATUS_COLORS.created;
  const template = engagement.processTemplate
    ? PROCESS_TEMPLATES.find((t) => t.id === engagement.processTemplate)
    : undefined;
  const doneCount = STEPS.filter((s) => engagement[s.key]).length;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm(`Delete engagement "${engagement.name}"?\n\nThis permanently removes the engagement and all its processes, uploads, event logs, and analysis results. Cannot be undone.`);
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/engagements/${engagement.id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleting(false);
        alert("Delete failed. Check the server log.");
        return;
      }
      router.refresh();
    } catch {
      setDeleting(false);
      alert("Delete failed. Network error.");
    }
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 30, background: status.bg, color: status.text }}>
              {status.label}
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete engagement"
              title="Delete engagement"
              style={{
                width: 28, height: 28, borderRadius: 6, background: "transparent",
                border: "1px solid transparent",
                color: deleting ? "#CBD5E1" : "#9AAABB",
                cursor: deleting ? "wait" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!deleting) { (e.currentTarget as HTMLButtonElement).style.color = "#C0392B"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.2)"; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9AAABB"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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
