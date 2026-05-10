"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProcessTemplate = {
  id: string;
  processKey: string;
  version: number;
  isActive: boolean;
  name: string;
  description: string;
  lineOfBusiness: string;
  applicableInstTypes: string[];
  subProcesses: unknown;
  metricDefinitions: unknown;
  notes: string;
};

const LOB_OPTIONS = ["retail", "sme", "commercial", "wealth"];
const INST_TYPES = ["bank", "credit_union", "neobank", "insurance", "building_society", "cooperative", "fintech"];

export function ProcessTemplatesAdmin() {
  const [items, setItems] = useState<ProcessTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newProcessKey, setNewProcessKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newLob, setNewLob] = useState("retail");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/process-templates");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function patch(id: string, body: Partial<ProcessTemplate>) {
    const res = await fetch(`/api/admin/process-templates/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this process template?")) return;
    const res = await fetch(`/api/admin/process-templates/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function add() {
    if (!newProcessKey || !newName) return;
    const res = await fetch("/api/admin/process-templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processKey: newProcessKey, name: newName, lineOfBusiness: newLob, version: 1, isActive: false }),
    });
    if (res.ok) {
      setNewProcessKey(""); setNewName(""); setAdding(false);
      load();
    }
  }

  if (loading) return <div style={{ padding: 12, color: "#9AAABB", fontSize: 12 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#5C6E84" }}>{items.length} process template{items.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setAdding(!adding)}
          style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: "#1A5AFF", color: "#fff", border: "none", cursor: "pointer" }}>
          + Add Template
        </button>
      </div>

      {adding && (
        <div style={{ display: "flex", gap: 8, padding: 10, background: "rgba(26,90,255,0.04)", borderRadius: 10, border: "1px solid rgba(26,90,255,0.15)" }}>
          <input placeholder="processKey (e.g., retail_personal_loan)" value={newProcessKey} onChange={(e) => setNewProcessKey(e.target.value)}
            style={inputStyle} />
          <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <select value={newLob} onChange={(e) => setNewLob(e.target.value)} style={inputStyle}>
            {LOB_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={add} style={{ ...btnStyle, background: "#1A5AFF", color: "#fff" }}>Create</button>
          <button onClick={() => setAdding(false)} style={btnStyle}>Cancel</button>
        </div>
      )}

      {items.map((t) => (
        <Link key={t.id} href={`/admin/process/${encodeURIComponent(t.processKey)}`} style={{ textDecoration: "none" }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #DDE3EC", background: "#fff", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1A5AFF"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(26,90,255,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#DDE3EC"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em",
                background: t.isActive ? "rgba(38,188,113,0.12)" : "#F5F7F9",
                color: t.isActive ? "#1A8F4F" : "#9AAABB",
                border: `1px solid ${t.isActive ? "rgba(38,188,113,0.25)" : "#DDE3EC"}`,
              }}>
                {t.isActive ? "Active" : "Draft"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#001C3D" }}>{t.name}</span>
                  <span style={{ fontSize: 10, color: "#9AAABB", fontFamily: "monospace" }}>{t.processKey} · v{t.version}</span>
                </div>
                <div style={{ fontSize: 10, color: "#5C6E84", marginTop: 1 }}>
                  {t.lineOfBusiness} · {t.applicableInstTypes.length > 0 ? t.applicableInstTypes.join(", ") : "all institution types"}
                </div>
              </div>
              <button onClick={(e) => { e.preventDefault(); patch(t.id, { isActive: !t.isActive }); }}
                style={{ ...btnStyle, background: t.isActive ? "#F5F7F9" : "#1A5AFF", color: t.isActive ? "#5C6E84" : "#fff" }}>
                {t.isActive ? "Deactivate" : "Activate"}
              </button>
              <button onClick={(e) => { e.preventDefault(); remove(t.id); }} style={{ ...btnStyle, color: "#9AAABB" }}>✕</button>
              <span style={{ color: "#9AAABB", fontSize: 14 }}>›</span>
            </div>

            {t.description && (
              <div style={{ fontSize: 11, color: "#5C6E84", lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid #F0F3F7" }}>
                {t.description}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#9AAABB" }}>
              <span><strong style={{ color: "#374D6C" }}>{Array.isArray(t.subProcesses) ? (t.subProcesses as unknown[]).length : 0}</strong> sub-processes</span>
              <span><strong style={{ color: "#374D6C" }}>{Array.isArray(t.metricDefinitions) ? (t.metricDefinitions as unknown[]).length : 0}</strong> metric definitions</span>
              {t.notes && <span style={{ fontStyle: "italic" }}>· has notes</span>}
            </div>
          </div>
        </Link>
      ))}

      {items.length === 0 && !adding && (
        <div style={{ padding: 24, textAlign: "center", color: "#9AAABB", fontSize: 12, background: "#FAFBFC", borderRadius: 10 }}>
          No process templates yet. Click "+ Add Template" to create one.
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 11, padding: "5px 10px", border: "1px solid #DDE3EC", borderRadius: 6, background: "#fff", outline: "none", color: "#001C3D",
};
const btnStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: "#F5F7F9", color: "#5C6E84", border: "none", cursor: "pointer",
};
