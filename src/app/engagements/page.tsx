import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { EngagementCard } from "@/components/EngagementCard";
import Link from "next/link";

export default async function EngagementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const isAdmin = (session.user as { role?: string }).role === "admin";

  const engagements = await prisma.engagement.findMany({
    where: isAdmin ? undefined : { createdById: (session.user as { id: string }).id },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { uploads: true, eventLogs: true, analysisResults: true } },
    },
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 48px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5C6E84", marginBottom: 4 }}>
              {isAdmin ? "All Engagements · Admin View" : "My Engagements"}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#001C3D", letterSpacing: "-0.02em" }}>
              {engagements.length > 0
                ? `${engagements.length} engagement${engagements.length !== 1 ? "s" : ""}`
                : "No engagements yet"}
            </h1>
          </div>
          <Link
            href="/engagements/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, background: "#1A5AFF",
              color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px 22px",
              borderRadius: 30, textDecoration: "none", letterSpacing: "0.01em",
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Engagement
          </Link>
        </div>

        {engagements.length === 0 ? (
          <div style={{ borderRadius: 16, border: "2px dashed #DDE3EC", background: "#fff", padding: "64px 32px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(26,90,255,0.08)", border: "1px solid rgba(26,90,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>◇</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#001C3D", marginBottom: 8 }}>No engagements yet</h3>
            <p style={{ fontSize: 14, color: "#5C6E84", maxWidth: 360, margin: "0 auto 28px", lineHeight: 1.6 }}>
              Create your first discovery engagement to start mapping a client&apos;s banking process and uncovering APA opportunities.
            </p>
            <Link
              href="/engagements/new"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, background: "#1A5AFF",
                color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px 24px",
                borderRadius: 30, textDecoration: "none",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Create first engagement
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
            {engagements.map((engagement) => (
              <EngagementCard
                key={engagement.id}
                engagement={{
                  ...engagement,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  hasProcessMap: (engagement as any).processMap?.nodes?.length > 0,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  hasDataRequest: (engagement as any).dataRequest != null,
                  hasUploads: engagement._count.uploads > 0,
                  hasAnalysis: engagement._count.analysisResults > 0,
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
