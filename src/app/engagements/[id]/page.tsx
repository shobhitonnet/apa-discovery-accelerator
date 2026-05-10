import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { UploadSection } from "@/components/UploadSection";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ProcessesSection } from "@/components/ProcessesSection";
import { EditEngagementProfile } from "@/components/EditEngagementProfile";
import Link from "next/link";

function ProfileChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      padding: "8px 14px", borderRadius: 10,
      background: "#F5F7F9", border: "1px solid #EEF2F8",
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "#9AAABB", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#001C3D", textTransform: "capitalize" }}>{value}</span>
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
      processes: { orderBy: { order: "asc" } },
      uploads: { orderBy: { createdAt: "desc" } },
      analysisResults: { orderBy: { createdAt: "desc" } },
      _count: { select: { eventLogs: true } },
    },
  });

  if (!engagement) notFound();

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

        {/* Engagement header + bank profile */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #DDE3EC", padding: "24px 28px", marginBottom: 20 }}>
          {/* Name + status row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.02em", margin: 0 }}>
                {engagement.name}
              </h2>
              <p style={{ fontSize: 14, color: "#5C6E84", marginTop: 4 }}>{engagement.clientName}</p>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
              background: "rgba(26,90,255,0.08)", color: "#1A5AFF",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {engagement.status}
            </span>
          </div>

          {/* Bank profile — always shown, editable inline */}
          <div style={{ borderTop: "1px solid #EEF2F8", paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AAABB" }}>
                Bank Profile
              </div>
              <EditEngagementProfile
                engagementId={engagement.id}
                initial={{
                  name: engagement.name,
                  clientName: engagement.clientName,
                  country: engagement.country,
                  region: engagement.region,
                  institutionType: engagement.institutionType,
                  aum: engagement.aum,
                  employees: engagement.employees,
                  customers: engagement.customers,
                }}
              />
            </div>
            {(engagement.country || engagement.institutionType || engagement.aum || engagement.employees || engagement.customers) ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {engagement.country && <ProfileChip label="Country" value={engagement.country} />}
                {engagement.region && <ProfileChip label="Region" value={engagement.region} />}
                {engagement.institutionType && <ProfileChip label="Type" value={engagement.institutionType.replace(/_/g, " ")} />}
                {engagement.aum && <ProfileChip label="AUM" value={engagement.aum} />}
                {engagement.employees && <ProfileChip label="Employees" value={engagement.employees} />}
                {engagement.customers && <ProfileChip label="Customers" value={engagement.customers} />}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#9AAABB" }}>No profile details saved yet — click Edit Profile to add.</p>
            )}
          </div>

          {/* Stats row */}
          <div style={{ borderTop: "1px solid #EEF2F8", paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { label: "Processes",        value: engagement.processes.length },
              { label: "Files uploaded",   value: engagement.uploads.length },
              { label: "Events correlated",value: engagement._count.eventLogs.toLocaleString() },
              { label: "Findings",         value: engagement.analysisResults.length },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 11, color: "#9AAABB", fontWeight: 600 }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#001C3D", marginTop: 3 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Processes */}
        <ProcessesSection
          engagementId={engagement.id}
          initialProcesses={engagement.processes.map((p) => ({
            id: p.id,
            lineOfBusiness: p.lineOfBusiness,
            processKey: p.processKey,
            processName: p.processName,
            processMap: p.processMap,
            dataRequest: p.dataRequest,
            status: p.status,
          }))}
        />

        {/* Upload section */}
        <UploadSection
          engagementId={engagement.id}
          processTemplate={engagement.processTemplate ?? ""}
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

      </main>
    </div>
  );
}
