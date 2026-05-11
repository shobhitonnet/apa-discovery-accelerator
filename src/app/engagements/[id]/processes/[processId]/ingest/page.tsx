import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { IngestionSection } from "@/components/IngestionSection";
import { LOB_CATALOG } from "@/types";
import type { DataRequest } from "@/app/api/engagements/[id]/data-request/route";
import { getActivityTableSummary } from "@/lib/activityTable";
import { getVariantsSummary } from "@/lib/variants";
import { getProcessGraph } from "@/lib/processGraph";
import Link from "next/link";

export default async function IngestPage({
  params,
}: {
  params: Promise<{ id: string; processId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id, processId } = await params;

  const [process, engagement, uploads, activityTable, variants, processGraph] = await Promise.all([
    prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id } }),
    prisma.engagement.findUnique({ where: { id }, select: { name: true, clientName: true } }),
    prisma.upload.findMany({
      where: { engagementId: id, processId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        originalName: true,
        systemSource: true,
        rowCount: true,
        columnCount: true,
        status: true,
        schemaInference: true,
        dataRequestFileName: true,
        caseIdColumn: true,
        activityColumn: true,
        activityFallback: true,
        timestampColumn: true,
        actorColumn: true,
      },
    }),
    getActivityTableSummary(processId),
    getVariantsSummary(processId),
    getProcessGraph(processId),
  ]);

  if (!process || !engagement) notFound();

  const lob = LOB_CATALOG[process.lineOfBusiness as keyof typeof LOB_CATALOG];
  const dataRequest = (process.dataRequest ?? null) as DataRequest | null;
  const hasDataRequest = !!dataRequest?.items?.length;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      <main style={{ padding: "28px 32px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9AAABB", marginBottom: 24 }}>
          <Link href="/engagements" style={{ color: "#9AAABB", textDecoration: "none" }}>Engagements</Link>
          <span>/</span>
          <Link href={`/engagements/${id}`} style={{ color: "#9AAABB", textDecoration: "none" }}>{engagement.name}</Link>
          <span>/</span>
          <Link href={`/engagements/${id}/processes/${processId}`} style={{ color: "#9AAABB", textDecoration: "none" }}>{process.processName}</Link>
          <span>/</span>
          <span style={{ color: "#374D6C", fontWeight: 600 }}>Data Ingestion & Digital Twin</span>
        </div>

        {/* Page title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: "rgba(6,182,212,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" fill="none" stroke="#06B6D4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.01em", margin: 0 }}>
              Data Ingestion & Digital Twin
            </h1>
            <p style={{ fontSize: 12, color: "#9AAABB", margin: 0, marginTop: 2 }}>
              <span style={{ color: lob?.color ?? "#1A5AFF", fontWeight: 600 }}>{lob?.label ?? process.lineOfBusiness}</span>
              {" · "}{process.processName}
            </p>
          </div>
        </div>

        {/* Ingestion card */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", overflow: "hidden" }}>
          <IngestionSection
            engagementId={id}
            processId={processId}
            dataRequest={dataRequest}
            initialUploads={uploads.map((u) => ({
              ...u,
              schemaInference: u.schemaInference as never,
            }))}
            hasDataRequest={hasDataRequest}
            initialActivityTable={activityTable}
            initialVariants={variants}
            initialProcessGraph={processGraph}
          />
        </div>
      </main>
    </div>
  );
}
