"use client";

import { useState } from "react";
import { CoverageDashboard } from "@/components/admin/CoverageDashboard";
import { ProcessTemplatesAdmin } from "@/components/admin/ProcessTemplatesAdmin";
import { ValueCoefficientsAdmin } from "@/components/admin/ValueCoefficientsAdmin";
import { DeviationPatternsAdmin } from "@/components/admin/DeviationPatternsAdmin";
import { AdminPanel } from "@/components/AdminPanel";

type Section = "process" | "country" | "knowledge";

interface Props {
  legacy: {
    initialSteps: { id: string; label: string; processTemplate: string; order: number; description: string }[];
    initialSystems: { id: string; name: string; color: string; description: string; processTemplates: string[] }[];
    initialActors: { id: string; name: string; color: string; description: string; type: string }[];
  };
}

export function AdminTabs({ legacy }: Props) {
  const [section, setSection] = useState<Section>("process");

  return (
    <div>
      <CoverageDashboard />

      {/* Tile selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <Tile
          active={section === "process"}
          onClick={() => setSection("process")}
          accent="#1A5AFF"
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          }
          title="Process Repository"
          description="Process templates, steps, systems, and actors used by the modeller and AI."
        />
        <Tile
          active={section === "country"}
          onClick={() => setSection("country")}
          accent="#06B6D4"
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="Country Repository"
          description="Per-country values: FTE rates, regulatory fines, default rates. Used by Stage 5 quantification."
        />
        <Tile
          active={section === "knowledge"}
          onClick={() => setSection("knowledge")}
          accent="#8B5CF6"
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          title="Knowledge"
          description="Deviation pattern library — banking-specific reasons for skip/loop/out-of-order/extra steps."
        />
      </div>

      {/* Section content */}
      {section === "process" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <PanelCard title="Process Templates" description="Canonical reference processes (e.g., retail_onboarding) — one per process key, versioned. The active version is what engagements bootstrap from.">
            <ProcessTemplatesAdmin />
          </PanelCard>

          <PanelCard title="Steps, Systems & Actors" description="Building blocks used across processes — the canvas + data request generator pull from these.">
            <AdminPanel
              initialSteps={legacy.initialSteps}
              initialSystems={legacy.initialSystems}
              initialActors={legacy.initialActors}
            />
          </PanelCard>
        </div>
      )}

      {section === "country" && (
        <PanelCard title="Value Coefficients" description="Country-scoped numbers used by Stage 5 (Findings) to quantify value leakage: FTE rates, regulatory fines, default rates, customer LTV. Country wins; institution-type optionally narrows further.">
          <ValueCoefficientsAdmin />
        </PanelCard>
      )}

      {section === "knowledge" && (
        <PanelCard title="Deviation Pattern Library" description="Banking-specific reasons for each deviation type (skip, loop, out-of-order, extra step). Stage 5 uses these as priors when generating findings.">
          <DeviationPatternsAdmin />
        </PanelCard>
      )}
    </div>
  );
}

function Tile({ active, onClick, accent, icon, title, description }: {
  active: boolean; onClick: () => void; accent: string;
  icon: React.ReactNode; title: string; description: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? `${accent}06` : "#fff",
        border: active ? `1.5px solid ${accent}` : `1.5px solid ${hovered ? accent : "#DDE3EC"}`,
        borderRadius: 14,
        padding: 18,
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.15s",
        display: "flex", flexDirection: "column", gap: 8,
        boxShadow: active ? `0 4px 12px ${accent}1f` : (hovered ? `0 2px 6px ${accent}10` : "none"),
        transform: hovered && !active ? "translateY(-1px)" : "none",
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}15`, color: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: active ? accent : "#001C3D" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#5C6E84", lineHeight: 1.5 }}>{description}</div>
      <div style={{ marginTop: "auto", paddingTop: 6, fontSize: 11, fontWeight: 700, color: accent, display: "flex", alignItems: "center", gap: 4 }}>
        {active ? "Viewing" : "Open"} →
      </div>
    </button>
  );
}

function PanelCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 11, color: "#9AAABB", margin: 0, marginTop: 1 }}>{description}</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDE3EC", padding: 16 }}>
        {children}
      </div>
    </div>
  );
}
