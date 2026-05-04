"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";

interface Upload {
  id: string;
  originalName: string;
  systemSource: string | null;
  rowCount: number | null;
  status: string;
  schemaInference: Record<string, unknown> | null;
}

interface UploadSectionProps {
  engagementId: string;
  processTemplate: string;
  uploads: Upload[];
}

export function UploadSection({
  engagementId,
  processTemplate,
  uploads: initialUploads,
}: UploadSectionProps) {
  const [uploads, setUploads] = useState(initialUploads);
  const [inferring, setInferring] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        if (!file.name.endsWith(".csv")) continue;

        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const allRows = parsed.data as Record<string, string>[];
        const headers = parsed.meta.fields ?? [];
        const sampleRows = allRows.slice(0, 10).map((r) => headers.map((h) => r[h] ?? ""));

        // Add to local state
        const tempId = crypto.randomUUID();
        const newUpload: Upload = {
          id: tempId,
          originalName: file.name,
          systemSource: null,
          rowCount: allRows.length,
          status: "uploaded",
          schemaInference: null,
        };
        setUploads((prev) => [...prev, newUpload]);

        // Run schema inference
        setInferring(tempId);
        try {
          const inferRes = await fetch("/api/schema-inference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              csvHeaders: headers,
              sampleRows,
              fileName: file.name,
              processTemplate,
              engagementId,
            }),
          });

          const inference = inferRes.ok ? await inferRes.json() : null;

          // Persist upload + inference result + full rows to DB
          const saveRes = await fetch(
            `/api/engagements/${engagementId}/uploads`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                originalName: file.name,
                rowCount: allRows.length,
                columnCount: headers.length,
                schemaInference: inference,
                rawData: allRows,
              }),
            }
          );

          if (saveRes.ok) {
            const saved = await saveRes.json();
            setUploads((prev) =>
              prev.map((u) =>
                u.id === tempId
                  ? {
                      ...u,
                      id: saved.id, // replace temp id with real DB id
                      status: saved.status,
                      schemaInference: inference,
                      systemSource: inference?.detectedSystem ?? null,
                    }
                  : u
              )
            );
          } else {
            throw new Error("Failed to save upload");
          }
        } catch {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === tempId ? { ...u, status: "error" } : u
            )
          );
        }
        setInferring(null);
      }
    },
    [engagementId, processTemplate]
  );

  return (
    <div className="rounded-lg border border-border bg-bg-card p-6">
      <h3 className="text-sm font-semibold text-text-primary mb-4">
        Data Sources
      </h3>

      {/* Drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
          dragOver
            ? "border-accent-blue bg-accent-blue/5"
            : "border-border hover:border-border-light"
        }`}
      >
        <svg
          className="w-8 h-8 text-text-muted mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-text-secondary mb-1">
          Drop CSV files here or click to browse
        </p>
        <p className="text-xs text-text-muted">
          Upload exports from CRM, LOS, Core Banking, or other operational
          systems
        </p>
        <input
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </label>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center justify-between rounded-md border border-border bg-bg-secondary px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <svg
                  className="w-4 h-4 text-text-muted shrink-0"
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
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {upload.originalName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {upload.rowCount?.toLocaleString()} rows
                    {upload.systemSource && ` · ${upload.systemSource}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inferring === upload.id && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-accent-teal">
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Inferring schema...
                  </span>
                )}
                {upload.status === "inferred" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 px-2 py-0.5 text-xs text-accent-green">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Schema inferred
                  </span>
                )}
                {upload.status === "error" && (
                  <span className="text-xs text-accent-red">Error</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
