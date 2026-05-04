import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { PROCESS_TEMPLATES } from "@/types";
import { UploadSection } from "@/components/UploadSection";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import Link from "next/link";

function ProcessMapCard({
  engagementId,
  processMap,
}: {
  engagementId: string;
  processMap: Record<string, unknown> | null;
}) {
  const summary = processMap?.summary as {
    stepCount?: number;
    applications?: string[];
    steps?: { order: number; label: string; application: string | null }[];
  } | undefined;

  const hasMappedSteps = summary && (summary.stepCount ?? 0) > 0;

  return (
    <div className="rounded-lg border border-border bg-bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: hasMappedSteps ? "rgba(38,188,113,0.15)" : "rgba(51,102,255,0.15)", color: hasMappedSteps ? "#26BC71" : "#3366FF" }}
          >
            {hasMappedSteps ? "✓" : "1"}
          </div>
          <h3 className="text-sm font-semibold text-text-primary">Process Map</h3>
          {hasMappedSteps && (
            <span className="text-xs text-accent-green">
              {summary!.stepCount} steps · {(summary!.applications ?? []).length} systems
            </span>
          )}
        </div>
        <Link
          href={`/engagements/${engagementId}/model`}
          className="text-xs font-semibold px-3 py-1.5 rounded-md"
          style={{ background: "rgba(51,102,255,0.12)", color: "#3366FF", textDecoration: "none" }}
        >
          {hasMappedSteps ? "Edit Map" : "Model Process →"}
        </Link>
      </div>

      {hasMappedSteps ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(summary!.steps ?? []).map((step, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className="rounded px-2 py-1 text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                {step.label}
                {step.application && (
                  <span style={{ color: "rgba(51,102,255,0.9)", marginLeft: 4 }}>
                    · {step.application}
                  </span>
                )}
              </div>
              {i < (summary!.steps ?? []).length - 1 && (
                <span className="text-text-muted text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Map your process steps and which systems handle each one. This guides the data collection and correlation engine.
        </p>
      )}
    </div>
  );
}

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: {
      uploads: { orderBy: { createdAt: "desc" } },
      analysisResults: { orderBy: { createdAt: "desc" } },
      _count: { select: { eventLogs: true } },
    },
    // processMap is a direct field, always fetched automatically
  });

  if (!engagement) notFound();

  const template = PROCESS_TEMPLATES.find(
    (t) => t.id === engagement.processTemplate
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-muted mb-6">
          <Link href="/" className="hover:text-text-primary transition-colors">
            Engagements
          </Link>
          <span>/</span>
          <span className="text-text-secondary">{engagement.name}</span>
        </div>

        {/* Engagement header */}
        <div className="rounded-lg border border-border bg-bg-card p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {engagement.name}
              </h2>
              <p className="text-sm text-text-muted mt-1">
                {engagement.clientName}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-accent-blue/10 px-3 py-1 text-xs font-medium text-accent-blue">
              {engagement.status}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-text-muted">Process</p>
              <p className="text-sm text-text-primary mt-0.5">
                {template?.name ?? engagement.processTemplate}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Files uploaded</p>
              <p className="text-sm text-text-primary mt-0.5">
                {engagement.uploads.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Events correlated</p>
              <p className="text-sm text-text-primary mt-0.5">
                {engagement._count.eventLogs.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Findings</p>
              <p className="text-sm text-text-primary mt-0.5">
                {engagement.analysisResults.length}
              </p>
            </div>
          </div>
        </div>

        {/* Process Modeler step */}
        <ProcessMapCard
          engagementId={engagement.id}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          processMap={(engagement as any).processMap as Record<string, unknown> | null}
        />

        {/* Upload section */}
        <UploadSection
          engagementId={engagement.id}
          processTemplate={engagement.processTemplate}
          uploads={engagement.uploads.map((u) => ({
            id: u.id,
            originalName: u.originalName,
            systemSource: u.systemSource,
            rowCount: u.rowCount,
            status: u.status,
            schemaInference: u.schemaInference as Record<string, unknown> | null,
          }))}
        />

        {/* Analysis panel — correlation, process mining, APA opportunities */}
        <AnalysisPanel
          engagementId={engagement.id}
          uploadCount={engagement.uploads.length}
          initialResults={engagement.analysisResults.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            description: r.description,
            severity: r.severity,
            data: r.data as Record<string, unknown>,
          }))}
          initialEventCount={engagement._count.eventLogs}
        />

        {/* Expected systems from template */}
        {template && (
          <div className="mt-6 rounded-lg border border-border bg-bg-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Expected Systems
            </h3>
            <div className="flex flex-wrap gap-2">
              {template.expectedSystems.map((system) => {
                const hasUpload = engagement.uploads.some(
                  (u) =>
                    u.systemSource?.toLowerCase() === system.toLowerCase()
                );
                return (
                  <span
                    key={system}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                      hasUpload
                        ? "bg-accent-green/10 text-accent-green"
                        : "bg-bg-secondary text-text-muted"
                    }`}
                  >
                    {hasUpload && (
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {system}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
