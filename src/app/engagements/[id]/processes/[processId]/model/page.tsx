import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProcessModelerCanvas } from "@/components/ProcessModelerCanvas";
import { Node, Edge } from "@xyflow/react";
import Link from "next/link";

export default async function ProcessModelPage({
  params,
}: {
  params: Promise<{ id: string; processId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id, processId } = await params;

  const [process, allSteps, allSystems, allActors] = await Promise.all([
    prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id } }),
    prisma.processStepTemplate.findMany({ orderBy: [{ processTemplate: "asc" }, { order: "asc" }] }),
    prisma.applicationSystem.findMany({ orderBy: { name: "asc" } }),
    prisma.processActor.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!process) notFound();

  // Map new domain matrix keys to legacy DB template IDs where they overlap
  const LEGACY_KEY_MAP: Record<string, string> = {
    retail_mortgage:  "mortgage",
    retail_onboarding:"onboarding",
    retail_dispute:   "dispute",
    sme_loan:         "sme_loan",
  };
  const dbKey = LEGACY_KEY_MAP[process.processKey] ?? process.processKey;

  const rawMap = process.processMap as { nodes?: Node[]; edges?: Edge[] } | null;
  const initialProcessMap =
    rawMap?.nodes && rawMap?.edges
      ? { nodes: rawMap.nodes, edges: rawMap.edges }
      : null;

  const templateSteps = allSteps
    .filter((s) => s.processTemplate === dbKey)
    .sort((a, b) => a.order - b.order);

  const genericSteps = allSteps
    .filter((s) => s.processTemplate === "generic")
    .sort((a, b) => a.order - b.order);

  const applications = allSystems.filter(
    (s) => s.processTemplates.includes("*") || s.processTemplates.includes(dbKey)
  );

  return (
    <div style={{ position: "relative" }}>
      <Link
        href={`/engagements/${id}/processes/${processId}/discover`}
        style={{
          position: "fixed", top: 16, left: 16, zIndex: 1000,
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 30,
          background: "rgba(255,255,255,0.96)", color: "#001C3D",
          textDecoration: "none", boxShadow: "0 2px 12px rgba(0,28,61,0.15)",
          border: "1px solid rgba(0,28,61,0.08)",
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>
      <ProcessModelerCanvas
      engagementId={id}
      processId={processId}
      processTemplate={process.processKey}
      processName={process.processName}
      initialProcessMap={initialProcessMap}
      templateSteps={templateSteps.map((s) => ({
        id: s.id,
        label: s.label,
        processTemplate: s.processTemplate,
        order: s.order,
      }))}
      genericSteps={genericSteps.map((s) => ({
        id: s.id,
        label: s.label,
        processTemplate: s.processTemplate,
        order: s.order,
      }))}
      applications={applications.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        description: s.description,
        processTemplates: s.processTemplates,
      }))}
      actors={allActors.map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        description: a.description,
        type: a.type,
      }))}
    />
    </div>
  );
}
