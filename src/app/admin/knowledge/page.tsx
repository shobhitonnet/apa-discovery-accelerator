import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { DeviationPatternsAdmin } from "@/components/admin/DeviationPatternsAdmin";
import Link from "next/link";

export default async function AdminKnowledgePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9AAABB", marginBottom: 16 }}>
          <Link href="/" style={{ color: "#9AAABB", textDecoration: "none" }}>Engagements</Link>
          <span>/</span>
          <Link href="/admin" style={{ color: "#9AAABB", textDecoration: "none" }}>Admin</Link>
          <span>/</span>
          <span style={{ color: "#374D6C", fontWeight: 600 }}>Knowledge</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" stroke="#8B5CF6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#001C3D", margin: 0 }}>Knowledge Library</h2>
            <p style={{ fontSize: 12, color: "#9AAABB", margin: 0 }}>Banking deviation patterns and their candidate reasons.</p>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDE3EC", padding: 16 }}>
          <DeviationPatternsAdmin />
        </div>
      </main>
    </div>
  );
}
