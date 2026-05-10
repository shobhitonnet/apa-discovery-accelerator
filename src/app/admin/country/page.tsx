import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { CountryListAdmin } from "@/components/admin/CountryListAdmin";
import Link from "next/link";

export default async function AdminCountryPage() {
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
          <span style={{ color: "#374D6C", fontWeight: 600 }}>Country Repository</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(6,182,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" stroke="#06B6D4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#001C3D", margin: 0 }}>Country Repository</h2>
            <p style={{ fontSize: 12, color: "#9AAABB", margin: 0 }}>Click a country to manage its value coefficients and activated processes.</p>
          </div>
        </div>

        <CountryListAdmin />
      </main>
    </div>
  );
}
