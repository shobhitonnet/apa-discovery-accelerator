"use client";

import { useState } from "react";
import Link from "next/link";
import { DataRequestSection } from "@/components/DataRequestSection";
import type { DataRequest } from "@/app/api/engagements/[id]/data-request/route";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
      style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

interface Props {
  engagementId: string;
  processId: string;
  processName: string;
  lobLabel: string;
  lobColor: string;
  taskNodes: Array<{ data?: { label?: string } }>;
  hasProcessMap: boolean;
  initialDataRequest: DataRequest | null;
}

export function DiscoverPageContent({
  engagementId, processId, processName, lobLabel, lobColor,
  taskNodes, hasProcessMap, initialDataRequest,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Card 1: Process Map ─────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", overflow: "hidden" }}>
        {/* Always-visible header row */}
        <button
          onClick={() => setMapOpen((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "18px 24px", background: "none", border: "none", cursor: "pointer",
            textAlign: "left",
          }}
        >
          {/* Status badge */}
          <div style={{
            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0,
            background: hasProcessMap ? "rgba(46,204,113,0.12)" : "rgba(26,90,255,0.08)",
            color: hasProcessMap ? "#1A8F4F" : "#1A5AFF",
          }}>
            {hasProcessMap ? "✓" : "1"}
          </div>

          <span style={{ fontSize: 14, fontWeight: 700, color: "#001C3D", flex: 1 }}>
            Process Map
          </span>

          {/* Step count pill */}
          {hasProcessMap && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
              background: "rgba(46,204,113,0.08)", color: "#1A8F4F", border: "1px solid rgba(46,204,113,0.15)",
            }}>
              {taskNodes.length} steps
            </span>
          )}

          {!hasProcessMap && (
            <span style={{ fontSize: 11, color: "#9AAABB" }}>Not started</span>
          )}

          {/* Edit / Model button — stop propagation so it doesn't toggle card */}
          <Link
            href={`/engagements/${engagementId}/processes/${processId}/model`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
              padding: "6px 14px", borderRadius: 20, background: "#1A5AFF", color: "#fff",
              textDecoration: "none", flexShrink: 0,
            }}
          >
            {hasProcessMap ? "Edit" : "Start"}
          </Link>

          <span style={{ color: "#9AAABB" }}>
            <ChevronIcon open={mapOpen} />
          </span>
        </button>

        {/* Expanded: step list */}
        {mapOpen && hasProcessMap && (
          <div style={{ padding: "0 24px 20px", borderTop: "1px solid #F0F3F7" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 16 }}>
              {taskNodes.map((n, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    fontSize: 11, background: "#F5F7F9", border: "1px solid #E4EAF2",
                    borderRadius: 6, padding: "4px 10px", color: "#374D6C", fontWeight: 500,
                  }}>
                    {n.data?.label ?? "Step"}
                  </span>
                  {i < taskNodes.length - 1 && (
                    <span style={{ color: "#CBD5E1", fontSize: 10 }}>→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {mapOpen && !hasProcessMap && (
          <div style={{ padding: "0 24px 20px", borderTop: "1px solid #F0F3F7" }}>
            <p style={{ fontSize: 12, color: "#9AAABB", marginTop: 14 }}>
              Open the canvas to map out the process steps, assign systems and actors.
            </p>
          </div>
        )}
      </div>

      {/* ── Card 2: Data Request ─────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", overflow: "hidden" }}>
        {/* Always-visible header row */}
        <button
          onClick={() => setDataOpen((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "18px 24px", background: "none", border: "none", cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0,
            background: initialDataRequest ? "rgba(46,204,113,0.12)" : "rgba(255,172,9,0.1)",
            color: initialDataRequest ? "#1A8F4F" : "#B07800",
          }}>
            {initialDataRequest ? "✓" : "2"}
          </div>

          <span style={{ fontSize: 14, fontWeight: 700, color: "#001C3D", flex: 1 }}>
            Data Request
          </span>

          {initialDataRequest && (() => {
            const must = initialDataRequest.items.filter(i => i.moscow === "must_have").length;
            const should = initialDataRequest.items.filter(i => i.moscow === "should_have").length;
            const could = initialDataRequest.items.filter(i => i.moscow === "could_have").length;
            return (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {must > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(239,68,68,0.07)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>Must {must}</span>}
                {should > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,172,9,0.07)", color: "#FFAC09", border: "1px solid rgba(255,172,9,0.15)" }}>Should {should}</span>}
                {could > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(51,102,255,0.07)", color: "#7aa3ff", border: "1px solid rgba(51,102,255,0.15)" }}>Could {could}</span>}
              </div>
            );
          })()}

          {!initialDataRequest && (
            <span style={{ fontSize: 11, color: "#9AAABB" }}>{hasProcessMap ? "Ready to generate" : "Needs process map first"}</span>
          )}

          <span style={{ color: "#9AAABB" }}>
            <ChevronIcon open={dataOpen} />
          </span>
        </button>

        {/* Expanded: DataRequestSection (existing component, dark-themed) */}
        {dataOpen && (
          <div style={{ borderTop: "1px solid #F0F3F7" }}>
            <DataRequestSection
              engagementId={engagementId}
              processId={processId}
              hasProcessMap={hasProcessMap}
              initialDataRequest={initialDataRequest}
              compact
            />
          </div>
        )}
      </div>

    </div>
  );
}
