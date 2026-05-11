"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOB_CATALOG } from "@/types";
import { AddProcessModal } from "./AddProcessModal";

interface Process {
  id: string;
  lineOfBusiness: string;
  processKey: string;
  processName: string;
  processMap: unknown;
  dataRequest: unknown;
  status: string;
}

interface ProcessesSectionProps {
  engagementId: string;
  initialProcesses: Process[];
}

export function ProcessesSection({ engagementId, initialProcesses }: ProcessesSectionProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdded() {
    setShowModal(false);
    router.refresh();
  }

  async function handleDelete(e: React.MouseEvent, p: Process) {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm(`Delete process "${p.processName}"?\n\nThis permanently removes the process and its uploads, event logs, activity table, and findings. Cannot be undone.`);
    if (!ok) return;
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/processes/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeletingId(null);
        alert("Delete failed. Check the server log.");
        return;
      }
      router.refresh();
    } catch {
      setDeletingId(null);
      alert("Delete failed. Network error.");
    }
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5C6E84", marginBottom: 3 }}>
              Discovery Processes
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.01em" }}>
              {initialProcesses.length === 0
                ? "No processes added yet"
                : `${initialProcesses.length} process${initialProcesses.length !== 1 ? "es" : ""}`}
            </h3>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
              padding: "8px 18px", borderRadius: 30, background: "#1A5AFF", color: "#fff",
              border: "none", cursor: "pointer",
            }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Process
          </button>
        </div>

        {initialProcesses.length === 0 ? (
          <div
            style={{ border: "2px dashed #DDE3EC", borderRadius: 14, padding: "40px 24px", textAlign: "center", background: "#fff", cursor: "pointer" }}
            onClick={() => setShowModal(true)}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>◇</div>
            <p style={{ fontSize: 13, color: "#5C6E84", marginBottom: 4 }}>No processes yet</p>
            <p style={{ fontSize: 12, color: "#5C6E84" }}>Add a process to start mapping and collecting data</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {initialProcesses.map((p) => {
              const lob = LOB_CATALOG[p.lineOfBusiness as keyof typeof LOB_CATALOG];
              const hasMap = !!(p.processMap && (p.processMap as { nodes?: unknown[] }).nodes?.length);
              const hasRequest = !!p.dataRequest;

              return (
                <a
                  key={p.id}
                  href={`/engagements/${engagementId}/processes/${p.id}`}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div style={{
                    background: "#fff", border: "1px solid #DDE3EC", borderRadius: 14,
                    padding: "16px 18px", cursor: "pointer", transition: "all 0.15s",
                  }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = lob?.color ?? "#1A5AFF";
                      el.style.boxShadow = `0 4px 16px ${lob?.color ?? "#1A5AFF"}20`;
                      el.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "#DDE3EC";
                      el.style.boxShadow = "none";
                      el.style.transform = "translateY(0)";
                    }}
                  >
                    {/* LOB badge + name + delete */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, flexShrink: 0, marginTop: 1,
                        background: lob?.bg ?? "rgba(26,90,255,0.08)",
                        color: lob?.color ?? "#1A5AFF",
                      }}>
                        {lob?.label ?? p.lineOfBusiness}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#001C3D", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                        {p.processName}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, p)}
                        disabled={deletingId === p.id}
                        aria-label="Delete process"
                        title="Delete process"
                        style={{
                          width: 24, height: 24, borderRadius: 5, background: "transparent",
                          border: "1px solid transparent",
                          color: deletingId === p.id ? "#CBD5E1" : "#9AAABB",
                          cursor: deletingId === p.id ? "wait" : "pointer",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { if (deletingId !== p.id) { (e.currentTarget as HTMLButtonElement).style.color = "#C0392B"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.2)"; } }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9AAABB"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Status indicators */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <StatusPill done={hasMap} label="Process Map" />
                      <StatusPill done={hasRequest} label="Data Request" />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <AddProcessModal
          engagementId={engagementId}
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
        />
      )}
    </>
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
