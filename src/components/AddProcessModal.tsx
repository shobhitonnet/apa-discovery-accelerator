"use client";

import { useState } from "react";
import { LOB_CATALOG, ALL_LOBS } from "@/types";
import type { LineOfBusiness } from "@/types";

interface AddProcessModalProps {
  engagementId: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddProcessModal({ engagementId, onClose, onAdded }: AddProcessModalProps) {
  const [selectedLob, setSelectedLob] = useState<LineOfBusiness>("retail");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const lob = LOB_CATALOG[selectedLob];

  async function handleAdd() {
    if (!selectedKey) return;
    const process = lob.processes.find((p) => p.key === selectedKey);
    if (!process) return;

    setLoading(true);
    await fetch(`/api/engagements/${engagementId}/processes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineOfBusiness: selectedLob,
        processKey: selectedKey,
        processName: process.name,
      }),
    });
    setLoading(false);
    onAdded();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,28,61,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600, boxShadow: "0 24px 64px rgba(0,28,61,0.2)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #EEF2F8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5C6E84", marginBottom: 4 }}>Add to engagement</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.02em" }}>Select a process</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#5C6E84", fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* LOB tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #EEF2F8", padding: "0 28px" }}>
          {ALL_LOBS.map((lob) => {
            const def = LOB_CATALOG[lob];
            const active = selectedLob === lob;
            return (
              <button
                key={lob}
                onClick={() => { setSelectedLob(lob); setSelectedKey(""); }}
                style={{
                  fontSize: 12, fontWeight: 700, padding: "12px 16px", background: "none", border: "none",
                  cursor: "pointer", color: active ? def.color : "#5C6E84",
                  borderBottom: active ? `2px solid ${def.color}` : "2px solid transparent",
                  marginBottom: -1, transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >
                {def.label}
              </button>
            );
          })}
        </div>

        {/* Process list */}
        <div style={{ padding: "16px 28px 24px", maxHeight: 340, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {lob.processes.map((process) => {
              const selected = selectedKey === process.key;
              return (
                <button
                  key={process.key}
                  onClick={() => process.active && setSelectedKey(process.key)}
                  disabled={!process.active}
                  style={{
                    textAlign: "left", borderRadius: 12, position: "relative",
                    border: selected ? `1.5px solid ${lob.color}` : "1px solid #DDE3EC",
                    background: selected ? lob.bg : process.active ? "#F5F7F9" : "#FAFAFA",
                    padding: "12px 14px", transition: "all 0.15s",
                    cursor: process.active ? "pointer" : "default",
                    opacity: process.active ? 1 : 0.55,
                  }}
                >
                  {!process.active && (
                    <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "#EEF2F8", color: "#5C6E84", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Soon
                    </span>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: process.active ? "#001C3D" : "#5C6E84", marginBottom: 4 }}>{process.name}</div>
                  <div style={{ fontSize: 11, color: "#5C6E84", lineHeight: 1.4 }}>{process.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid #EEF2F8", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{ fontSize: 13, color: "#5C6E84", background: "none", border: "none", cursor: "pointer", padding: "10px 16px" }}>
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedKey || loading}
            style={{
              fontSize: 13, fontWeight: 700, padding: "10px 24px", borderRadius: 30,
              background: selectedKey && !loading ? lob.color : "#DDE3EC",
              color: selectedKey && !loading ? "#fff" : "#5C6E84",
              border: "none", cursor: selectedKey && !loading ? "pointer" : "default", transition: "all 0.15s",
            }}
          >
            {loading ? "Adding…" : "Add Process"}
          </button>
        </div>
      </div>
    </div>
  );
}
