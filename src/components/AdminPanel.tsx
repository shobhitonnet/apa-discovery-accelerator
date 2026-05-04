"use client";

import { useState, useCallback } from "react";

const PROCESS_TEMPLATE_OPTIONS = [
  { value: "mortgage", label: "Mortgage" },
  { value: "sme_loan", label: "SME Loan" },
  { value: "dispute", label: "Dispute" },
  { value: "onboarding", label: "Onboarding" },
  { value: "generic", label: "Generic (all)" },
];

const TEMPLATE_COLORS: Record<string, string> = {
  mortgage: "#3366FF",
  sme_loan: "#FFAC09",
  dispute: "#EF4444",
  onboarding: "#26BC71",
  generic: "#64748B",
};

interface ProcessStep {
  id: string;
  label: string;
  processTemplate: string;
  order: number;
  description: string;
}

interface AppSystem {
  id: string;
  name: string;
  color: string;
  description: string;
  processTemplates: string[];
}

interface ProcessActor {
  id: string;
  name: string;
  color: string;
  description: string;
  type: string;
}

const ACTOR_TYPE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "front-office", label: "Front Office" },
  { value: "back-office", label: "Back Office" },
  { value: "operations", label: "Operations" },
  { value: "fraud", label: "Fraud" },
  { value: "compliance", label: "Compliance" },
  { value: "external", label: "External" },
  { value: "automated", label: "Automated" },
];

interface AdminPanelProps {
  initialSteps: ProcessStep[];
  initialSystems: AppSystem[];
  initialActors: ProcessActor[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color + "20",
        border: `1px solid ${color}50`,
        color,
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 7,
  color: "#fff",
  fontSize: 12,
  padding: "7px 10px",
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  background: "#3366FF",
  border: "none",
  borderRadius: 7,
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  padding: "7px 16px",
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 6,
  color: "#EF4444",
  fontSize: 11,
  padding: "4px 10px",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "rgba(255,255,255,0.6)",
  fontSize: 11,
  padding: "4px 10px",
  cursor: "pointer",
};

// ─── Steps Tab ────────────────────────────────────────────────────────────────

function StepsTab({ initialSteps }: { initialSteps: ProcessStep[] }) {
  const [steps, setSteps] = useState<ProcessStep[]>(initialSteps);
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ProcessStep>>({});
  const [adding, setAdding] = useState(false);
  const [newStep, setNewStep] = useState({ label: "", processTemplate: "generic", order: 0, description: "" });
  const [busy, setBusy] = useState(false);

  const filtered = filterTemplate === "all"
    ? steps
    : steps.filter((s) => s.processTemplate === filterTemplate);

  const grouped = PROCESS_TEMPLATE_OPTIONS.reduce<Record<string, ProcessStep[]>>((acc, t) => {
    acc[t.value] = filtered.filter((s) => s.processTemplate === t.value).sort((a, b) => a.order - b.order);
    return acc;
  }, {});

  const startEdit = (step: ProcessStep) => {
    setEditingId(step.id);
    setEditValues({ label: step.label, processTemplate: step.processTemplate, order: step.order, description: step.description });
  };

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setBusy(true);
    const res = await fetch(`/api/admin/steps/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    const updated = await res.json();
    setSteps((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...updated } : s)));
    setEditingId(null);
    setBusy(false);
  }, [editingId, editValues]);

  const deleteStep = useCallback(async (id: string) => {
    if (!confirm("Delete this step?")) return;
    await fetch(`/api/admin/steps/${id}`, { method: "DELETE" });
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addStep = useCallback(async () => {
    if (!newStep.label.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newStep),
    });
    const created = await res.json();
    setSteps((prev) => [...prev, created]);
    setNewStep({ label: "", processTemplate: "generic", order: 0, description: "" });
    setAdding(false);
    setBusy(false);
  }, [newStep]);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <select
          value={filterTemplate}
          onChange={(e) => setFilterTemplate(e.target.value)}
          style={{ ...selectStyle, width: "auto", minWidth: 160 }}
        >
          <option value="all">All templates</option>
          {PROCESS_TEMPLATE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{filtered.length} steps</span>
        <button style={btnPrimary} onClick={() => setAdding(true)}>+ Add Step</button>
      </div>

      {/* Add form */}
      {adding && (
        <div
          style={{
            background: "rgba(51,102,255,0.07)",
            border: "1px solid rgba(51,102,255,0.2)",
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Label *</div>
            <input
              style={inputStyle}
              placeholder="e.g. Pre-qualification"
              value={newStep.label}
              onChange={(e) => setNewStep((p) => ({ ...p, label: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Process Template *</div>
            <select
              style={selectStyle}
              value={newStep.processTemplate}
              onChange={(e) => setNewStep((p) => ({ ...p, processTemplate: e.target.value }))}
            >
              {PROCESS_TEMPLATE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button style={btnPrimary} onClick={addStep} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button style={btnGhost} onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}

      {/* Grouped tables */}
      {PROCESS_TEMPLATE_OPTIONS.filter((t) => filterTemplate === "all" || t.value === filterTemplate).map((t) => {
        const group = grouped[t.value];
        if (!group || group.length === 0) return null;
        return (
          <div key={t.value} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ColorDot color={TEMPLATE_COLORS[t.value]} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "1.5px" }}>
                {t.label}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{group.length}</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
              {group.map((step, i) => (
                <div
                  key={step.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr 80px auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}
                >
                  {editingId === step.id ? (
                    <>
                      <input
                        style={{ ...inputStyle, width: 36, textAlign: "center", padding: "5px 4px" }}
                        type="number"
                        value={editValues.order ?? step.order}
                        onChange={(e) => setEditValues((p) => ({ ...p, order: Number(e.target.value) }))}
                      />
                      <input
                        style={inputStyle}
                        value={editValues.label ?? step.label}
                        onChange={(e) => setEditValues((p) => ({ ...p, label: e.target.value }))}
                        autoFocus
                      />
                      <select
                        style={selectStyle}
                        value={editValues.processTemplate ?? step.processTemplate}
                        onChange={(e) => setEditValues((p) => ({ ...p, processTemplate: e.target.value }))}
                      >
                        {PROCESS_TEMPLATE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={btnPrimary} onClick={saveEdit} disabled={busy}>✓</button>
                        <button style={btnGhost} onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 700, textAlign: "center" }}>
                        {step.order}
                      </span>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{step.label}</span>
                      <Badge label={t.label} color={TEMPLATE_COLORS[t.value]} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={btnGhost} onClick={() => startEdit(step)}>Edit</button>
                        <button style={btnDanger} onClick={() => deleteStep(step.id)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Systems Tab ──────────────────────────────────────────────────────────────

function SystemsTab({ initialSystems }: { initialSystems: AppSystem[] }) {
  const [systems, setSystems] = useState<AppSystem[]>(initialSystems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<AppSystem>>({});
  const [adding, setAdding] = useState(false);
  const [newSystem, setNewSystem] = useState({ name: "", color: "#3366FF", description: "", processTemplates: ["*"] });
  const [busy, setBusy] = useState(false);

  const startEdit = (sys: AppSystem) => {
    setEditingId(sys.id);
    setEditValues({ name: sys.name, color: sys.color, description: sys.description, processTemplates: sys.processTemplates });
  };

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setBusy(true);
    const res = await fetch(`/api/admin/systems/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    const updated = await res.json();
    setSystems((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...updated } : s)));
    setEditingId(null);
    setBusy(false);
  }, [editingId, editValues]);

  const deleteSystem = useCallback(async (id: string) => {
    if (!confirm("Delete this system?")) return;
    await fetch(`/api/admin/systems/${id}`, { method: "DELETE" });
    setSystems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addSystem = useCallback(async () => {
    if (!newSystem.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/systems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSystem),
    });
    const created = await res.json();
    setSystems((prev) => [...prev, created]);
    setNewSystem({ name: "", color: "#3366FF", description: "", processTemplates: ["*"] });
    setAdding(false);
    setBusy(false);
  }, [newSystem]);

  const toggleTemplate = (sys: Partial<AppSystem>, tpl: string) => {
    const current = sys.processTemplates ?? [];
    if (tpl === "*") return { processTemplates: ["*"] };
    const withoutStar = current.filter((t) => t !== "*");
    const next = withoutStar.includes(tpl)
      ? withoutStar.filter((t) => t !== tpl)
      : [...withoutStar, tpl];
    return { processTemplates: next.length === 0 ? ["*"] : next };
  };

  const TemplateSelector = ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (v: string[]) => void;
  }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      <button
        onClick={() => onChange(["*"])}
        style={{
          ...btnGhost,
          background: value.includes("*") ? "rgba(100,116,139,0.25)" : undefined,
          borderColor: value.includes("*") ? "#64748B" : undefined,
          color: value.includes("*") ? "#fff" : undefined,
          fontSize: 10,
          padding: "3px 8px",
        }}
      >
        All
      </button>
      {PROCESS_TEMPLATE_OPTIONS.filter((t) => t.value !== "generic").map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(toggleTemplate({ processTemplates: value }, t.value).processTemplates)}
          style={{
            ...btnGhost,
            background: value.includes(t.value) ? TEMPLATE_COLORS[t.value] + "25" : undefined,
            borderColor: value.includes(t.value) ? TEMPLATE_COLORS[t.value] + "60" : undefined,
            color: value.includes(t.value) ? TEMPLATE_COLORS[t.value] : undefined,
            fontSize: 10,
            padding: "3px 8px",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  const templateLabel = (tpls: string[]) => {
    if (tpls.includes("*")) return "All processes";
    return tpls.map((t) => PROCESS_TEMPLATE_OPTIONS.find((o) => o.value === t)?.label ?? t).join(", ");
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{systems.length} systems</span>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={() => setAdding(true)}>+ Add System</button>
      </div>

      {/* Add form */}
      {adding && (
        <div
          style={{
            background: "rgba(51,102,255,0.07)",
            border: "1px solid rgba(51,102,255,0.2)",
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Name *</div>
              <input
                style={inputStyle}
                placeholder="e.g. ESB / MuleSoft"
                value={newSystem.name}
                onChange={(e) => setNewSystem((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Description</div>
              <input
                style={inputStyle}
                placeholder="Short description"
                value={newSystem.description}
                onChange={(e) => setNewSystem((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Color</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="color"
                  value={newSystem.color}
                  onChange={(e) => setNewSystem((p) => ({ ...p, color: e.target.value }))}
                  style={{ width: 36, height: 34, borderRadius: 6, border: "none", cursor: "pointer", background: "none" }}
                />
                <input
                  style={{ ...inputStyle, width: 80 }}
                  value={newSystem.color}
                  onChange={(e) => setNewSystem((p) => ({ ...p, color: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Visible in processes</div>
            <TemplateSelector
              value={newSystem.processTemplates}
              onChange={(v) => setNewSystem((p) => ({ ...p, processTemplates: v }))}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={addSystem} disabled={busy}>{busy ? "Saving…" : "Save System"}</button>
            <button style={btnGhost} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
        {systems.map((sys, i) => (
          <div
            key={sys.id}
            style={{
              padding: "12px 16px",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}
          >
            {editingId === sys.id ? (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Name</div>
                    <input
                      style={inputStyle}
                      value={editValues.name ?? sys.name}
                      onChange={(e) => setEditValues((p) => ({ ...p, name: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Description</div>
                    <input
                      style={inputStyle}
                      value={editValues.description ?? sys.description}
                      onChange={(e) => setEditValues((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Color</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="color"
                        value={editValues.color ?? sys.color}
                        onChange={(e) => setEditValues((p) => ({ ...p, color: e.target.value }))}
                        style={{ width: 36, height: 34, borderRadius: 6, border: "none", cursor: "pointer" }}
                      />
                      <input
                        style={{ ...inputStyle, width: 80 }}
                        value={editValues.color ?? sys.color}
                        onChange={(e) => setEditValues((p) => ({ ...p, color: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Visible in processes</div>
                  <TemplateSelector
                    value={editValues.processTemplates ?? sys.processTemplates}
                    onChange={(v) => setEditValues((p) => ({ ...p, processTemplates: v }))}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btnPrimary} onClick={saveEdit} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                  <button style={btnGhost} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <ColorDot color={sys.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{sys.name}</div>
                  {sys.description && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{sys.description}</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", minWidth: 140 }}>
                  {templateLabel(sys.processTemplates)}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btnGhost} onClick={() => startEdit(sys)}>Edit</button>
                  <button style={btnDanger} onClick={() => deleteSystem(sys.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Actors Tab ───────────────────────────────────────────────────────────────

function ActorsTab({ initialActors }: { initialActors: ProcessActor[] }) {
  const [actors, setActors] = useState<ProcessActor[]>(initialActors);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ProcessActor>>({});
  const [adding, setAdding] = useState(false);
  const [newActor, setNewActor] = useState({ name: "", color: "#3366FF", description: "", type: "back-office" });
  const [busy, setBusy] = useState(false);

  const startEdit = (actor: ProcessActor) => {
    setEditingId(actor.id);
    setEditValues({ name: actor.name, color: actor.color, description: actor.description, type: actor.type });
  };

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setBusy(true);
    const res = await fetch(`/api/admin/actors/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    const updated = await res.json();
    setActors((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a)));
    setEditingId(null);
    setBusy(false);
  }, [editingId, editValues]);

  const deleteActor = useCallback(async (id: string) => {
    if (!confirm("Delete this actor?")) return;
    await fetch(`/api/admin/actors/${id}`, { method: "DELETE" });
    setActors((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addActor = useCallback(async () => {
    if (!newActor.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newActor),
    });
    const created = await res.json();
    setActors((prev) => [...prev, created]);
    setNewActor({ name: "", color: "#3366FF", description: "", type: "back-office" });
    setAdding(false);
    setBusy(false);
  }, [newActor]);

  const typeLabel = (type: string) =>
    ACTOR_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{actors.length} actors</span>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={() => setAdding(true)}>+ Add Actor</button>
      </div>

      {adding && (
        <div style={{ background: "rgba(51,102,255,0.07)", border: "1px solid rgba(51,102,255,0.2)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Name *</div>
              <input style={inputStyle} placeholder="e.g. Risk Analyst" value={newActor.name}
                onChange={(e) => setNewActor((p) => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Description</div>
              <input style={inputStyle} placeholder="Short description" value={newActor.description}
                onChange={(e) => setNewActor((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Type</div>
              <select style={selectStyle} value={newActor.type}
                onChange={(e) => setNewActor((p) => ({ ...p, type: e.target.value }))}>
                {ACTOR_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Color</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="color" value={newActor.color}
                  onChange={(e) => setNewActor((p) => ({ ...p, color: e.target.value }))}
                  style={{ width: 36, height: 34, borderRadius: 6, border: "none", cursor: "pointer" }} />
                <input style={{ ...inputStyle, width: 72 }} value={newActor.color}
                  onChange={(e) => setNewActor((p) => ({ ...p, color: e.target.value }))} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={addActor} disabled={busy}>{busy ? "Saving…" : "Save Actor"}</button>
            <button style={btnGhost} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
        {actors.map((actor, i) => (
          <div key={actor.id} style={{ padding: "12px 16px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            {editingId === actor.id ? (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Name</div>
                    <input style={inputStyle} value={editValues.name ?? actor.name}
                      onChange={(e) => setEditValues((p) => ({ ...p, name: e.target.value }))} autoFocus />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Description</div>
                    <input style={inputStyle} value={editValues.description ?? actor.description}
                      onChange={(e) => setEditValues((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Type</div>
                    <select style={selectStyle} value={editValues.type ?? actor.type}
                      onChange={(e) => setEditValues((p) => ({ ...p, type: e.target.value }))}>
                      {ACTOR_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Color</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="color" value={editValues.color ?? actor.color}
                        onChange={(e) => setEditValues((p) => ({ ...p, color: e.target.value }))}
                        style={{ width: 36, height: 34, borderRadius: 6, border: "none", cursor: "pointer" }} />
                      <input style={{ ...inputStyle, width: 72 }} value={editValues.color ?? actor.color}
                        onChange={(e) => setEditValues((p) => ({ ...p, color: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btnPrimary} onClick={saveEdit} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                  <button style={btnGhost} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <ColorDot color={actor.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{actor.name}</div>
                  {actor.description && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{actor.description}</div>
                  )}
                </div>
                <Badge label={typeLabel(actor.type)} color={actor.color} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btnGhost} onClick={() => startEdit(actor)}>Edit</button>
                  <button style={btnDanger} onClick={() => deleteActor(actor.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generate with AI Tab ─────────────────────────────────────────────────────

interface GeneratedProcess {
  steps: { label: string; order: number; description: string }[];
  actors: { name: string; color: string; description: string; type: string }[];
  systems: { name: string; color: string; description: string; processTemplates: string[] }[];
}

function GenerateTab() {
  const [processName, setProcessName] = useState("");
  const [processTemplate, setProcessTemplate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<GeneratedProcess | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!processName.trim() || !processTemplate.trim()) return;
    setGenerating(true);
    setPreview(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/generate-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName, processTemplate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setPreview(data.generated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [processName, processTemplate]);

  const save = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await fetch("/api/admin/generate-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName, processTemplate, save: true }),
      });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [preview, processName, processTemplate]);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(51,102,255,0.08), rgba(139,43,226,0.06))",
          border: "1px solid rgba(51,102,255,0.2)",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
          AI Process Research Agent
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          Claude will research standard process steps, actors, and systems for any banking process
          using its training knowledge of BPMN standards, ISO 20022, and banking industry practices.
          Review the output before saving to the database.
        </div>
      </div>

      {/* Input form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
            Process Name *
          </div>
          <input
            style={inputStyle}
            placeholder="e.g. Trade Finance Letter of Credit, Auto Loan Origination"
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
            Template Key * <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(slug, no spaces)</span>
          </div>
          <input
            style={inputStyle}
            placeholder="e.g. trade_finance, auto_loan"
            value={processTemplate}
            onChange={(e) => setProcessTemplate(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
          />
        </div>
      </div>

      <button
        onClick={generate}
        disabled={generating || !processName.trim() || !processTemplate.trim()}
        style={{
          ...btnPrimary,
          padding: "9px 22px",
          fontSize: 13,
          opacity: generating || !processName.trim() || !processTemplate.trim() ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 24,
        }}
      >
        {generating ? (
          <>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
            Researching process…
          </>
        ) : (
          "✦ Generate with AI"
        )}
      </button>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", color: "#EF4444", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Preview — {processName}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {preview.steps.length} steps · {preview.actors.length} actors · {preview.systems.length} systems
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnGhost} onClick={generate} disabled={generating}>Regenerate</button>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  ...btnPrimary,
                  background: savedMsg ? "#26BC71" : "#3366FF",
                }}
              >
                {saving ? "Saving…" : savedMsg ? "✓ Saved to DB" : "Save to Database"}
              </button>
            </div>
          </div>

          {/* Steps */}
          <PreviewSection title="Process Steps" color="#3366FF" count={preview.steps.length}>
            {preview.steps.map((s) => (
              <div key={s.order} style={{ display: "flex", gap: 12, padding: "9px 14px", borderTop: s.order > 1 ? "1px solid rgba(255,255,255,0.05)" : "none", alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", minWidth: 22, paddingTop: 1 }}>{s.order}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.label}</div>
                  {s.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2, lineHeight: 1.4 }}>{s.description}</div>}
                </div>
              </div>
            ))}
          </PreviewSection>

          {/* Actors */}
          <PreviewSection title="Actors" color="#26BC71" count={preview.actors.length}>
            {preview.actors.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, flexShrink: 0, display: "inline-block" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{a.name}</div>
                  {a.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{a.description}</div>}
                </div>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 7px" }}>{a.type}</span>
              </div>
            ))}
          </PreviewSection>

          {/* Systems */}
          <PreviewSection title="Systems" color="#FFAC09" count={preview.systems.length}>
            {preview.systems.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0, display: "inline-block" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.name}</div>
                  {s.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.description}</div>}
                </div>
              </div>
            ))}
          </PreviewSection>
        </div>
      )}
    </div>
  );
}

function PreviewSection({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{title}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{count}</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Main AdminPanel ──────────────────────────────────────────────────────────

export function AdminPanel({ initialSteps, initialSystems, initialActors }: AdminPanelProps) {
  const [tab, setTab] = useState<"steps" | "systems" | "actors" | "generate">("steps");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid #3366FF" : "2px solid transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    padding: "10px 18px",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 }}>
        <button style={tabStyle(tab === "steps")} onClick={() => setTab("steps")}>
          Process Steps
          <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
            {initialSteps.length}
          </span>
        </button>
        <button style={tabStyle(tab === "systems")} onClick={() => setTab("systems")}>
          Application Systems
          <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
            {initialSystems.length}
          </span>
        </button>
        <button style={tabStyle(tab === "actors")} onClick={() => setTab("actors")}>
          Actors
          <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
            {initialActors.length}
          </span>
        </button>
        <button style={tabStyle(tab === "generate")} onClick={() => setTab("generate")}>
          ✦ Generate with AI
        </button>
      </div>

      {tab === "steps" && <StepsTab initialSteps={initialSteps} />}
      {tab === "systems" && <SystemsTab initialSystems={initialSystems} />}
      {tab === "actors" && <ActorsTab initialActors={initialActors} />}
      {tab === "generate" && <GenerateTab />}
    </div>
  );
}
