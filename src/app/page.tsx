import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { loadGlobalStats } from "@/lib/engagementStats";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const globalStats = await loadGlobalStats();

  const formatBig = (n: number) => n.toLocaleString();
  const formatLeak = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n > 0 ? `$${Math.round(n / 1000)}K` : "—";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div style={{ background: "#001C3D", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(26,90,255,0.12) 1px, transparent 1px)", backgroundSize: "36px 36px", zIndex: 0 }} />
        <div style={{ position: "absolute", width: 500, height: 500, background: "rgba(26,90,255,0.07)", borderRadius: "50%", filter: "blur(100px)", top: -200, left: -100, zIndex: 0 }} />
        <div style={{ position: "absolute", width: 300, height: 300, background: "rgba(46,204,113,0.05)", borderRadius: "50%", filter: "blur(80px)", bottom: -100, right: 0, zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1480, margin: "0 auto", padding: "56px 32px 64px", display: "grid", gridTemplateColumns: "minmax(420px, 1fr) minmax(480px, 1.1fr)", gap: 56, alignItems: "center" }}>
          {/* Left: copy */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(26,90,255,0.15)", border: "1px solid rgba(26,90,255,0.3)", borderRadius: 30, padding: "4px 14px", marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A5AFF", display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7aa3ff", letterSpacing: "0.1em", textTransform: "uppercase" }}>Backbase · APA Discovery Accelerator</span>
            </div>

            <h1 style={{ fontSize: 42, fontWeight: 800, color: "#fff", lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 16 }}>
              See what&apos;s really happening in your banking processes
            </h1>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 500, marginBottom: 28 }}>
              Map the process in a workshop, generate a data request, upload system exports, and get a digital twin — exposing bottlenecks, exceptions, and APA opportunities.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/engagements/new" style={{ background: "#1A5AFF", color: "#fff", fontSize: 13, fontWeight: 700, padding: "11px 22px", borderRadius: 8, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                New Engagement
              </Link>
              <Link href="/engagements" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13, fontWeight: 600, padding: "11px 20px", borderRadius: 8, textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" }}>
                ↗ My Workspace
              </Link>
            </div>
          </div>

          {/* Right: signature variant graph */}
          <HeroVariantGraph variantCount={globalStats.variantCount} caseCount={globalStats.caseCount} />
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #DDE3EC" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)" }}>
          {[
            { v: globalStats.engagementCount.toString(), l: "Engagements" },
            { v: globalStats.processesMapped.toString(), l: "Processes mapped" },
            { v: formatBig(globalStats.eventCount), l: "Events analysed" },
            { v: globalStats.variantCount.toString(), l: "Variants found" },
            { v: formatLeak(globalStats.leakUsd), l: "Value leak detected" },
          ].map((s, i) => (
            <div key={s.l} style={{ padding: "22px 28px", borderRight: i < 4 ? "1px solid #DDE3EC" : undefined, paddingLeft: i === 0 ? 0 : 28 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#091C35", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "#5C6E84", fontWeight: 600, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Signature variant graph (hero centerpiece) ──────────────────────────────
// Centered vertical pipe. Main step names + counts on the LEFT, exceptions
// branch off to the RIGHT. Compact (fits in viewport without scroll).

const SPINE_X = 270;
const EXCEPTION_X = 365;
const MAIN_BOX_RIGHT = 250;            // right edge of main label boxes (just left of spine)
const MAIN_BOX_LEFT = 60;
const EX_BOX_LEFT = 385;
const EX_BOX_RIGHT = 530;

const MAIN_STEPS = [
  { y: 75,  label: "Submit Application",    count: "1,850" },
  { y: 140, label: "Verify Identity",        count: "1,840" },
  { y: 210, label: "KYC & Sanctions",        count: "1,632" },
  { y: 285, label: "Underwriting Decision",  count: "1,492", prominent: true },
  { y: 360, label: "Account Provisioning",   count: "1,290" },
];

const EXCEPTIONS = [
  { y: 175, label: "Document Rework",     count: "208", anchor: 140, returnTo: 210 },
  { y: 248, label: "EDD Escalation",      count: "140", anchor: 210, returnTo: 285 },
  { y: 322, label: "Manual Underwriting", count: "172", anchor: 285, returnTo: 360 },
];

const EDGE_VOLUMES = [
  { y: 47,  text: "1,850" }, // Start → Submit
  { y: 107, text: "1,840" }, // Submit → Verify
  { y: 175, text: "1,632" }, // Verify → KYC
  { y: 248, text: "1,492" }, // KYC → Decision
  { y: 322, text: "1,290" }, // Decision → Provision
  { y: 393, text: "1,290" }, // Provision → End
];

function HeroVariantGraph({ variantCount, caseCount }: { variantCount: number; caseCount: number }) {
  const SPINE_TOP = 20;
  const SPINE_BOTTOM = 420;

  // Detour motion paths (case balls that route through an exception)
  const detour = (ex: typeof EXCEPTIONS[number]) =>
    `M ${SPINE_X} ${SPINE_TOP} ` +
    `L ${SPINE_X} ${ex.anchor} ` +
    `C ${SPINE_X + 90} ${ex.anchor} ${EXCEPTION_X - 90} ${ex.y} ${EXCEPTION_X} ${ex.y} ` +
    `C ${EXCEPTION_X - 90} ${ex.y} ${SPINE_X + 90} ${ex.returnTo} ${SPINE_X} ${ex.returnTo} ` +
    `L ${SPINE_X} ${SPINE_BOTTOM}`;

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #DDE3EC",
      borderRadius: 16,
      padding: "14px 16px 10px",
      position: "relative",
      boxShadow: "0 8px 30px rgba(9,28,53,0.18)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#5C6E84", letterSpacing: "0.06em", textTransform: "uppercase" }}>Discovered variant graph</div>
        <div style={{ fontSize: 10, color: "#9AAABB", fontFeatureSettings: '"tnum"' }}>
          {variantCount > 0 ? `${variantCount} variants · ${caseCount.toLocaleString()} cases` : "52 variants · 1,850 cases"}
        </div>
      </div>

      <svg viewBox="0 0 540 445" width="100%" style={{ display: "block", height: "auto", overflow: "visible", fontFamily: "ui-sans-serif, system-ui" }}>
        <defs>
          <marker id="vert-arr-pink" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#EF4D6D" />
          </marker>
        </defs>

        {/* ── Main spine ───────────────────────────────────────────────── */}
        <line x1={SPINE_X} y1={SPINE_TOP + 2} x2={SPINE_X} y2={SPINE_BOTTOM - 2} stroke="#1A5AFF" strokeWidth="2" />

        {/* ── Start node + label (LEFT) ───────────────────────────────── */}
        <circle cx={SPINE_X} cy={SPINE_TOP} r="6" fill="#FFFFFF" stroke="#1A5AFF" strokeWidth="2" />
        <PipeBox x={MAIN_BOX_LEFT} y={SPINE_TOP - 14} width={MAIN_BOX_RIGHT - MAIN_BOX_LEFT} height={28} title="Start" subtitle="1,850 Cases" subtle alignRight />

        {/* ── End node + label (LEFT) ─────────────────────────────────── */}
        <circle cx={SPINE_X} cy={SPINE_BOTTOM} r="7" fill="#26BC71" />
        <PipeBox x={MAIN_BOX_LEFT} y={SPINE_BOTTOM - 14} width={MAIN_BOX_RIGHT - MAIN_BOX_LEFT} height={28} title="End" subtitle="1,290 Completed" subtle alignRight />

        {/* ── Main step nodes + labels (LEFT of spine) ────────────────── */}
        {MAIN_STEPS.map((step, i) => (
          <g key={i}>
            {/* connector stub from box to marker */}
            <line x1={MAIN_BOX_RIGHT} y1={step.y} x2={SPINE_X - 5} y2={step.y} stroke="#C5D5F0" strokeWidth="1" />
            <circle cx={SPINE_X} cy={step.y} r={step.prominent ? 6 : 5} fill="#1A5AFF" />
            <PipeBox
              x={MAIN_BOX_LEFT}
              y={step.y - 16}
              width={MAIN_BOX_RIGHT - MAIN_BOX_LEFT}
              height={32}
              title={step.label}
              subtitle={`${step.count} Times`}
              prominent={step.prominent}
              alignRight
            />
          </g>
        ))}

        {/* ── Edge volume tags (centered ON the spine) ────────────────── */}
        {EDGE_VOLUMES.map((edge, i) => (
          <EdgeTag key={i} cx={SPINE_X} cy={edge.y} text={edge.text} />
        ))}

        {/* ── Exception branches (RIGHT) ──────────────────────────────── */}
        {EXCEPTIONS.map((ex, i) => {
          const outPath = `M ${SPINE_X + 5} ${ex.anchor} C ${SPINE_X + 90} ${ex.anchor} ${EXCEPTION_X - 90} ${ex.y} ${EXCEPTION_X - 6} ${ex.y}`;
          const backPath = `M ${EXCEPTION_X - 6} ${ex.y} C ${EXCEPTION_X - 90} ${ex.y} ${SPINE_X + 90} ${ex.returnTo} ${SPINE_X + 5} ${ex.returnTo}`;
          return (
            <g key={i}>
              <path d={outPath} stroke="#EF4D6D" strokeWidth="1.6" strokeDasharray="4 3" fill="none" opacity="0.9" markerEnd="url(#vert-arr-pink)" />
              <path d={backPath} stroke="#EF4D6D" strokeWidth="1.4" strokeDasharray="4 3" fill="none" opacity="0.5" />
              <circle cx={EXCEPTION_X} cy={ex.y} r="5" fill="#EF4D6D" />
              {/* connector stub from marker to box */}
              <line x1={EXCEPTION_X + 5} y1={ex.y} x2={EX_BOX_LEFT} y2={ex.y} stroke="#FFB3C5" strokeWidth="1" />
              <PipeBox
                x={EX_BOX_LEFT}
                y={ex.y - 16}
                width={EX_BOX_RIGHT - EX_BOX_LEFT}
                height={32}
                title={ex.label}
                subtitle={`${ex.count} Times`}
                deviation
              />
            </g>
          );
        })}

        {/* ── Animated cases — 2 down the happy path + 2 through exceptions ── */}
        <circle r="4" fill="#1A5AFF" opacity="0.95">
          <animateMotion dur="5s" repeatCount="indefinite" path={`M ${SPINE_X} ${SPINE_TOP} L ${SPINE_X} ${SPINE_BOTTOM}`} />
          <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.04;0.96;1" dur="5s" repeatCount="indefinite" />
        </circle>
        <circle r="3.5" fill="#3D7BFF" opacity="0.9">
          <animateMotion dur="5s" begin="2s" repeatCount="indefinite" path={`M ${SPINE_X} ${SPINE_TOP} L ${SPINE_X} ${SPINE_BOTTOM}`} />
          <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.04;0.96;1" dur="5s" begin="2s" repeatCount="indefinite" />
        </circle>
        {/* Detour ball — Document Rework */}
        <circle r="3.5" fill="#EF4D6D" opacity="0.85">
          <animateMotion dur="6.5s" begin="1s" repeatCount="indefinite" path={detour(EXCEPTIONS[0])} />
          <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.04;0.96;1" dur="6.5s" begin="1s" repeatCount="indefinite" />
        </circle>
        {/* Detour ball — Manual Underwriting */}
        <circle r="3.5" fill="#EF4D6D" opacity="0.85">
          <animateMotion dur="6.5s" begin="3.5s" repeatCount="indefinite" path={detour(EXCEPTIONS[2])} />
          <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.04;0.96;1" dur="6.5s" begin="3.5s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: 18, fontSize: 10, color: "#5C6E84", marginTop: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 2, background: "#1A5AFF", borderRadius: 1 }} /> Happy path
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 0, borderTop: "2px dashed #EF4D6D" }} /> Exception
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A5AFF" }} /> Case in flight
        </span>
      </div>
    </div>
  );
}

// ─── Label box — rounded rectangle, text-aligned per side ───────────────────

function PipeBox({ x, y, width, height, title, subtitle, prominent, deviation, subtle, alignRight }: {
  x: number; y: number; width: number; height: number;
  title: string; subtitle: string;
  prominent?: boolean; deviation?: boolean; subtle?: boolean; alignRight?: boolean;
}) {
  const fill = deviation
    ? "#FFF1F4"
    : prominent
    ? "#EEF3FF"
    : subtle
    ? "#FAFBFC"
    : "#FFFFFF";
  const stroke = deviation
    ? "#FFB3C5"
    : prominent
    ? "#B8CFFF"
    : "#DDE3EC";
  const titleColor = deviation ? "#C0392B" : prominent ? "#0E3FBD" : "#091C35";
  const subColor = deviation ? "#E47882" : "#5C6E84";
  const tx = alignRight ? x + width - 10 : x + 10;
  const anchor = alignRight ? "end" : "start";
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="5" ry="5" fill={fill} stroke={stroke} strokeWidth="1" />
      <text x={tx} y={y + 13} fontSize="9" fill={titleColor} fontWeight="600" textAnchor={anchor} letterSpacing="0.005em">{title}</text>
      <text x={tx} y={y + 24} fontSize="7.5" fill={subColor} textAnchor={anchor} style={{ fontFeatureSettings: '"tnum"', fontWeight: 500 }}>{subtitle}</text>
    </g>
  );
}

// ─── Edge volume tag — sits centered ON the spine, interrupts the line ──────

function EdgeTag({ cx, cy, text }: { cx: number; cy: number; text: string }) {
  const w = text.length * 5.2 + 16;
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 7} width={w} height="14" rx="3" fill="#FFFFFF" stroke="#C5D5F0" strokeWidth="0.8" />
      <text x={cx - w / 2 + 5} y={cy + 3} fontSize="8" fill="#1A5AFF" fontWeight="800">#</text>
      <text x={cx + w / 2 - 5} y={cy + 3} fontSize="8.5" fill="#091C35" textAnchor="end" style={{ fontFeatureSettings: '"tnum"', fontWeight: 600 }}>
        {text}
      </text>
    </g>
  );
}
