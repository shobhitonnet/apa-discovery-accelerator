"use client";

import Link from "next/link";

export function AdminHomeTiles() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
      <Tile
        href="/admin/process"
        accent="#1A5AFF"
        icon={
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        }
        title="Process Repository"
        description="Canonical process templates — define each process's steps, sub-processes, metrics, and the actors / systems used."
      />
      <Tile
        href="/admin/country"
        accent="#06B6D4"
        icon={
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        title="Country Repository"
        description="Per-country values (FTE, fines, defaults) plus the activated processes available to engagements in that country."
      />
      <Tile
        href="/admin/knowledge"
        accent="#8B5CF6"
        icon={
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
        title="Knowledge Library"
        description="Banking deviation patterns and their candidate reasons — used by Stage 5 to ground findings."
      />
    </div>
  );
}

function Tile({ href, accent, icon, title, description }: {
  href: string; accent: string; icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#fff",
        border: `1.5px solid #DDE3EC`,
        borderRadius: 16,
        padding: 24,
        cursor: "pointer",
        minHeight: 200,
        display: "flex", flexDirection: "column", gap: 12,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.boxShadow = `0 4px 16px ${accent}22`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#DDE3EC";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${accent}15`, color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#001C3D" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5, flex: 1 }}>{description}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, display: "flex", alignItems: "center", gap: 6 }}>
          Open →
        </div>
      </div>
    </Link>
  );
}
