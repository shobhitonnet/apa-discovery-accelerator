import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { LOB_CATALOG } from "@/types";
import { ProcessScanTiles } from "@/components/ProcessScanTiles";
import { ProcessEditDrawer } from "@/components/ProcessEditDrawer";
import Link from "next/link";

const INTEGRATION_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  integrated:          { label: "Integrated",          color: "#1F8F5A", bg: "rgba(38,188,113,0.10)" },
  partial_integration: { label: "Partially Integrated", color: "#B07800", bg: "rgba(255,172,9,0.10)" },
  siloed:              { label: "Siloed",              color: "#C0392B", bg: "rgba(239,68,68,0.08)" },
};

export default async function ProcessScanPage({
  params,
}: { params: Promise<{ id: string; processId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id, processId } = await params;

  const process = await prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id } });
  if (!process) notFound();

  const [engagement, ingestionMappedCount, eventCount, distinctCases] = await Promise.all([
    prisma.engagement.findUnique({ where: { id }, select: { name: true, clientName: true } }),
    prisma.upload.count({ where: { engagementId: id, processId, dataRequestFileName: { not: null } } }),
    prisma.eventLog.count({ where: { processId } }),
    prisma.eventLog.findMany({ where: { processId }, select: { caseId: true }, distinct: ["caseId"] }),
  ]);
  if (!engagement) notFound();

  const hasActivityTable = eventCount > 0;
  const caseCount = distinctCases.length;

  const lob = LOB_CATALOG[process.lineOfBusiness as keyof typeof LOB_CATALOG];
  const processMap = process.processMap as { nodes?: { type: string }[] } | null;
  const taskNodes = processMap?.nodes?.filter((n) => n.type === "task") ?? [];
  const hasProcessMap = taskNodes.length > 0;
  const dataRequestItems = (process.dataRequest as { items?: unknown[] } | null)?.items ?? [];
  const hasDataRequest = dataRequestItems.length > 0;
  const ingestionTotalCount = dataRequestItems.length;

  const proc = process as unknown as { processMetrics?: unknown; processCapabilities?: unknown; findings?: unknown };
  const metrics = (proc.processMetrics ?? null) as Record<string, string> | null;
  const capabilities = (proc.processCapabilities ?? null) as Record<string, "digital" | "partial" | "manual"> | null;

  type Finding = {
    title: string;
    annualValueLeak?: number;
    severity?: "high" | "medium" | "low";
    casesAffected?: number;
    rank?: number;
    cockpitCategory?: string;
    elasticOpsVertex?: "growth" | "efficiency" | "control";
    rootCause?: string;
  };
  const findingsBlob = proc.findings as {
    totalAnnualValueLeak?: number;
    findings?: Finding[];
    elasticOps?: {
      growth?: { totalAnnualValueLeak?: number };
      efficiency?: { totalAnnualValueLeak?: number };
      control?: { totalAnnualValueLeak?: number };
    };
  } | null;
  const leakUsd = findingsBlob?.totalAnnualValueLeak ?? 0;
  const allFindings = findingsBlob?.findings ?? [];
  const topFindings = [...allFindings].sort((a, b) => (b.annualValueLeak ?? 0) - (a.annualValueLeak ?? 0)).slice(0, 3);
  const elasticOps = findingsBlob?.elasticOps;

  // Capability mix
  const capEntries = capabilities ? Object.entries(capabilities).filter(([k, v]) => k !== "integrationStatus" && v) : [];
  const digitalCount = capEntries.filter(([, v]) => v === "digital").length;
  const partialCount = capEntries.filter(([, v]) => v === "partial").length;
  const manualCount  = capEntries.filter(([, v]) => v === "manual").length;
  const totalCap = digitalCount + partialCount + manualCount;
  const integration = capabilities?.integrationStatus ? INTEGRATION_DISPLAY[capabilities.integrationStatus as string] : null;

  const metricsCount = metrics ? Object.keys(metrics).filter((k) => k !== "notes" && metrics[k]).length : 0;

  const formatLeak = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n > 0 ? `$${Math.round(n / 1000)}K` : "—";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      <main style={{ maxWidth: 1480, margin: "0 auto", padding: "24px 32px 60px" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#5C6E84", marginBottom: 14 }}>
          <Link href="/engagements" style={{ color: "#5C6E84", textDecoration: "none" }}>My Workspace</Link>
          <span style={{ color: "#9AAABB" }}>/</span>
          <Link href={`/engagements/${id}`} style={{ color: "#5C6E84", textDecoration: "none" }}>{engagement.name}</Link>
          <span style={{ color: "#9AAABB" }}>/</span>
          <span style={{ color: "#091C35", fontWeight: 600 }}>{process.processName}</span>
        </div>

        {/* Process header — single compact row with Edit details on the right */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDE3EC", padding: "14px 22px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: "4px 10px", borderRadius: 4,
              background: lob?.bg ?? "rgba(26,90,255,0.08)", color: lob?.color ?? "#1A5AFF",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              {lob?.label ?? process.lineOfBusiness}
            </span>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: "#091C35", letterSpacing: "-0.01em", margin: 0 }}>
              {process.processName}
            </h1>
            <span style={{ fontSize: 13, color: "#5C6E84" }}>· {engagement.clientName}</span>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              {(metricsCount > 0 || totalCap > 0) && (
                <span style={{ fontSize: 11, color: "#5C6E84" }}>
                  {metricsCount > 0 && <>{metricsCount} metrics</>}
                  {metricsCount > 0 && totalCap > 0 && " · "}
                  {totalCap > 0 && <>{totalCap} capabilities</>}
                </span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 800, padding: "4px 10px", borderRadius: 4,
                background: "rgba(38,188,113,0.12)", color: "#1F8F5A",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                {process.status}
              </span>
              <div style={{ minWidth: 130 }}>
                <ProcessEditDrawer
                  engagementId={id}
                  processId={processId}
                  processKey={process.processKey}
                  initialMetrics={metrics}
                  initialCapabilities={capabilities}
                  buttonStyle="ghost"
                  buttonLabel="⚙ Edit details"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Section 1: Discovery Phases ═══ */}
        <SectionHeader title="Discovery Phases" subtitle="Map the process, ingest data, simulate APA recovery" />
        <div style={{ marginBottom: 28 }}>
          <ProcessScanTiles
            engagementId={id}
            processId={processId}
            hasProcessMap={hasProcessMap}
            hasDataRequest={hasDataRequest}
            ingestionMappedCount={ingestionMappedCount}
            ingestionTotalCount={ingestionTotalCount}
            hasActivityTable={hasActivityTable}
          />
        </div>

        {/* ═══ Section 2: Executive Summary (visually distinct) ═══ */}
        <div style={{ background: "linear-gradient(180deg, #E8EEF6 0%, #EEF2F7 100%)", border: "1px solid #D5DEEB", borderRadius: 14, padding: "22px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.08em" }}>Executive Summary</div>
              <div style={{ fontSize: 13, color: "#5C6E84", marginTop: 2 }}>Where the process is leaking value and why</div>
            </div>
            <span style={{ fontSize: 11, color: "#5C6E84" }}>
              {caseCount > 0 ? `${caseCount.toLocaleString()} cases · ${eventCount.toLocaleString()} events analysed` : "Awaiting data ingestion"}
            </span>
          </div>

          {/* Top row — 3 columns: Big leak | Elastic Ops split | Capability + Integration */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.6fr 1.1fr", gap: 12, marginBottom: 14 }}>

            {/* Annual leak hero */}
            <div style={{ background: "#fff", border: "1px solid #DDE3EC", borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>Annual value leak</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: leakUsd > 0 ? "#C0392B" : "#9AAABB", letterSpacing: "-0.02em", marginTop: 2, fontFeatureSettings: '"tnum"' }}>
                {formatLeak(leakUsd)}
              </div>
              <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 4 }}>
                {leakUsd > 0 ? `Across ${allFindings.length} finding${allFindings.length === 1 ? "" : "s"}` : "Run Process Analysis to surface"}
              </div>
            </div>

            {/* Elastic Ops vertex split */}
            <div style={{ background: "#fff", border: "1px solid #DDE3EC", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Elastic Ops · where the leak lives</div>
              {elasticOps ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <ElasticVertex label="Growth ↗"      value={elasticOps.growth?.totalAnnualValueLeak ?? 0}     total={leakUsd} color="#1F8F5A" bg="rgba(38,188,113,0.08)" />
                  <ElasticVertex label="Efficiency ⚙" value={elasticOps.efficiency?.totalAnnualValueLeak ?? 0} total={leakUsd} color="#B07800" bg="rgba(255,172,9,0.08)" />
                  <ElasticVertex label="Control ◆"    value={elasticOps.control?.totalAnnualValueLeak ?? 0}    total={leakUsd} color="#C0392B" bg="rgba(239,68,68,0.08)" />
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#9AAABB", fontStyle: "italic" }}>No findings yet — Stage 5 will populate this.</div>
              )}
            </div>

            {/* Capability + Integration */}
            <div style={{ background: "#fff", border: "1px solid #DDE3EC", borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Capability · {totalCap} steps
                </div>
                {totalCap > 0 ? (
                  <>
                    <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                      {digitalCount > 0 && <div style={{ flex: digitalCount, height: 10, background: "#26BC71", borderRadius: 3 }} />}
                      {partialCount > 0 && <div style={{ flex: partialCount, height: 10, background: "#FFAC09", borderRadius: 3 }} />}
                      {manualCount  > 0 && <div style={{ flex: manualCount,  height: 10, background: "#EF4444", borderRadius: 3 }} />}
                    </div>
                    <div style={{ fontSize: 10, color: "#5C6E84", fontWeight: 500 }}>
                      {digitalCount} Digital · {partialCount} Partial · {manualCount} Manual
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#9AAABB", fontStyle: "italic" }}>No capability data.</div>
                )}
              </div>
              {integration && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F5F7F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#5C6E84", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Integration</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: integration.color }}>{integration.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Top findings list */}
          <div style={{ background: "#fff", border: "1px solid #DDE3EC", borderRadius: 10, padding: "14px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Top findings {topFindings.length > 0 && `· ${topFindings.length} of ${allFindings.length}`}
              </div>
              {allFindings.length > 0 && (
                <Link href={`/engagements/${id}/processes/${processId}/discover`} style={{ fontSize: 11, color: "#1A5AFF", textDecoration: "none", fontWeight: 600 }}>
                  See full analysis →
                </Link>
              )}
            </div>
            {topFindings.length > 0 ? (
              topFindings.map((f, i) => (
                <FindingRow key={i} index={i + 1} finding={f} />
              ))
            ) : (
              <div style={{ fontSize: 12, color: "#9AAABB", fontStyle: "italic", padding: "8px 0" }}>
                Run Process Analysis (Stage 5) to surface findings.
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#091C35", letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#5C6E84", marginTop: 3 }}>{subtitle}</div>}
    </div>
  );
}

function ElasticVertex({ label, value, total, color, bg }: { label: string; value: number; total: number; color: string; bg: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const display = value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `$${Math.round(value / 1000)}K` : value > 0 ? `$${value}` : "—";
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#091C35", marginTop: 3, fontFeatureSettings: '"tnum"' }}>{display}</div>
      <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>{pct.toFixed(0)}% of leak</div>
    </div>
  );
}

const SEVERITY_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  high:   { bg: "rgba(239,68,68,0.10)",  fg: "#C0392B", label: "High" },
  medium: { bg: "rgba(255,172,9,0.12)",  fg: "#B07800", label: "Medium" },
  low:    { bg: "rgba(26,90,255,0.10)",  fg: "#1A5AFF", label: "Low" },
};

const VERTEX_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  growth:     { bg: "rgba(38,188,113,0.10)", fg: "#1F8F5A", label: "Growth ↗" },
  efficiency: { bg: "rgba(255,172,9,0.12)",  fg: "#B07800", label: "Efficiency ⚙" },
  control:    { bg: "rgba(239,68,68,0.10)",  fg: "#C0392B", label: "Control ◆" },
};

function FindingRow({ index, finding }: { index: number; finding: { title: string; annualValueLeak?: number; severity?: "high" | "medium" | "low"; casesAffected?: number; elasticOpsVertex?: "growth" | "efficiency" | "control" } }) {
  const sev = finding.severity ? SEVERITY_PILL[finding.severity] : null;
  const vtx = finding.elasticOpsVertex ? VERTEX_PILL[finding.elasticOpsVertex] : null;
  const leak = finding.annualValueLeak ?? 0;
  const leakDisplay = leak >= 1_000_000 ? `$${(leak / 1_000_000).toFixed(1)}M` : leak >= 1000 ? `$${Math.round(leak / 1000)}K` : leak > 0 ? `$${leak}` : "—";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #F5F7F9" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#091C35", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
        {index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#091C35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{finding.title}</div>
        <div style={{ fontSize: 11, color: "#5C6E84", marginTop: 2 }}>
          {finding.casesAffected ? `${finding.casesAffected.toLocaleString()} cases affected` : ""}
        </div>
      </div>
      {vtx && (
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: vtx.bg, color: vtx.fg, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>{vtx.label}</span>
      )}
      {sev && (
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: sev.bg, color: sev.fg, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>{sev.label}</span>
      )}
      <div style={{ fontSize: 15, fontWeight: 800, color: "#C0392B", fontFeatureSettings: '"tnum"', flexShrink: 0, minWidth: 60, textAlign: "right" }}>
        {leakDisplay}
      </div>
    </div>
  );
}
