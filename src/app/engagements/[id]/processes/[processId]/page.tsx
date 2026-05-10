import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { LOB_CATALOG } from "@/types";
import { ProcessMetricsForm } from "@/components/ProcessMetricsForm";
import { ProcessCapabilitiesForm } from "@/components/ProcessCapabilitiesForm";
import { ProcessScanTiles } from "@/components/ProcessScanTiles";
import Link from "next/link";

const METRIC_SUMMARY_LABELS: Record<string, { key: string; label: string; suffix?: string }[]> = {
  retail_onboarding: [
    { key: "applicationsPerYear", label: "Applications / yr" },
    { key: "onboardingsPerYear",  label: "Onboardings / yr" },
    { key: "avgOnboardDays",      label: "Avg onboard time", suffix: "days" },
    { key: "kycFailureRate",      label: "KYC failures",     suffix: "%" },
  ],
  retail_personal_loan: [
    { key: "applicationsPerYear", label: "Applications / yr" },
    { key: "disbursedPerYear",    label: "Disbursed / yr" },
    { key: "avgTatDays",          label: "Avg TAT",          suffix: "days" },
    { key: "declineRate",         label: "Decline rate",     suffix: "%" },
  ],
};

const INTEGRATION_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  integrated:          { label: "Integrated",         color: "#1A8F4F", bg: "rgba(46,204,113,0.1)"  },
  partial_integration: { label: "Partially Integrated", color: "#B07800", bg: "rgba(255,172,9,0.1)"  },
  siloed:              { label: "Siloed",              color: "#C0392B", bg: "rgba(239,68,68,0.08)" },
};

export default async function ProcessScanPage({
  params,
}: {
  params: Promise<{ id: string; processId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id, processId } = await params;

  const [process, engagement, ingestionMappedCount, eventCount] = await Promise.all([
    prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id } }),
    prisma.engagement.findUnique({ where: { id }, select: { name: true, clientName: true } }),
    prisma.upload.count({ where: { engagementId: id, processId, dataRequestFileName: { not: null } } }),
    prisma.eventLog.count({ where: { processId } }),
  ]);
  const hasActivityTable = eventCount > 0;

  if (!process || !engagement) notFound();

  const lob = LOB_CATALOG[process.lineOfBusiness as keyof typeof LOB_CATALOG];
  const processMap = process.processMap as { nodes?: { type: string }[] } | null;
  const taskNodes = processMap?.nodes?.filter((n) => n.type === "task") ?? [];
  const hasProcessMap = taskNodes.length > 0;
  const dataRequestItems = (process.dataRequest as { items?: unknown[] } | null)?.items ?? [];
  const hasDataRequest = dataRequestItems.length > 0;
  const ingestionTotalCount = dataRequestItems.length;
  const proc = process as unknown as { processMetrics?: unknown; processCapabilities?: unknown };
  const metrics = (proc.processMetrics ?? null) as Record<string, string> | null;
  const capabilities = (proc.processCapabilities ?? null) as Record<string, "digital" | "partial" | "manual"> | null;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      <main style={{ maxWidth: 1024, margin: "0 auto", padding: "40px 32px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5C6E84", marginBottom: 28 }}>
          <Link href="/engagements" style={{ color: "#5C6E84", textDecoration: "none" }}>Engagements</Link>
          <span>/</span>
          <Link href={`/engagements/${id}`} style={{ color: "#5C6E84", textDecoration: "none" }}>{engagement.name}</Link>
          <span>/</span>
          <span style={{ color: "#001C3D", fontWeight: 600 }}>{process.processName}</span>
        </div>

        {/* Process header */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", padding: "20px 28px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
              background: lob?.bg ?? "rgba(26,90,255,0.08)", color: lob?.color ?? "#1A5AFF",
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {lob?.label ?? process.lineOfBusiness}
            </span>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.02em", margin: 0 }}>
              {process.processName}
            </h1>
            <span style={{ fontSize: 13, color: "#9AAABB" }}>· {engagement.clientName}</span>
          </div>

          {/* Saved metrics summary */}
          {metrics && Object.values(metrics).some((v) => v && v !== "") && (() => {
            const metricDefs = METRIC_SUMMARY_LABELS[process.processKey] ?? [];
            const savedMetrics = metricDefs.filter((m) => metrics[m.key]);
            const capEntries = capabilities ? Object.entries(capabilities).filter(([k, v]) => k !== "integrationStatus" && v) : [];
            const digitalCount = capEntries.filter(([, v]) => v === "digital").length;
            const partialCount = capEntries.filter(([, v]) => v === "partial").length;
            const manualCount  = capEntries.filter(([, v]) => v === "manual").length;
            const integration  = capabilities?.integrationStatus ? INTEGRATION_DISPLAY[capabilities.integrationStatus as string] : null;
            return (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #EEF2F8" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {savedMetrics.map((m) => (
                    <div key={m.key} style={{ padding: "6px 12px", borderRadius: 8, background: "#F5F7F9", border: "1px solid #EEF2F8" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>{m.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#001C3D" }}>
                        {Number(metrics[m.key]).toLocaleString()}{m.suffix ?? ""}
                      </div>
                    </div>
                  ))}

                  {capEntries.length > 0 && (
                    <div style={{ padding: "6px 12px", borderRadius: 8, background: "#F5F7F9", border: "1px solid #EEF2F8" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Capabilities</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {digitalCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#1A8F4F" }}>{digitalCount} Digital</span>}
                        {partialCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#B07800" }}>{partialCount} Partial</span>}
                        {manualCount  > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#C0392B" }}>{manualCount} Manual</span>}
                      </div>
                    </div>
                  )}

                  {integration && (
                    <div style={{ padding: "6px 12px", borderRadius: 8, background: integration.bg, border: `1px solid ${integration.color}30` }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Integration</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: integration.color }}>{integration.label}</div>
                    </div>
                  )}

                  {metrics.notes && (
                    <div style={{ padding: "6px 12px", borderRadius: 8, background: "#F5F7F9", border: "1px solid #EEF2F8", maxWidth: 280 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Notes</div>
                      <div style={{ fontSize: 11, color: "#5C6E84", lineHeight: 1.4 }}>{metrics.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Process metrics form */}
        <ProcessMetricsForm
          engagementId={id}
          processId={processId}
          processKey={process.processKey}
          initialMetrics={metrics}
        />

        {/* Current capabilities assessment */}
        <ProcessCapabilitiesForm
          engagementId={id}
          processId={processId}
          processKey={process.processKey}
          initialCapabilities={capabilities}
        />

        {/* Section label */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C6E84", marginBottom: 14 }}>
          Discovery Phases
        </div>

        {/* Three tiles */}
        <ProcessScanTiles
          engagementId={id}
          processId={processId}
          hasProcessMap={hasProcessMap}
          hasDataRequest={hasDataRequest}
          ingestionMappedCount={ingestionMappedCount}
          ingestionTotalCount={ingestionTotalCount}
          hasActivityTable={hasActivityTable}
        />
      </main>
    </div>
  );
}
