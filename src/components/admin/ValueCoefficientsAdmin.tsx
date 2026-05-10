"use client";

import { useEffect, useMemo, useState } from "react";

type Coefficient = {
  id: string;
  country: string;
  institutionType: string;
  key: string;
  value: number;
  unit: string;
  category: string;
  description: string;
  source: string;
  validFrom: string;
  validTo: string | null;
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  operational: { bg: "rgba(26,90,255,0.08)", text: "#1A5AFF" },
  regulatory:  { bg: "rgba(239,68,68,0.08)", text: "#C0392B" },
  risk:        { bg: "rgba(255,172,9,0.08)", text: "#B07800" },
};

export function ValueCoefficientsAdmin() {
  const [items, setItems] = useState<Coefficient[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ country: "United Kingdom", key: "", value: "", unit: "", category: "operational", description: "", source: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/value-coefficients");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const countries = useMemo(() => Array.from(new Set(items.map((i) => i.country))).sort(), [items]);
  const filtered = country ? items.filter((i) => i.country === country) : items;

  // Group by category
  const groups = useMemo(() => {
    const g: Record<string, Coefficient[]> = { operational: [], regulatory: [], risk: [] };
    for (const it of filtered) (g[it.category] ?? (g[it.category] = [])).push(it);
    return g;
  }, [filtered]);

  async function saveValue(id: string, value: string) {
    const res = await fetch(`/api/admin/value-coefficients/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: Number(value) }),
    });
    if (res.ok) { setEditingId(null); load(); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this coefficient?")) return;
    const res = await fetch(`/api/admin/value-coefficients/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function add() {
    if (!form.country || !form.key || !form.value || !form.unit) return;
    const res = await fetch("/api/admin/value-coefficients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ country: form.country, key: "", value: "", unit: "", category: "operational", description: "", source: "" });
      setAdding(false);
      load();
    }
  }

  if (loading) return <div style={{ padding: 12, color: "#9AAABB", fontSize: 12 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>Country</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
          <option value="">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "#9AAABB", flex: 1 }}>{filtered.length} coefficient{filtered.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setAdding(!adding)}
          style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: "#1A5AFF", color: "#fff", border: "none", cursor: "pointer" }}>
          + Add Coefficient
        </button>
      </div>

      {adding && (
        <div style={{ padding: 12, background: "rgba(26,90,255,0.04)", borderRadius: 10, border: "1px solid rgba(26,90,255,0.15)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={inputStyle} />
            <input placeholder="Key (e.g., fte_ops_hourly_rate)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} style={inputStyle} />
            <input placeholder="Value" type="number" step="0.001" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={inputStyle} />
            <input placeholder="Unit (GBP/hr)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto auto", gap: 8 }}>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              <option value="operational">Operational</option>
              <option value="regulatory">Regulatory</option>
              <option value="risk">Risk</option>
            </select>
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
            <input placeholder="Source citation" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={inputStyle} />
            <button onClick={add} style={{ ...btnStyle, background: "#1A5AFF", color: "#fff" }}>Create</button>
            <button onClick={() => setAdding(false)} style={btnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {/* Groups */}
      {(["operational", "regulatory", "risk"] as const).map((cat) => {
        const list = groups[cat] ?? [];
        if (list.length === 0) return null;
        const cs = CATEGORY_STYLES[cat];
        return (
          <div key={cat}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: cs.text, textTransform: "uppercase", letterSpacing: "0.08em",
              padding: "4px 8px", background: cs.bg, borderRadius: 4, marginBottom: 6, display: "inline-block",
            }}>
              {cat} · {list.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {list.map((c) => {
                const isEditing = editingId === c.id;
                return (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 220px 110px 80px 80px 28px", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid #EEF2F8" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#001C3D", fontFamily: "monospace" }}>{c.key}</div>
                      <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 1 }}>{c.description || "—"}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "#5C6E84" }}>
                      {c.country}{c.institutionType ? ` · ${c.institutionType}` : ""}
                    </div>
                    {isEditing ? (
                      <input type="number" step="0.001" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveValue(c.id, editValue); if (e.key === "Escape") setEditingId(null); }}
                        autoFocus
                        style={{ ...inputStyle, fontFamily: "monospace", fontWeight: 700, textAlign: "right" }} />
                    ) : (
                      <div onClick={() => { setEditingId(c.id); setEditValue(String(c.value)); }}
                        style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#001C3D", textAlign: "right", cursor: "pointer", padding: "4px 6px", borderRadius: 4 }}
                        title="Click to edit">
                        {c.value.toLocaleString()}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "#5C6E84", fontFamily: "monospace" }}>{c.unit}</div>
                    <div style={{ fontSize: 9, color: "#9AAABB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.source}>{c.source || "—"}</div>
                    <button onClick={() => remove(c.id)} style={{ ...btnStyle, color: "#9AAABB", padding: "3px 6px" }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && !adding && (
        <div style={{ padding: 24, textAlign: "center", color: "#9AAABB", fontSize: 12, background: "#FAFBFC", borderRadius: 10 }}>
          No coefficients{country ? ` for ${country}` : ""}. Click "+ Add Coefficient" to create one.
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 11, padding: "5px 10px", border: "1px solid #DDE3EC", borderRadius: 6, background: "#fff", outline: "none", color: "#001C3D",
};
const btnStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 16, background: "transparent", color: "#5C6E84", border: "none", cursor: "pointer",
};
