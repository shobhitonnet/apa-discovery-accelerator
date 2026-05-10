"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import type { DataRequest, DataRequestItem } from "@/app/api/engagements/[id]/data-request/route";
import type { ActivityTableSummary } from "@/lib/activityTable";
import type { VariantsSummary, Variant } from "@/lib/variants";
import type { ProcessGraphSummary } from "@/lib/processGraph.types";
import { ProcessExplorer } from "@/components/ProcessExplorer";
import { FindingsSection } from "@/components/FindingsSection";
import { CockpitSection } from "@/components/CockpitSection";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type SchemaColumn = {
  name: string;
  inferredRole: "case_id" | "activity" | "timestamp" | "actor" | "attribute" | "system_ref" | "unknown";
  confidence: number;
  reasoning?: string;
  sampleValues?: string[];
};

type SchemaInference = {
  columns: SchemaColumn[];
  detectedSystem?: string | null;
  overallConfidence?: number;
  notes?: string;
};

type UploadRecord = {
  id: string;
  originalName: string;
  systemSource: string | null;
  rowCount: number | null;
  columnCount: number | null;
  status: string;
  schemaInference: SchemaInference | null;
  dataRequestFileName: string | null;
  caseIdColumn: string | null;
  activityColumn: string | null;
  activityFallback: string | null;
  timestampColumn: string | null;
  actorColumn: string | null;
};

interface Props {
  engagementId: string;
  processId: string;
  dataRequest: DataRequest | null;
  initialUploads: UploadRecord[];
  hasDataRequest: boolean;
  initialActivityTable: ActivityTableSummary;
  initialVariants: VariantsSummary;
  initialProcessGraph: ProcessGraphSummary;
}

// ──────────────────────────────────────────────────────────────────────────
// Auto-match helpers
// ──────────────────────────────────────────────────────────────────────────

function normaliseFileName(s: string): string {
  return s.toLowerCase().replace(/\.csv$/, "").replace(/[^a-z0-9]/g, "");
}

/** Score a candidate file against a data request item. 0-1, higher = better. */
function scoreMatch(item: DataRequestItem, fileName: string, columns: string[]): number {
  const itemKey = normaliseFileName(item.fileName);
  const fileKey = normaliseFileName(fileName);

  // Filename score: substring match either way → 0.5, exact → 0.7
  let nameScore = 0;
  if (itemKey === fileKey) nameScore = 0.7;
  else if (itemKey.includes(fileKey) || fileKey.includes(itemKey)) nameScore = 0.5;

  // Column overlap score: 0.3 max
  const requiredFields = item.fields.map((f) => f.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const fileCols = columns.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const overlap = requiredFields.filter((f) => fileCols.some((c) => c === f || c.includes(f) || f.includes(c))).length;
  const colScore = requiredFields.length === 0 ? 0 : (overlap / requiredFields.length) * 0.3;

  return nameScore + colScore;
}

function findBestMatch(items: DataRequestItem[], fileName: string, columns: string[]): { item: DataRequestItem | null; score: number } {
  let best: DataRequestItem | null = null;
  let bestScore = 0;
  for (const item of items) {
    const s = scoreMatch(item, fileName, columns);
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return { item: best, score: bestScore };
}

function pickColumnByRole(schema: SchemaInference | null, role: SchemaColumn["inferredRole"]): string | null {
  if (!schema?.columns) return null;
  const candidates = schema.columns.filter((c) => c.inferredRole === role).sort((a, b) => b.confidence - a.confidence);
  return candidates[0]?.name ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// MoSCoW colors (light theme)
// ──────────────────────────────────────────────────────────────────────────

const MOSCOW_STYLES = {
  must_have:   { label: "Must",   bg: "rgba(239,68,68,0.06)",  text: "#C0392B", border: "rgba(239,68,68,0.18)" },
  should_have: { label: "Should", bg: "rgba(255,172,9,0.06)",  text: "#B07800", border: "rgba(255,172,9,0.2)"  },
  could_have:  { label: "Could",  bg: "rgba(51,102,255,0.06)", text: "#1A5AFF", border: "rgba(51,102,255,0.18)" },
};

// ──────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────

export function IngestionSection({ engagementId, processId, dataRequest, initialUploads, hasDataRequest, initialActivityTable, initialVariants, initialProcessGraph }: Props) {
  const [uploads, setUploads] = useState<UploadRecord[]>(initialUploads);
  const [busyFiles, setBusyFiles] = useState<Record<string, string>>({}); // tempId -> filename
  const [busySlots, setBusySlots] = useState<Record<string, string>>({}); // slotFileName -> uploadFileName
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activityTable, setActivityTable] = useState<ActivityTableSummary>(initialActivityTable);
  const [building, setBuilding] = useState(false);
  const [variants, setVariants] = useState<VariantsSummary>(initialVariants);
  const [processGraph, setProcessGraph] = useState<ProcessGraphSummary>(initialProcessGraph);
  // Tabs — Data Setup (Stages 1-2) vs Digital Twin (Stages 3-5).
  // Smart default: land on Digital Twin if the activity table is already built,
  // otherwise stay in Data Setup so the consultant can finish prep.
  const [activeTab, setActiveTab] = useState<"setup" | "twin">(initialActivityTable.built ? "twin" : "setup");
  // Sub-tabs inside the Digital Twin tab.
  const [twinSubTab, setTwinSubTab] = useState<"explorer" | "cockpit" | "analysis">("explorer");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slotInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const items = dataRequest?.items ?? [];

  // Map: dataRequestFileName -> upload (most recent wins)
  const uploadByItem = useMemo(() => {
    const map: Record<string, UploadRecord> = {};
    for (const u of uploads) {
      if (u.dataRequestFileName) map[u.dataRequestFileName] = u;
    }
    return map;
  }, [uploads]);

  const unmatchedUploads = useMemo(() => uploads.filter((u) => !u.dataRequestFileName), [uploads]);

  const mappedCount = items.filter((i) => uploadByItem[i.fileName]).length;
  const totalRequired = items.filter((i) => i.moscow === "must_have").length;
  const mappedRequired = items.filter((i) => i.moscow === "must_have" && uploadByItem[i.fileName]).length;
  const allMustHaveMapped = totalRequired > 0 && mappedRequired === totalRequired;

  // ──────────────────────────────────────────────────────────────
  // File ingestion
  // ──────────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList, forcedSlot?: string) => {
    setError("");

    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".csv")) {
        setError(`Skipped ${file.name} — only .csv files are supported`);
        continue;
      }

      const tempId = crypto.randomUUID();
      setBusyFiles((p) => ({ ...p, [tempId]: file.name }));
      if (forcedSlot) setBusySlots((p) => ({ ...p, [forcedSlot]: file.name }));

      try {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const allRows = parsed.data as Record<string, string>[];
        const headers = parsed.meta.fields ?? [];
        const sampleRows = allRows.slice(0, 10).map((r) => headers.map((h) => r[h] ?? ""));

        const inferRes = await fetch("/api/schema-inference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvHeaders: headers, sampleRows, fileName: file.name }),
        });
        const inference: SchemaInference | null = inferRes.ok ? await inferRes.json() : null;

        // Determine slot: forced (per-row browse) or auto-match
        let matchedFileName: string | null;
        let matchedItem: DataRequestItem | undefined;
        if (forcedSlot) {
          matchedFileName = forcedSlot;
          matchedItem = items.find((i) => i.fileName === forcedSlot);
        } else {
          const availableItems = items.filter((i) => !uploadByItem[i.fileName]);
          const { item, score } = findBestMatch(availableItems, file.name, headers);
          matchedFileName = score >= 0.5 ? item?.fileName ?? null : null;
          matchedItem = item ?? undefined;
        }

        const caseIdCol = pickColumnByRole(inference, "case_id");
        const timestampCol = pickColumnByRole(inference, "timestamp");
        const actorCol = pickColumnByRole(inference, "actor");
        // For banking files, each CSV is typically one activity (one event per case).
        // Use the data-request slot's linked step as the activity name; do NOT
        // auto-pick a column (e.g. `status`) which produces values like "pending",
        // "completed" that pollute the process graph. The consultant can opt into
        // a multi-activity column via the Mapping editor.
        const activityCol = null;
        const activityFallback = matchedItem
          ? (matchedItem.linkedSteps[0] ?? matchedItem.fileName.replace(/\.csv$/, ""))
          : null;

        const saveRes = await fetch(`/api/engagements/${engagementId}/processes/${processId}/uploads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: file.name,
            rowCount: allRows.length,
            columnCount: headers.length,
            schemaInference: inference,
            rawData: allRows,
            dataRequestFileName: matchedFileName,
            caseIdColumn: caseIdCol,
            activityColumn: activityCol,
            activityFallback,
            timestampColumn: timestampCol,
            actorColumn: actorCol,
          }),
        });

        if (!saveRes.ok) {
          const j = await saveRes.json().catch(() => ({}));
          throw new Error(j.error ?? "Upload save failed");
        }

        const saved: UploadRecord = await saveRes.json();
        setUploads((p) => [saved, ...p]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusyFiles((p) => {
          const next = { ...p };
          delete next[tempId];
          return next;
        });
        if (forcedSlot) {
          setBusySlots((p) => {
            const next = { ...p };
            delete next[forcedSlot];
            return next;
          });
        }
      }
    }
  }, [items, uploadByItem, engagementId, processId]);

  // ──────────────────────────────────────────────────────────────
  // Update / delete upload
  // ──────────────────────────────────────────────────────────────

  async function updateUpload(uploadId: string, patch: Partial<UploadRecord>) {
    const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}/uploads/${uploadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated: UploadRecord = await res.json();
      setUploads((p) => p.map((u) => (u.id === uploadId ? updated : u)));
    }
  }

  async function deleteUpload(uploadId: string) {
    const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}/uploads/${uploadId}`, { method: "DELETE" });
    if (res.ok) setUploads((p) => p.filter((u) => u.id !== uploadId));
  }

  async function downloadSamples() {
    const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}/sample-csvs`);
    if (!res.ok) {
      setError("Sample CSV download failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-csvs.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resetAllUploads() {
    if (!confirm("Delete all uploaded files and the activity table for this process? Cannot be undone.")) return;
    const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}/uploads`, { method: "DELETE" });
    if (res.ok) {
      setUploads([]);
      setActivityTable({ built: false, caseCount: 0, eventCount: 0, systemCount: 0, timeRangeStart: null, timeRangeEnd: null, perSystem: [], warnings: [] });
      setVariants({ computed: false, totalCases: 0, totalEvents: 0, totalVariants: 0, topVariants: [], longTailVariants: 0, longTailCases: 0 });
      setProcessGraph({
        computed: false, totalCases: 0, totalEvents: 0, activities: [], edges: [], happyPathEdges: [],
        outcomeBreakdown: { approved: 0, declined: 0, withdrawn: 0, in_progress: 0 },
        durationBreakdown: { fastest_25: 0, q2: 0, q3: 0, slowest_25: 0 },
        durationQuartiles: { p25Ms: 0, p50Ms: 0, p75Ms: 0 },
        conformanceBreakdown: { conforming: 0, deviating: 0 },
        caseTimeRange: { earliestIso: null, latestIso: null },
      });
    } else {
      setError("Reset failed");
    }
  }

  async function buildActivityTable() {
    setBuilding(true);
    setError("");
    try {
      const res = await fetch(`/api/engagements/${engagementId}/processes/${processId}/build-activity-table`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Build failed");
      setActivityTable(json as ActivityTableSummary);
      // Auto-refresh variants and process graph — Stage 3 inputs are the activity table
      const [vRes, gRes] = await Promise.all([
        fetch(`/api/engagements/${engagementId}/processes/${processId}/variants`),
        fetch(`/api/engagements/${engagementId}/processes/${processId}/process-graph`),
      ]);
      if (vRes.ok) setVariants(await vRes.json() as VariantsSummary);
      if (gRes.ok) setProcessGraph(await gRes.json() as ProcessGraphSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  if (!hasDataRequest) {
    return (
      <div style={{ padding: "20px 24px", color: "#9AAABB", fontSize: 12 }}>
        Generate the data request first — the digital twin pipeline maps incoming CSVs back to the request.
      </div>
    );
  }

  // Status indicators on the tabs
  const setupComplete = activityTable.built;
  const twinReady = activityTable.built && variants.computed;

  return (
    <div style={{ padding: "16px 24px 24px" }}>
      {/* Tabs: Data Setup | Digital Twin */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #EEF2F8", marginBottom: 16 }}>
        <TabHeader
          label="Data Setup"
          sub={setupComplete ? `${activityTable.caseCount.toLocaleString()} cases · ready` : `Stage 1 & 2`}
          active={activeTab === "setup"}
          status={setupComplete ? "done" : "active"}
          onClick={() => setActiveTab("setup")}
        />
        <TabHeader
          label="Digital Twin"
          sub={twinReady ? "Discover · KPIs · Findings" : "Build the activity table first"}
          active={activeTab === "twin"}
          status={twinReady ? (setupComplete ? "active" : "locked") : "locked"}
          onClick={() => setActiveTab("twin")}
        />
      </div>

      {/* ───────────────────────── Tab: Digital Twin ───────────────────────── */}
      {activeTab === "twin" && (
        <div>
          {!twinReady ? (
            <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 12, border: "1px dashed #DDE3EC", background: "#FAFBFC" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#374D6C", marginBottom: 6 }}>
                Digital twin not ready yet
              </div>
              <div style={{ fontSize: 12, color: "#9AAABB", lineHeight: 1.55, maxWidth: 480, margin: "0 auto" }}>
                Finish <strong>Data Setup</strong> first — upload your files, then build the activity table.
                Once the event log is in place, the discovery, KPI cockpit, and findings stages unlock here.
              </div>
              <button
                onClick={() => setActiveTab("setup")}
                style={{
                  marginTop: 14, fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 20,
                  background: "#1A5AFF", color: "#fff", border: "none", cursor: "pointer",
                }}
              >
                Go to Data Setup →
              </button>
            </div>
          ) : (
            <>
              {/* Sub-tab navigation */}
              <div style={{ display: "flex", gap: 4, padding: "4px", background: "#F5F7FB", borderRadius: 10, marginBottom: 16, width: "fit-content" }}>
                <SubTab label="Process Explorer" desc="Stage 3 — discover variants" active={twinSubTab === "explorer"} onClick={() => setTwinSubTab("explorer")} />
                <SubTab label="Process Cockpit"  desc="Stage 4 — KPIs vs benchmarks" active={twinSubTab === "cockpit"}  onClick={() => setTwinSubTab("cockpit")} />
                <SubTab label="Process Analysis" desc="Stage 5 — findings &amp; value leak" active={twinSubTab === "analysis"} onClick={() => setTwinSubTab("analysis")} />
              </div>

              {/* Sub-tab content — only the active one is mounted */}
              {twinSubTab === "explorer" && (
                <Stage3Panel variants={variants} processGraph={processGraph} engagementId={engagementId} processId={processId} />
              )}
              {twinSubTab === "cockpit" && (
                <CockpitSection engagementId={engagementId} processId={processId} />
              )}
              {twinSubTab === "analysis" && (
                <FindingsSection engagementId={engagementId} processId={processId} />
              )}
            </>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ───────────────────────── Tab: Data Setup ───────────────────────── */}
      {activeTab === "setup" && (
      <>
      {/* Stage indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#5C6E84", padding: "3px 8px", borderRadius: 4, background: "#F5F7F9", border: "1px solid #EEF2F8",
        }}>
          Stage 1 of 5 — Upload &amp; Match
        </span>
        <span style={{ fontSize: 11, color: "#9AAABB", flex: 1 }}>
          {mappedCount} of {items.length} files mapped
          {totalRequired > 0 && ` · ${mappedRequired}/${totalRequired} must-have`}
        </span>
        <button
          onClick={downloadSamples}
          title="Generate a ZIP of sample CSVs that match this exact data request — for testing"
          style={{
            fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, cursor: "pointer",
            background: "rgba(139,92,246,0.06)", color: "#8B5CF6",
            border: "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
          Sample CSVs
        </button>
        {uploads.length > 0 && (
          <button
            onClick={resetAllUploads}
            title="Delete all uploads and the activity table for this process"
            style={{
              fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, cursor: "pointer",
              background: "transparent", color: "#9AAABB",
              border: "1px solid #DDE3EC", display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Reset
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragOver ? "#1A5AFF" : "#DDE3EC"}`,
          background: dragOver ? "rgba(26,90,255,0.04)" : "#FAFBFC",
          borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer",
          marginBottom: 16, transition: "all 0.15s",
        }}
      >
        <input
          ref={fileInputRef} type="file" accept=".csv" multiple style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374D6C", marginBottom: 4 }}>
          Drop CSV files here or click to browse
        </div>
        <div style={{ fontSize: 11, color: "#9AAABB" }}>
          Each file is auto-matched to a row in the data request and column roles are inferred
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 11, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#C0392B" }}>
          {error}
        </div>
      )}

      {/* In-flight files */}
      {Object.entries(busyFiles).map(([id, name]) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 6, borderRadius: 8, background: "rgba(26,90,255,0.04)", border: "1px solid rgba(26,90,255,0.15)" }}>
          <span style={{ width: 10, height: 10, border: "2px solid rgba(26,90,255,0.3)", borderTopColor: "#1A5AFF", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
          <span style={{ fontSize: 11, color: "#1A5AFF", fontWeight: 600 }}>Inferring schema for {name}…</span>
        </div>
      ))}

      {/* Data request slots */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => {
          const upload = uploadByItem[item.fileName];
          const moscow = MOSCOW_STYLES[item.moscow];
          const isEditing = upload && editingId === upload.id;

          return (
            <div key={item.fileName} style={{
              borderRadius: 10, border: `1px solid ${upload ? "rgba(38,188,113,0.25)" : "#EEF2F8"}`,
              background: upload ? "rgba(38,188,113,0.03)" : "#fff", overflow: "hidden",
            }}>
              {/* Slot header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                {/* Status icon */}
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                  background: upload ? "rgba(38,188,113,0.15)" : "#F5F7F9",
                  color: upload ? "#1A8F4F" : "#9AAABB",
                  border: upload ? "none" : "1px solid #EEF2F8",
                }}>
                  {upload ? "✓" : "·"}
                </div>

                {/* System dot */}
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.systemColor, flexShrink: 0 }} />

                {/* Filename + system */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#001C3D", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.fileName}
                  </div>
                  <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 1 }}>
                    {item.systemName} · {item.linkedSteps.length} step{item.linkedSteps.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* MoSCoW pill */}
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: moscow.bg, color: moscow.text, border: `1px solid ${moscow.border}`, flexShrink: 0,
                }}>
                  {moscow.label}
                </span>

                {/* Action buttons */}
                {upload ? (
                  <>
                    <button onClick={() => setEditingId(isEditing ? null : upload.id)}
                      style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: isEditing ? "#1A5AFF" : "#F5F7F9", color: isEditing ? "#fff" : "#5C6E84", border: `1px solid ${isEditing ? "#1A5AFF" : "#DDE3EC"}`, cursor: "pointer", flexShrink: 0 }}>
                      {isEditing ? "Done" : "Mapping"}
                    </button>
                    <button onClick={() => deleteUpload(upload.id)}
                      style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "transparent", color: "#9AAABB", border: "none", cursor: "pointer", flexShrink: 0 }}>
                      ✕
                    </button>
                  </>
                ) : busySlots[item.fileName] ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#1A5AFF", fontWeight: 600, flexShrink: 0 }}>
                    <span style={{
                      width: 10, height: 10, border: "2px solid rgba(26,90,255,0.25)", borderTopColor: "#1A5AFF",
                      borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite",
                    }} />
                    Inferring schema for {busySlots[item.fileName]}…
                  </span>
                ) : (
                  <>
                    <input
                      ref={(el) => { slotInputRefs.current[item.fileName] = el; }}
                      type="file" accept=".csv" style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFiles(e.target.files, item.fileName);
                          e.target.value = "";
                        }
                      }}
                    />
                    <button
                      onClick={() => slotInputRefs.current[item.fileName]?.click()}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                        background: "rgba(26,90,255,0.08)", color: "#1A5AFF",
                        border: "1px solid rgba(26,90,255,0.2)", cursor: "pointer", flexShrink: 0,
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      Browse
                    </button>
                  </>
                )}
              </div>

              {/* Mapping editor */}
              {isEditing && upload && (
                <div style={{ padding: "12px 14px 14px", borderTop: "1px solid #EEF2F8", background: "#FAFBFC" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Column roles · {upload.originalName} ({upload.rowCount?.toLocaleString() ?? "?"} rows)
                  </div>
                  <MappingEditor upload={upload} onChange={(patch) => updateUpload(upload.id, patch)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unmatched uploads */}
      {unmatchedUploads.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#B07800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Unmatched files ({unmatchedUploads.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unmatchedUploads.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,172,9,0.04)", border: "1px solid rgba(255,172,9,0.2)" }}>
                <span style={{ fontSize: 12, color: "#B07800" }}>⚠</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#001C3D", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.originalName}
                </span>
                <select
                  value=""
                  onChange={(e) => updateUpload(u.id, { dataRequestFileName: e.target.value })}
                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #DDE3EC", background: "#fff", color: "#001C3D", cursor: "pointer" }}
                >
                  <option value="">Assign to slot…</option>
                  {items.filter((i) => !uploadByItem[i.fileName]).map((i) => (
                    <option key={i.fileName} value={i.fileName}>{i.fileName}</option>
                  ))}
                </select>
                <button onClick={() => deleteUpload(u.id)}
                  style={{ fontSize: 10, color: "#9AAABB", background: "transparent", border: "none", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage 2 panel */}
      {allMustHaveMapped && (
        <Stage2Panel
          activityTable={activityTable}
          building={building}
          onBuild={buildActivityTable}
        />
      )}

      {/* Once Stage 2 builds, nudge the user toward the Digital Twin tab */}
      {activityTable.built && variants.computed && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(38,188,113,0.04)", border: "1px solid rgba(38,188,113,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#1A8F4F", fontWeight: 700, flex: 1 }}>
            ✓ Activity table built — the digital twin is ready to explore.
          </span>
          <button
            onClick={() => setActiveTab("twin")}
            style={{
              fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 16,
              background: "linear-gradient(135deg, #26BC71, #06B6D4)", color: "#fff",
              border: "none", cursor: "pointer",
            }}
          >
            Open Digital Twin →
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Tab header — Data Setup / Digital Twin
// ──────────────────────────────────────────────────────────────────────────

function TabHeader({
  label, sub, active, status, onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  status: "done" | "active" | "locked";
  onClick: () => void;
}) {
  const dotColor = status === "done" ? "#26BC71" : status === "active" ? "#1A5AFF" : "#CBD5E1";
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent", border: "none", cursor: "pointer", padding: "10px 18px",
        borderBottom: active ? "2px solid #1A5AFF" : "2px solid transparent",
        marginBottom: -1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#001C3D" : "#5C6E84", display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor }} />
        {label}
      </span>
      <span style={{ fontSize: 10, color: "#9AAABB", paddingLeft: 15 }}>{sub}</span>
    </button>
  );
}

function SubTab({
  label, desc, active, onClick,
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#fff" : "transparent",
        border: "none",
        cursor: "pointer",
        padding: "8px 14px",
        borderRadius: 8,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px #DDE3EC" : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 1,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#001C3D" : "#5C6E84" }}>{label}</span>
      <span style={{ fontSize: 9, color: "#9AAABB", letterSpacing: "0.02em" }}>{desc}</span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Stage 2 — Build Activity Table panel
// ──────────────────────────────────────────────────────────────────────────

function Stage2Panel({
  activityTable, building, onBuild,
}: {
  activityTable: ActivityTableSummary;
  building: boolean;
  onBuild: () => void;
}) {
  const built = activityTable.built;

  return (
    <div style={{ marginTop: 20, borderRadius: 12, border: "1px solid #DDE3EC", overflow: "hidden", background: "#fff" }}>
      {/* Stage banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: built ? "rgba(46,204,113,0.04)" : "rgba(26,90,255,0.03)",
        borderBottom: built ? "1px solid rgba(46,204,113,0.15)" : "1px solid #EEF2F8",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, flexShrink: 0,
          background: built ? "rgba(46,204,113,0.15)" : "rgba(26,90,255,0.1)",
          color: built ? "#1A8F4F" : "#1A5AFF",
        }}>
          {built ? "✓" : "2"}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C6E84", padding: "3px 8px", borderRadius: 4, background: "#fff", border: "1px solid #EEF2F8" }}>
          Stage 2 of 5 — Build Activity Table
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: built ? "#1A8F4F" : "#5C6E84", flex: 1 }}>
          {built
            ? `${activityTable.caseCount.toLocaleString()} cases · ${activityTable.eventCount.toLocaleString()} events`
            : "Ready to build"}
        </span>
        <button
          onClick={onBuild}
          disabled={building}
          style={{
            fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 20, cursor: building ? "wait" : "pointer",
            background: building ? "#DDE3EC" : built ? "rgba(26,90,255,0.08)" : "#1A5AFF",
            color: building ? "#9AAABB" : built ? "#1A5AFF" : "#fff",
            border: built ? "1px solid rgba(26,90,255,0.2)" : "none",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          }}
        >
          {building ? (
            <>
              <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              Building…
            </>
          ) : built ? "Rebuild" : "Build Activity Table →"}
        </button>
      </div>

      {/* Empty state */}
      {!built && !building && (
        <div style={{ padding: "16px", fontSize: 12, color: "#5C6E84", lineHeight: 1.5 }}>
          Reads each mapped CSV, extracts events using the column roles you confirmed, correlates by case ID across files, then writes a unified <strong>case_id + activity + timestamp + system</strong> event log — the foundation for variants, conformance, and findings.
        </div>
      )}

      {/* Result panel */}
      {built && (
        <div style={{ padding: "16px" }}>
          {/* Stat tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
            <StatTile label="Cases" value={activityTable.caseCount.toLocaleString()} />
            <StatTile label="Events" value={activityTable.eventCount.toLocaleString()} />
            <StatTile label="Systems" value={String(activityTable.systemCount)} />
            <StatTile
              label="Time Range"
              value={
                activityTable.timeRangeStart && activityTable.timeRangeEnd
                  ? `${formatDate(activityTable.timeRangeStart)} → ${formatDate(activityTable.timeRangeEnd)}`
                  : "—"
              }
              small
            />
          </div>

          {/* Per-system breakdown */}
          {activityTable.perSystem.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Events per System
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {activityTable.perSystem.map((s) => {
                  const max = activityTable.perSystem[0].eventCount;
                  const pct = (s.eventCount / max) * 100;
                  return (
                    <div key={s.systemName} style={{ display: "grid", gridTemplateColumns: "minmax(140px, max-content) 1fr 60px", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#374D6C", whiteSpace: "nowrap" }}>
                        {s.systemName}
                      </span>
                      <div style={{ height: 6, background: "#F5F7F9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #1A5AFF, #06B6D4)" }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#5C6E84", textAlign: "right" }}>
                        {s.eventCount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warnings */}
          {activityTable.warnings.length > 0 && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(255,172,9,0.05)", border: "1px solid rgba(255,172,9,0.2)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#B07800", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                {activityTable.warnings.length} warning{activityTable.warnings.length !== 1 ? "s" : ""}
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#5C6E84" }}>
                {activityTable.warnings.map((w, i) => <li key={i} style={{ marginBottom: 2 }}>{w}</li>)}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Stage 3 — Discover Variants panel
// ──────────────────────────────────────────────────────────────────────────

function Stage3Panel({ variants, processGraph, engagementId, processId }: { variants: VariantsSummary; processGraph: ProcessGraphSummary; engagementId: string; processId: string }) {
  const [expandedRank, setExpandedRank] = useState<number | null>(1);
  const [tab, setTab] = useState<"graph" | "variants">("graph");

  return (
    <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid #DDE3EC", overflow: "hidden", background: "#fff" }}>
      {/* Stage banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: "rgba(139,92,246,0.04)", borderBottom: "1px solid rgba(139,92,246,0.15)",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, flexShrink: 0,
          background: "rgba(139,92,246,0.15)", color: "#8B5CF6",
        }}>
          ✓
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C6E84", padding: "3px 8px", borderRadius: 4, background: "#fff", border: "1px solid #EEF2F8" }}>
          Stage 3 of 5 — Discover Variants
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#8B5CF6", flex: 1 }}>
          {variants.totalVariants} distinct path{variants.totalVariants !== 1 ? "s" : ""} across {variants.totalCases} cases
        </span>
      </div>

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px 0", borderBottom: "1px solid #EEF2F8" }}>
        <TabButton active={tab === "graph"} onClick={() => setTab("graph")} label="Process Graph" icon="graph" />
        <TabButton active={tab === "variants"} onClick={() => setTab("variants")} label={`Variants (${variants.totalVariants})`} icon="list" />
      </div>

      <div style={{ padding: "16px" }}>
        {tab === "graph" ? (
          <ProcessExplorer graph={processGraph} variants={variants} engagementId={engagementId} processId={processId} />
        ) : (
          <>
            {/* Variants list */}
            <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5, marginBottom: 14 }}>
              Your cases follow <strong style={{ color: "#001C3D" }}>{variants.totalVariants} distinct paths</strong> through the process. The top {variants.topVariants.length} cover{" "}
              <strong style={{ color: "#001C3D" }}>{Math.round(variants.topVariants.reduce((s, v) => s + v.pct, 0))}%</strong> of cases.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {variants.topVariants.map((v) => (
                <VariantCard
                  key={v.signature}
                  variant={v}
                  expanded={expandedRank === v.rank}
                  onToggle={() => setExpandedRank(expandedRank === v.rank ? null : v.rank)}
                />
              ))}
            </div>
            {variants.longTailVariants > 0 && (
              <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#FAFBFC", border: "1px dashed #DDE3EC", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "#9AAABB", flex: 1 }}>
                  + {variants.longTailVariants} rare variant{variants.longTailVariants !== 1 ? "s" : ""} covering {variants.longTailCases} case{variants.longTailCases !== 1 ? "s" : ""}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#9AAABB" }}>long tail</span>
              </div>
            )}
          </>
        )}

        {/* Hint pointing to Stage 5 (Stage 4 visual overlay is deferred) */}
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "rgba(38,188,113,0.04)", border: "1px solid rgba(38,188,113,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12 }}>✦</span>
          <span style={{ fontSize: 11, color: "#5C6E84", flex: 1 }}>
            Next: <strong>Stage 5 (Findings)</strong> below quantifies these deviations into ranked £-value findings using the country and process repository.
          </span>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: "graph" | "list" }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
        fontSize: 12, fontWeight: 700,
        color: active ? "#1A5AFF" : "#9AAABB",
        borderBottom: `2px solid ${active ? "#1A5AFF" : "transparent"}`,
        marginBottom: -1,
      }}
    >
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon === "graph" ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m-8 5h8m-8 5h8M3 17l3.5-3.5L9 16l4-4 3 3" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        )}
      </svg>
      {label}
    </button>
  );
}

function VariantCard({
  variant, expanded, onToggle,
}: { variant: Variant; expanded: boolean; onToggle: () => void }) {
  // Color top variant green (likely happy path), others neutral / orange
  const isTop = variant.rank === 1;
  const accent = isTop ? "#1A8F4F" : variant.pct >= 5 ? "#B07800" : "#9AAABB";
  const accentBg = isTop ? "rgba(46,204,113,0.04)" : variant.pct >= 5 ? "rgba(255,172,9,0.04)" : "#FAFBFC";
  const accentBorder = isTop ? "rgba(46,204,113,0.2)" : variant.pct >= 5 ? "rgba(255,172,9,0.2)" : "#EEF2F8";

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${accentBorder}`, background: accentBg, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        {/* Rank badge */}
        <span style={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: accent, background: "#fff", border: `1.5px solid ${accent}`,
        }}>
          #{variant.rank}
        </span>

        {/* Cases & pct */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#001C3D" }}>
              {variant.caseCount} case{variant.caseCount !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>
              {variant.pct.toFixed(1)}%
            </span>
            <span style={{ fontSize: 10, color: "#9AAABB" }}>
              · avg cycle {formatHours(variant.avgCycleHours)}
            </span>
            <span style={{ fontSize: 10, color: "#9AAABB" }}>
              · {variant.activities.length} step{variant.activities.length !== 1 ? "s" : ""}
            </span>
          </div>
          {/* Frequency bar */}
          <div style={{ marginTop: 6, height: 4, background: "#F5F7F9", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, variant.pct)}%`, height: "100%", background: accent, borderRadius: 2 }} />
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="14" height="14" fill="none" stroke="#9AAABB" viewBox="0 0 24 24"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded — show the path */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${accentBorder}` }}>
          {/* Path */}
          <div style={{ fontSize: 9, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12, marginBottom: 8 }}>
            Path
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {variant.activities.map((a, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  background: "#fff", border: `1px solid ${accentBorder}`,
                  color: "#001C3D", fontWeight: 500, whiteSpace: "nowrap",
                }}>
                  {a}
                </span>
                {i < variant.activities.length - 1 && (
                  <span style={{ color: "#CBD5E1", fontSize: 10 }}>→</span>
                )}
              </span>
            ))}
          </div>

          {/* Sample case IDs */}
          {variant.caseIdsSample.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12, marginBottom: 6 }}>
                Sample cases
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {variant.caseIdsSample.map((id) => (
                  <span key={id} style={{ fontSize: 10, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4, background: "#FAFBFC", border: "1px solid #EEF2F8", color: "#5C6E84" }}>
                    {id}
                  </span>
                ))}
                {variant.caseCount > variant.caseIdsSample.length && (
                  <span style={{ fontSize: 10, color: "#9AAABB", padding: "2px 6px" }}>
                    +{variant.caseCount - variant.caseIdsSample.length} more
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function StatTile({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: "#FAFBFC", border: "1px solid #EEF2F8" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ fontSize: small ? 11 : 18, fontWeight: 800, color: "#001C3D", marginTop: 3, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ──────────────────────────────────────────────────────────────────────────
// Mapping editor (per-upload column role overrides)
// ──────────────────────────────────────────────────────────────────────────

function MappingEditor({ upload, onChange }: { upload: UploadRecord; onChange: (patch: Partial<UploadRecord>) => void }) {
  const cols = upload.schemaInference?.columns?.map((c) => c.name) ?? [];

  const rolePicker = (label: string, role: keyof UploadRecord, hint: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 90, fontSize: 11, fontWeight: 600, color: "#374D6C" }}>{label}</div>
      <select
        value={(upload[role] as string) ?? ""}
        onChange={(e) => onChange({ [role]: e.target.value || null } as Partial<UploadRecord>)}
        style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #DDE3EC", background: "#fff", color: "#001C3D", flex: 1, cursor: "pointer" }}
      >
        <option value="">— {hint} —</option>
        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rolePicker("Case ID", "caseIdColumn", "required")}
      {rolePicker("Timestamp", "timestampColumn", "required")}
      {rolePicker("Activity", "activityColumn", "optional — leave blank if file = single activity")}
      {!upload.activityColumn && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 90, fontSize: 11, fontWeight: 600, color: "#374D6C" }}>Activity name</div>
          <input
            type="text"
            value={upload.activityFallback ?? ""}
            onChange={(e) => onChange({ activityFallback: e.target.value || null })}
            placeholder="e.g. Application Submitted"
            style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #DDE3EC", background: "#fff", color: "#001C3D", flex: 1 }}
          />
        </div>
      )}
      {rolePicker("Actor", "actorColumn", "optional")}

      {upload.schemaInference?.notes && (
        <div style={{ fontSize: 10, color: "#9AAABB", fontStyle: "italic", marginTop: 4 }}>
          {upload.schemaInference.notes}
        </div>
      )}
    </div>
  );
}
