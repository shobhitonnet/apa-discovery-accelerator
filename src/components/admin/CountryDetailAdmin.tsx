"use client";

import { useEffect, useState } from "react";
import { ValueCoefficientsAdminFiltered } from "@/components/admin/ValueCoefficientsAdminFiltered";

type Activation = {
  id: string;
  country: string;
  processKey: string;
  basedOnTemplateVersion: number;
  isActive: boolean;
  notes: string;
};

type Template = {
  processKey: string;
  name: string;
  version: number;
  description: string;
  lineOfBusiness: string;
};

interface Props {
  country: string;
  availableTemplates: Template[];
}

export function CountryDetailAdmin({ country, availableTemplates }: Props) {
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/country-process-activations?country=${encodeURIComponent(country)}`);
    if (res.ok) setActivations(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, [country]);

  async function activate(processKey: string, version: number) {
    const res = await fetch("/api/admin/country-process-activations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, processKey, basedOnTemplateVersion: version, isActive: false }),
    });
    if (res.ok) { setSelectedKey(""); setAdding(false); load(); }
  }

  async function patch(id: string, body: Partial<Activation>) {
    const res = await fetch(`/api/admin/country-process-activations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this process from the country?")) return;
    const res = await fetch(`/api/admin/country-process-activations/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  // Templates not yet added to this country
  const addedKeys = new Set(activations.map((a) => a.processKey));
  const addable = availableTemplates.filter((t) => !addedKeys.has(t.processKey));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Activated processes */}
      <Section
        title="Activated Processes"
        description={`Processes available for engagements in ${country}. Activate the ones you've reviewed and signed off — engagements bootstrap from the active version.`}
      >
        {loading ? (
          <div style={{ color: "#9AAABB", fontSize: 12 }}>Loading…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#5C6E84" }}>
                {activations.length} process{activations.length !== 1 ? "es" : ""} for {country}
              </span>
              {addable.length > 0 && (
                <button onClick={() => setAdding(!adding)}
                  style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: "#06B6D4", color: "#fff", border: "none", cursor: "pointer" }}>
                  + Add Process
                </button>
              )}
            </div>

            {adding && (
              <div style={{ padding: 12, background: "rgba(6,182,212,0.04)", borderRadius: 10, border: "1px solid rgba(6,182,212,0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5C6E84", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Pick a canonical process to fork into {country}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}
                    style={{ flex: 1, fontSize: 12, padding: "6px 10px", border: "1px solid #DDE3EC", borderRadius: 6, background: "#fff", outline: "none", color: "#001C3D" }}>
                    <option value="">— Select a process —</option>
                    {addable.map((t) => (
                      <option key={t.processKey} value={t.processKey}>
                        {t.name} ({t.processKey} v{t.version})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!selectedKey}
                    onClick={() => {
                      const t = addable.find((x) => x.processKey === selectedKey);
                      if (t) activate(t.processKey, t.version);
                    }}
                    style={{ fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 16, background: selectedKey ? "#06B6D4" : "#DDE3EC", color: selectedKey ? "#fff" : "#9AAABB", border: "none", cursor: selectedKey ? "pointer" : "not-allowed" }}>
                    Add
                  </button>
                  <button onClick={() => setAdding(false)}
                    style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 16, background: "transparent", color: "#5C6E84", border: "1px solid #DDE3EC", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {activations.map((a) => {
              const tpl = availableTemplates.find((t) => t.processKey === a.processKey);
              return (
                <div key={a.id} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #DDE3EC", background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em",
                    background: a.isActive ? "rgba(38,188,113,0.12)" : "#F5F7F9",
                    color: a.isActive ? "#1A8F4F" : "#9AAABB",
                    border: `1px solid ${a.isActive ? "rgba(38,188,113,0.25)" : "#DDE3EC"}`,
                  }}>
                    {a.isActive ? "Active" : "Draft"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#001C3D" }}>
                      {tpl?.name ?? a.processKey}
                    </div>
                    <div style={{ fontSize: 10, color: "#9AAABB", marginTop: 1, fontFamily: "monospace" }}>
                      {a.processKey} · forked from canonical v{a.basedOnTemplateVersion}
                    </div>
                  </div>
                  <button disabled title="Open editor (coming soon)"
                    style={{ fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 16, background: "#F5F7F9", color: "#9AAABB", border: "1px solid #DDE3EC", cursor: "not-allowed" }}>
                    Edit
                  </button>
                  <button onClick={() => patch(a.id, { isActive: !a.isActive })}
                    style={{ fontSize: 10, fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: a.isActive ? "#F5F7F9" : "#1A8F4F", color: a.isActive ? "#5C6E84" : "#fff", border: a.isActive ? "1px solid #DDE3EC" : "none", cursor: "pointer" }}>
                    {a.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => remove(a.id)}
                    style={{ fontSize: 10, fontWeight: 700, padding: "5px 8px", borderRadius: 16, background: "transparent", color: "#9AAABB", border: "none", cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              );
            })}

            {activations.length === 0 && !adding && (
              <div style={{ padding: 20, textAlign: "center", color: "#9AAABB", fontSize: 12, background: "#FAFBFC", borderRadius: 10 }}>
                No processes activated for {country}. Click "+ Add Process" to fork one from the Process Repository.
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Value coefficients (filtered to this country) */}
      <Section
        title="Value Coefficients"
        description={`Country-specific values used by Stage 5 to quantify findings (FTE rates, fines, defaults). Click any value to edit inline.`}
      >
        <ValueCoefficientsAdminFiltered country={country} />
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 11, color: "#9AAABB", margin: 0, marginTop: 1 }}>{description}</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDE3EC", padding: 16 }}>{children}</div>
    </div>
  );
}
