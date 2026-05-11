"use client";

import { useState } from "react";
import { ProcessMetricsForm } from "./ProcessMetricsForm";
import { ProcessCapabilitiesForm } from "./ProcessCapabilitiesForm";

type Props = {
  engagementId: string;
  processId: string;
  processKey: string;
  initialMetrics: Record<string, string> | null;
  initialCapabilities: Record<string, "digital" | "partial" | "manual"> | null;
  buttonStyle?: "primary" | "ghost";
  buttonLabel?: string;
};

export function ProcessEditDrawer({
  engagementId, processId, processKey,
  initialMetrics, initialCapabilities,
  buttonStyle = "ghost", buttonLabel = "⚙ Edit details",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: buttonStyle === "primary" ? "#1A5AFF" : "#fff",
          color: buttonStyle === "primary" ? "#fff" : "#091C35",
          border: buttonStyle === "primary" ? "1px solid #1A5AFF" : "1px solid #DDE3EC",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          if (buttonStyle !== "primary") {
            (e.currentTarget as HTMLElement).style.borderColor = "#1A5AFF";
            (e.currentTarget as HTMLElement).style.color = "#1A5AFF";
          }
        }}
        onMouseLeave={(e) => {
          if (buttonStyle !== "primary") {
            (e.currentTarget as HTMLElement).style.borderColor = "#DDE3EC";
            (e.currentTarget as HTMLElement).style.color = "#091C35";
          }
        }}
      >
        {buttonLabel}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(9,28,53,0.45)",
            zIndex: 1000,
            display: "flex", justifyContent: "flex-end",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(640px, 92vw)", height: "100%",
              background: "#F5F7F9",
              boxShadow: "-10px 0 40px rgba(0,0,0,0.2)",
              overflowY: "auto",
              animation: "slideIn 0.2s ease-out",
            }}
          >
            <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

            {/* Drawer header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 1,
              background: "#FFFFFF",
              padding: "16px 24px",
              borderBottom: "1px solid #DDE3EC",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AAABB" }}>Process Setup</div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#091C35", letterSpacing: "-0.01em", marginTop: 2 }}>Edit metrics &amp; capabilities</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "transparent", border: "1px solid #DDE3EC",
                  cursor: "pointer", color: "#5C6E84", fontSize: 16, fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>

            {/* Forms */}
            <div style={{ padding: 16 }}>
              <ProcessMetricsForm
                engagementId={engagementId}
                processId={processId}
                processKey={processKey}
                initialMetrics={initialMetrics}
              />
              <ProcessCapabilitiesForm
                engagementId={engagementId}
                processId={processId}
                processKey={processKey}
                initialCapabilities={initialCapabilities}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
