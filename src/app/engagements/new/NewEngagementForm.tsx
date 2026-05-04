"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import type { TemplateSummary } from "./page";

export function NewEngagementForm({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [processTemplate, setProcessTemplate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/engagements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, clientName, processTemplate }),
    });
    if (res.ok) {
      const engagement = await res.json();
      router.push(`/engagements/${engagement.id}`);
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 className="text-lg font-semibold text-text-primary mb-1">New Engagement</h2>
        <p className="text-sm text-text-muted mb-8">
          Set up a discovery engagement for a banking client.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-text-secondary mb-1.5">
              Engagement Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
              placeholder="e.g. BECU — Mortgage Discovery Q2 2026"
            />
          </div>

          <div>
            <label htmlFor="client" className="block text-xs font-medium text-text-secondary mb-1.5">
              Client Name
            </label>
            <input
              id="client"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
              placeholder="e.g. Boeing Employees Credit Union"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-3">
              Process Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setProcessTemplate(template.id)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    processTemplate === template.id
                      ? "border-accent-blue bg-accent-blue/5"
                      : "border-border bg-bg-card hover:border-border-light hover:bg-bg-card-hover"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-sm font-medium text-text-primary">{template.name}</h4>
                    {template.isCustom && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{template.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                    <span>{template.stepCount} steps</span>
                    <span className="text-text-muted">·</span>
                    <span>{template.systemCount} systems</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name || !clientName || !processTemplate}
              className="rounded-md bg-accent-blue px-6 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Create Engagement"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
