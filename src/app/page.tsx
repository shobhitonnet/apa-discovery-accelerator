import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [engagements, analysisCount] = await Promise.all([
    prisma.engagement.findMany({
      select: {
        id: true,
        processMap: true,
        dataRequest: true,
      },
    }),
    prisma.analysisResult.count({ where: { type: "apa_opportunity" } }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = engagements.filter((e) => (e as any).processMap?.nodes?.length > 0).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requested = engagements.filter((e) => (e as any).dataRequest != null).length;

  const stats = [
    { value: engagements.length, label: "Engagements" },
    { value: mapped, label: "Processes Mapped" },
    { value: requested, label: "Data Requests" },
    { value: analysisCount, label: "APA Opportunities" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div style={{ background: "#001C3D", position: "relative", overflow: "hidden" }}>
        {/* Dot-grid background */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(26,90,255,0.12) 1px, transparent 1px)", backgroundSize: "36px 36px", zIndex: 0 }} />
        {/* Glow blobs */}
        <div style={{ position: "absolute", width: 500, height: 500, background: "rgba(26,90,255,0.07)", borderRadius: "50%", filter: "blur(100px)", top: -200, left: -100, zIndex: 0 }} />
        <div style={{ position: "absolute", width: 300, height: 300, background: "rgba(46,204,113,0.05)", borderRadius: "50%", filter: "blur(80px)", bottom: -100, right: 0, zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "60px 48px 0" }}>
          {/* Label */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(26,90,255,0.15)", border: "1px solid rgba(26,90,255,0.3)", borderRadius: 30, padding: "4px 14px", marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A5AFF", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#7aa3ff", letterSpacing: "0.1em", textTransform: "uppercase" }}>Backbase · APA Discovery Accelerator</span>
          </div>

          <h1 style={{ fontSize: 48, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: 680, marginBottom: 16 }}>
            Discover what&apos;s really happening in your banking processes
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", maxWidth: 560, lineHeight: 1.6, marginBottom: 40 }}>
            Map the process in a workshop, generate a data request, upload system exports, and get a digital twin — exposing bottlenecks, exceptions, and APA opportunities.
          </p>

          {/* Pipeline flow diagram */}
          <PipelineDiagram />
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #DDE3EC" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px", display: "flex" }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{ flex: 1, padding: "20px 0", borderRight: i < stats.length - 1 ? "1px solid #DDE3EC" : undefined, paddingLeft: i > 0 ? 32 : 0, paddingRight: 32 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#5C6E84", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Pipeline flow diagram ────────────────────────────────────────────────────

const STAGES = [
  {
    num: "01",
    color: "#1A5AFF",
    title: "Process Discovery",
    tagline: "Map the happy flow · Generate data request",
    bullets: [
      "Model the end-to-end process in a client workshop",
      "Tag systems & actors at each step",
      "AI generates a structured, MoSCoW-prioritised data request",
    ],
  },
  {
    num: "02",
    color: "#06B6D4",
    title: "Data Ingestion & Digital Twin",
    tagline: "Ingest · Correlate · Reveal exceptions",
    bullets: [
      "Upload client data exports from tagged systems",
      "Correlate events into a case-level process log",
      "Expose bottlenecks, rework loops & value leakage",
    ],
  },
  {
    num: "03",
    color: "#FFAC09",
    title: "APA Simulation & Value Recovery",
    tagline: "Agent roles · Banking OS · Quantified savings",
    bullets: [
      "Map AI agent roles to each process step",
      "Simulate the future-state process via Banking OS layers",
      "Quantify FTE reduction, cycle time & value recovered",
    ],
  },
];

function PipelineDiagram() {
  return (
    <div style={{ paddingBottom: 52 }}>
      <style>{`
        @keyframes flowDot {
          0%   { stroke-dashoffset: 60; opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        .flow-dot { animation: flowDot 1.8s ease-in-out infinite; }
        .flow-dot.d2 { animation-delay: 0.6s; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 0, maxWidth: 780 }}>
        {STAGES.map((stage, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i === 1 ? 1.1 : 1 }}>
            {/* Stage pill */}
            <div style={{
              flex: 1,
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${stage.color}35`,
              borderRadius: 50,
              padding: "12px 20px",
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: `${stage.color}18`, border: `1.5px solid ${stage.color}60`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: stage.color, letterSpacing: "0.05em",
              }}>
                {stage.num}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{stage.title}</div>
                <div style={{ fontSize: 10, color: `${stage.color}99`, marginTop: 2 }}>{stage.tagline}</div>
              </div>
            </div>

            {/* Arrow */}
            {i < STAGES.length - 1 && (
              <svg width="44" height="20" viewBox="0 0 44 20" style={{ flexShrink: 0, overflow: "visible" }}>
                <line x1="0" y1="10" x2="36" y2="10"
                  stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="0" y1="10" x2="36" y2="10"
                  stroke={STAGES[i+1].color} strokeWidth="2"
                  strokeDasharray="8 52" strokeLinecap="round"
                  className={`flow-dot${i === 1 ? " d2" : ""}`} />
                <polygon points="34,5 44,10 34,15" fill={`${STAGES[i+1].color}50`} />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
