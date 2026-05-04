import Link from "next/link";
import { PROCESS_TEMPLATES } from "@/types";

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  created: { bg: "bg-accent-blue/10", text: "text-accent-blue", label: "Created" },
  uploading: { bg: "bg-accent-amber/10", text: "text-accent-amber", label: "Uploading" },
  analyzing: { bg: "bg-accent-teal/10", text: "text-accent-teal", label: "Analyzing" },
  completed: { bg: "bg-accent-green/10", text: "text-accent-green", label: "Completed" },
};

interface EngagementCardProps {
  engagement: {
    id: string;
    name: string;
    clientName: string;
    processTemplate: string;
    status: string;
    createdAt: Date;
    createdBy: { name: string };
    _count: { uploads: number; eventLogs: number };
  };
}

export function EngagementCard({ engagement }: EngagementCardProps) {
  const status = STATUS_COLORS[engagement.status] ?? STATUS_COLORS.created;
  const template = PROCESS_TEMPLATES.find(
    (t) => t.id === engagement.processTemplate
  );

  return (
    <Link
      href={`/engagements/${engagement.id}`}
      className="group rounded-lg border border-border bg-bg-card p-5 hover:bg-bg-card-hover hover:border-border-light transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
            {engagement.name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {engagement.clientName}
          </p>
        </div>
        <span
          className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
        >
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
          </svg>
          {template?.name ?? engagement.processTemplate}
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
        <span>{engagement._count.uploads} file{engagement._count.uploads !== 1 ? "s" : ""}</span>
        <span>{engagement._count.eventLogs.toLocaleString()} events</span>
      </div>
    </Link>
  );
}
