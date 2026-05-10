import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { CoverageDashboard } from "@/components/admin/CoverageDashboard";
import { AdminHomeTiles } from "@/components/admin/AdminHomeTiles";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
          <Link href="/" className="hover:text-text-primary transition-colors">Engagements</Link>
          <span>/</span>
          <span className="text-text-secondary">Admin</span>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Repository &amp; Configuration</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Manage the curated knowledge base — processes, country-specific values, deviation patterns
          </p>
        </div>

        <CoverageDashboard />
        <AdminHomeTiles />
      </main>
    </div>
  );
}
