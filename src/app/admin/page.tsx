import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { AdminPanel } from "@/components/AdminPanel";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [steps, systems, actors] = await Promise.all([
    prisma.processStepTemplate.findMany({
      orderBy: [{ processTemplate: "asc" }, { order: "asc" }],
    }),
    prisma.applicationSystem.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.processActor.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-muted mb-6">
          <Link href="/" className="hover:text-text-primary transition-colors">
            Engagements
          </Link>
          <span>/</span>
          <span className="text-text-secondary">Admin</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Configuration</h2>
            <p className="text-sm text-text-muted mt-0.5">
              Manage the process step library and application systems used in the Process Modeler
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-card p-6">
          <AdminPanel
            initialSteps={steps.map((s) => ({
              id: s.id,
              label: s.label,
              processTemplate: s.processTemplate,
              order: s.order,
              description: s.description,
            }))}
            initialSystems={systems.map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
              description: s.description,
              processTemplates: s.processTemplates,
            }))}
            initialActors={actors.map((a) => ({
              id: a.id,
              name: a.name,
              color: a.color,
              description: a.description,
              type: a.type,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
