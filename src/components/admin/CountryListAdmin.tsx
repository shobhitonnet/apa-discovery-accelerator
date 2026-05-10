"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CountryRow = {
  country: string;
  coefficientCount: number;
  activeProcessCount: number;
  draftProcessCount: number;
};

export function CountryListAdmin() {
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCountry, setNewCountry] = useState("");

  async function load() {
    const res = await fetch("/api/admin/countries");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    // Adding a country = creating its first coefficient (placeholder) so it shows up.
    // Or simpler: navigate to the country detail page directly with the new name.
    if (!newCountry.trim()) return;
    // Just navigate — country becomes "real" once user adds coefficients/processes there.
    window.location.href = `/admin/country/${encodeURIComponent(newCountry.trim())}`;
  }

  if (loading) return <div style={{ color: "#9AAABB", fontSize: 12 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#5C6E84" }}>{rows.length} {rows.length === 1 ? "country" : "countries"}</span>
        <button onClick={() => setAdding(!adding)}
          style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: "#06B6D4", color: "#fff", border: "none", cursor: "pointer" }}>
          + Add Country
        </button>
      </div>

      {adding && (
        <div style={{ display: "flex", gap: 8, padding: 10, background: "rgba(6,182,212,0.04)", borderRadius: 10, border: "1px solid rgba(6,182,212,0.2)" }}>
          <input placeholder="Country name (e.g., United States)" value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            autoFocus
            style={{ flex: 1, fontSize: 12, padding: "6px 10px", border: "1px solid #DDE3EC", borderRadius: 6, background: "#fff", outline: "none", color: "#001C3D" }} />
          <button onClick={add} style={{ fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 16, background: "#06B6D4", color: "#fff", border: "none", cursor: "pointer" }}>
            Open →
          </button>
          <button onClick={() => setAdding(false)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 16, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}

      {rows.map((r) => (
        <Link key={r.country} href={`/admin/country/${encodeURIComponent(r.country)}`} style={{ textDecoration: "none" }}>
          <div style={{
            background: "#fff", border: "1px solid #DDE3EC", borderRadius: 12, padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#06B6D4"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(6,182,212,0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#DDE3EC"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(6,182,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#06B6D4", flexShrink: 0 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21l-9-9m0 0l9-9m-9 9h18" transform="rotate(180 12 12)" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#001C3D" }}>{r.country}</div>
              <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 2, display: "flex", gap: 12 }}>
                <span><strong style={{ color: "#374D6C" }}>{r.coefficientCount}</strong> coefficients</span>
                <span>·</span>
                <span style={{ color: r.activeProcessCount > 0 ? "#1A8F4F" : "#9AAABB" }}>
                  <strong>{r.activeProcessCount}</strong> active process{r.activeProcessCount !== 1 ? "es" : ""}
                </span>
                {r.draftProcessCount > 0 && (
                  <>
                    <span>·</span>
                    <span style={{ color: "#B07800" }}><strong>{r.draftProcessCount}</strong> draft</span>
                  </>
                )}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#06B6D4" }}>Open →</span>
          </div>
        </Link>
      ))}

      {rows.length === 0 && !adding && (
        <div style={{ padding: 24, textAlign: "center", color: "#9AAABB", fontSize: 12, background: "#FAFBFC", borderRadius: 10 }}>
          No countries yet. Click "+ Add Country" to create one.
        </div>
      )}
    </div>
  );
}
