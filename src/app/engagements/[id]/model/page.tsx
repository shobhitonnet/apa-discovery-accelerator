import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PROCESS_TEMPLATES } from "@/types";
import { ProcessModelerCanvas } from "@/components/ProcessModelerCanvas";
import { Node, Edge } from "@xyflow/react";

export default async function ProcessModelerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [engagement, allSteps, allSystems, allActors] = await Promise.all([
    prisma.engagement.findUnique({ where: { id } }),
    prisma.processStepTemplate.findMany({
      orderBy: [{ processTemplate: "asc" }, { order: "asc" }],
    }),
    prisma.applicationSystem.findMany({ orderBy: { name: "asc" } }),
    prisma.processActor.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!engagement) notFound();

  const template = engagement.processTemplate
    ? PROCESS_TEMPLATES.find((t) => t.id === engagement.processTemplate)
    : undefined;

  const rawMap = engagement.processMap as { nodes?: Node[]; edges?: Edge[] } | null;
  const initialProcessMap =
    rawMap?.nodes && rawMap?.edges
      ? { nodes: rawMap.nodes, edges: rawMap.edges }
      : null;

  const pt = engagement.processTemplate ?? "";

  // Template-specific steps (sorted by order)
  const templateSteps = allSteps
    .filter((s) => pt && s.processTemplate === pt)
    .sort((a, b) => a.order - b.order);

  // Generic steps
  const genericSteps = allSteps
    .filter((s) => s.processTemplate === "generic")
    .sort((a, b) => a.order - b.order);

  // Systems visible for this template: ["*"] (generic) OR includes this template
  const applications = allSystems.filter(
    (s) => s.processTemplates.includes("*") || (pt && s.processTemplates.includes(pt))
  );

  return (
    <ProcessModelerCanvas
      engagementId={engagement.id}
      processTemplate={engagement.processTemplate ?? ""}
      processName={template?.name ?? engagement.processTemplate ?? engagement.name}
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
  );
}
