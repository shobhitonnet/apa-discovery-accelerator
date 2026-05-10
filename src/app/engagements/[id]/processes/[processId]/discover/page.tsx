import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { DiscoverPageContent } from "@/components/DiscoverPageContent";
import { LOB_CATALOG } from "@/types";
import type { DataRequest } from "@/app/api/engagements/[id]/data-request/route";
import Link from "next/link";

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ id: string; processId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id, processId } = await params;

  const [process, engagement] = await Promise.all([
    prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id } }),
    prisma.engagement.findUnique({ where: { id }, select: { name: true, clientName: true } }),
  ]);

  if (!process || !engagement) notFound();

  const lob = LOB_CATALOG[process.lineOfBusiness as keyof typeof LOB_CATALOG];
  const processMap = process.processMap as { nodes?: { type: string; data?: { label?: string } }[] } | null;
  const taskNodes = processMap?.nodes?.filter((n) => n.type === "task") ?? [];
  const hasProcessMap = taskNodes.length > 0;
  const dataRequest = (process.dataRequest ?? null) as DataRequest | null;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 28px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9AAABB", marginBottom: 24 }}>
          <Link href="/engagements" style={{ color: "#9AAABB", textDecoration: "none" }}>Engagements</Link>
          <span>/</span>
          <Link href={`/engagements/${id}`} style={{ color: "#9AAABB", textDecoration: "none" }}>{engagement.name}</Link>
          <span>/</span>
          <Link href={`/engagements/${id}/processes/${processId}`} style={{ color: "#9AAABB", textDecoration: "none" }}>{process.processName}</Link>
          <span>/</span>
          <span style={{ color: "#374D6C", fontWeight: 600 }}>Process Model & Data Request</span>
        </div>

        {/* Page title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: "rgba(26,90,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" fill="none" stroke="#1A5AFF" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.01em", margin: 0 }}>
              Process Model & Data Request
            </h1>
            <p style={{ fontSize: 12, color: "#9AAABB", margin: 0, marginTop: 2 }}>
              <span style={{ color: lob?.color ?? "#1A5AFF", fontWeight: 600 }}>{lob?.label ?? process.lineOfBusiness}</span>
              {" · "}{process.processName}
            </p>
          </div>
        </div>

        <DiscoverPageContent
          engagementId={id}
          processId={processId}
          processName={process.processName}
          lobLabel={lob?.label ?? process.lineOfBusiness}
          lobColor={lob?.color ?? "#1A5AFF"}
          taskNodes={taskNodes}
          hasProcessMap={hasProcessMap}
          initialDataRequest={dataRequest}
        />
      </main>
    </div>
  );
}
