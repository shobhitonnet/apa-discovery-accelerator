import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ProcessTemplatesAdmin } from "@/components/admin/ProcessTemplatesAdmin";
import Link from "next/link";

export default async function AdminProcessPage() {
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
          <span style={{ color: "#374D6C", fontWeight: 600 }}>Process Repository</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(26,90,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" stroke="#1A5AFF" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#001C3D", margin: 0 }}>Process Repository</h2>
            <p style={{ fontSize: 12, color: "#9AAABB", margin: 0 }}>Canonical reference processes + the building-blocks (steps, systems, actors) used by the modeller.</p>
          </div>
        </div>

        <Section title="Process Templates" description="Click a process to view its details, edit its steps/systems/actors, or regenerate it with AI. The active version is what country variants fork from.">
          <ProcessTemplatesAdmin />
        </Section>
      </main>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#001C3D", margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 11, color: "#9AAABB", margin: 0, marginTop: 1 }}>{description}</p>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDE3EC", padding: 16 }}>{children}</div>
    </div>
  );
}
