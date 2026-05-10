import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { ProcessTemplateDetail } from "@/components/admin/ProcessTemplateDetail";
import type { MetricDefinition } from "@/lib/metricTypes";
import Link from "next/link";

export default async function ProcessTemplateDetailPage({
  params,
}: { params: Promise<{ processKey: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { processKey: keyRaw } = await params;
  const processKey = decodeURIComponent(keyRaw);

  const [template, steps, systems, actors, deviationPatterns] = await Promise.all([
    prisma.processTemplate.findFirst({
      where: { processKey },
      orderBy: { version: "desc" },
    }),
    prisma.processStepTemplate.findMany({
      where: { processTemplate: processKey },
      orderBy: { order: "asc" },
    }),
    prisma.applicationSystem.findMany({
      where: { processTemplates: { has: processKey } },
      orderBy: { name: "asc" },
    }),
    prisma.processActor.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.deviationPattern.findMany({
      where: { processKey },
      orderBy: [{ type: "asc" }, { patternKey: "asc" }],
    }),
  ]);

  if (!template) notFound();

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9AAABB", marginBottom: 16 }}>
          <Link href="/" style={{ color: "#9AAABB", textDecoration: "none" }}>Engagements</Link>
          <span>/</span>
          <Link href="/admin" style={{ color: "#9AAABB", textDecoration: "none" }}>Admin</Link>
          <span>/</span>
          <Link href="/admin/process" style={{ color: "#9AAABB", textDecoration: "none" }}>Process Repository</Link>
          <span>/</span>
          <span style={{ color: "#374D6C", fontWeight: 600 }}>{template.name}</span>
        </div>

        <ProcessTemplateDetail
          template={{
            id: template.id,
            processKey: template.processKey,
            version: template.version,
            name: template.name,
            description: template.description,
            isActive: template.isActive,
            lineOfBusiness: template.lineOfBusiness,
            applicableInstTypes: template.applicableInstTypes,
            subProcesses: template.subProcesses as unknown as { key: string; label: string; description: string }[],
            metricDefinitions: template.metricDefinitions as unknown as MetricDefinition[],
            notes: template.notes,
          }}
          steps={steps.map((s) => ({ id: s.id, label: s.label, order: s.order, description: s.description }))}
          systems={systems.map((s) => ({ id: s.id, name: s.name, color: s.color, description: s.description }))}
          actors={actors.map((a) => ({ id: a.id, name: a.name, color: a.color, description: a.description, type: a.type }))}
          deviationPatterns={deviationPatterns.map((p) => ({
            id: p.id,
            patternKey: p.patternKey,
            type: p.type,
            stepKeyword: p.stepKeyword,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            reasons: p.reasons as any,
          }))}
        />
      </main>
    </div>
  );
}
