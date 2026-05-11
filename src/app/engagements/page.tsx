import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { WorkspaceCard } from "@/components/WorkspaceCard";
import { loadEngagementStats, loadGlobalStats } from "@/lib/engagementStats";

export default async function WorkspacePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const userName = session.user.name ?? "there";
  const firstName = userName.split(" ")[0];

  const [engagements, globalStats] = await Promise.all([
    prisma.engagement.findMany({
      where: isAdmin ? undefined : { createdById: (session.user as { id: string }).id },
      orderBy: { updatedAt: "desc" },
    }),
    loadGlobalStats(),
  ]);

  const cards = await Promise.all(
    engagements.map(async (e) => {
      const stats = await loadEngagementStats(e.id);
      return { engagement: e, stats };
    })
  );

  const activeCount = cards.filter((c) => c.stats.eventCount > 0).length;
  const draftCount = cards.length - activeCount;
  const apaOpportunities = await prisma.analysisResult.count({ where: { type: "apa_opportunity" } });

  const formatBig = (n: number) => n.toLocaleString();
  const formatLeak = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n > 0 ? `$${Math.round(n / 1000)}K` : "—";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F9" }}>
      <Header />

      <main style={{ maxWidth: 1480, margin: "0 auto", padding: "32px 32px 80px" }}>

        {/* Greeting + actions */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#091C35", letterSpacing: "-0.02em" }}>
              <Greeting name={firstName} />
            </h1>
            <div style={{ fontSize: 13, color: "#5C6E84", marginTop: 4 }}>
              {cards.length === 0
                ? "Create your first engagement to start mapping a client's process."
                : <>You have <strong style={{ color: "#1A5AFF" }}>{activeCount} active engagement{activeCount === 1 ? "" : "s"}</strong> and {formatBig(globalStats.eventCount)} events under analysis.</>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/process" style={{ background: "#fff", color: "#091C35", border: "1px solid #DDE3EC", fontSize: 12, fontWeight: 600, padding: "10px 16px", borderRadius: 8, textDecoration: "none" }}>↗ Open Repository</Link>
            <Link href="/engagements/new" style={{ background: "#1A5AFF", color: "#fff", fontSize: 12, fontWeight: 600, padding: "10px 16px", borderRadius: 8, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              New Engagement
            </Link>
          </div>
        </div>

        {/* Pulse strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", background: "#fff", border: "1px solid #DDE3EC", borderRadius: 12, marginBottom: 28, overflow: "hidden" }}>
          {[
            { label: "Cases under analysis", value: formatBig(globalStats.caseCount), sub: globalStats.caseCount > 0 ? `${formatBig(globalStats.eventCount)} events` : "no events yet" },
            { label: "Engagements", value: globalStats.engagementCount.toString(), sub: `${activeCount} active · ${draftCount} draft` },
            { label: "Variants discovered", value: globalStats.variantCount.toString(), sub: globalStats.variantCount > 0 ? "across all engagements" : "—" },
            { label: "Value leak detected", value: formatLeak(globalStats.leakUsd), sub: globalStats.leakUsd > 0 ? "annualised" : "—" },
            { label: "APA opportunities", value: apaOpportunities.toString(), sub: apaOpportunities > 0 ? "in playbook" : "run analysis to surface" },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: "18px 22px", borderRight: i < 4 ? "1px solid #DDE3EC" : undefined }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5C6E84", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#091C35", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>{s.value}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: "#5C6E84", fontWeight: 500 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 16px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#091C35" }}>
            {isAdmin ? "All engagements" : "Your engagements"}
            <span style={{ marginLeft: 8, fontSize: 13, color: "#5C6E84", fontWeight: 500 }}>({cards.length})</span>
          </h2>
        </div>

        {cards.length === 0 ? (
          <div style={{ borderRadius: 16, border: "2px dashed #DDE3EC", background: "#fff", padding: "64px 32px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(26,90,255,0.08)", border: "1px solid rgba(26,90,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>◇</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#001C3D", marginBottom: 8 }}>No engagements yet</h3>
            <p style={{ fontSize: 14, color: "#5C6E84", maxWidth: 360, margin: "0 auto 28px", lineHeight: 1.6 }}>
              Create your first discovery engagement to start mapping a client&apos;s banking process and uncovering APA opportunities.
            </p>
            <Link href="/engagements/new" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1A5AFF", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px 24px", borderRadius: 30, textDecoration: "none" }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Create first engagement
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
            {cards.map(({ engagement, stats }) => (
              <WorkspaceCard
                key={engagement.id}
                id={engagement.id}
                clientName={engagement.clientName}
                name={engagement.name}
                status={engagement.status}
                createdAt={engagement.createdAt}
                updatedAt={engagement.updatedAt}
                country={engagement.country}
                {...stats}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return <>Good {part}, {name}.</>;
}
