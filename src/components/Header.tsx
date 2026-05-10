"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function Header() {
  const { data: session } = useSession();

  return (
    <header style={{ background: "#001C3D", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto max-w-7xl px-6 flex items-center justify-between" style={{ height: 56 }}>
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
          {/* Backbase-style logomark */}
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1A5AFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" />
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              APA Discovery Accelerator
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 1 }}>
              Backbase · Process Mining
            </div>
          </div>
        </Link>

        {/* Nav */}
        {session?.user && (
          <div className="flex items-center gap-1">
            <Link href="/engagements"
              style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", padding: "6px 12px", borderRadius: 6, textDecoration: "none", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              Engagements
            </Link>

            <Link href="/admin"
              style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", padding: "6px 12px", borderRadius: 6, textDecoration: "none", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              Admin
            </Link>

            <a href="/status.html" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", padding: "6px 12px", borderRadius: 6, textDecoration: "none", transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 6 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              Status
              <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 3, background: "rgba(255,172,9,0.2)", color: "#FFAC09", letterSpacing: "0.04em", textTransform: "uppercase" }}>Temp</span>
            </a>

            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)", margin: "0 4px" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#1A5AFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                {(session.user.name ?? "U").charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                {session.user.name}
              </span>
            </div>

            <button
              onClick={() => signOut()}
              style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: 6, transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
