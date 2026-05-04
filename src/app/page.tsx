import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { EngagementCard } from "@/components/EngagementCard";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const engagements = await prisma.engagement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { uploads: true, eventLogs: true } },
    },
  });

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Engagements
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {engagements.length} active discovery engagement
              {engagements.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/engagements/new"
            className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Engagement
          </Link>
        </div>

        {/* Engagements grid */}
        {engagements.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-card p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-lg bg-bg-secondary flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-text-primary mb-1">
              No engagements yet
            </h3>
            <p className="text-sm text-text-muted mb-6">
              Create your first discovery engagement to start mining banking
              processes.
            </p>
            <Link
              href="/engagements/new"
              className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors"
            >
              Create engagement
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {engagements.map((engagement) => (
              <EngagementCard
                key={engagement.id}
                engagement={engagement}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
