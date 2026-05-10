import { prisma } from "@/lib/db";
import type { DataRequest } from "@/app/api/engagements/[id]/data-request/route";

export type ActivityTableSummary = {
  built: boolean;
  caseCount: number;
  eventCount: number;
  systemCount: number;
  timeRangeStart: string | null;
  timeRangeEnd: string | null;
  perSystem: Array<{ systemName: string; eventCount: number }>;
  warnings: string[];
};

// ──────────────────────────────────────────────────────────────────────────
// Heuristic column-role guesser — last-resort fallback when AI inference
// missed a column. Uses name patterns first, then sample-value detection.
// ──────────────────────────────────────────────────────────────────────────
export function guessColumnByRole(
  columns: string[],
  role: "case_id" | "timestamp" | "actor",
  sampleRows: Array<Record<string, unknown>> = []
): string | null {
  const lc = (s: string) => s.toLowerCase();
  const cols = columns.map((c) => ({ name: c, lc: lc(c) }));

  if (role === "case_id") {
    const strong = cols.find((c) =>
      /(^|_)(application|case|claim|loan|policy|account|customer)_id$/.test(c.lc)
      || /(^|_)(application|case|claim)(_)?(number|ref)$/.test(c.lc)
    );
    if (strong) return strong.name;
    const weak = cols.find((c) => /_id$/.test(c.lc) || c.lc === "id" || /(reference|ref_no|case_no)$/.test(c.lc));
    return weak?.name ?? null;
  }

  if (role === "timestamp") {
    // Strong name match
    const strong = cols.find((c) => /(_at|_on|_dt|_timestamp|_time|_date|_completed|_received|_sent|_created|_updated)$/.test(c.lc));
    if (strong) return strong.name;
    // Weaker name match
    const weak = cols.find((c) => /(timestamp|date|time|completed|received|sent|created|updated|processed)/.test(c.lc));
    if (weak) return weak.name;
    // Value-based detection — try to parse samples from each column
    if (sampleRows.length > 0) {
      const samples = sampleRows.slice(0, 12);
      const threshold = Math.max(3, Math.floor(samples.length * 0.6));
      for (const c of cols) {
        let parseable = 0;
        for (const row of samples) {
          const v = row[c.name];
          if (v !== undefined && v !== null && v !== "" && parseTimestamp(v)) parseable++;
        }
        if (parseable >= threshold) return c.name;
      }
    }
    return null;
  }

  if (role === "actor") {
    const strong = cols.find((c) => /(performed_by|created_by|actioned_by|assigned_to|user_id|agent|officer|underwriter|reviewed_by|approved_by)/.test(c.lc));
    return strong?.name ?? null;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Tolerant timestamp parser — handles ISO, "YYYY-MM-DD HH:MM:SS", date-only,
// "DD/MM/YYYY HH:MM:SS", "MM/DD/YYYY HH:MM:SS", and Excel serial numbers.
// Returns null when unparseable. Rejects dates outside 1900-2100 to avoid
// `new Date("650")` returning year 650 AD for numeric strings.
// ──────────────────────────────────────────────────────────────────────────
function isReasonableDate(d: Date): boolean {
  if (isNaN(d.getTime())) return false;
  const y = d.getUTCFullYear();
  return y >= 1900 && y <= 2100;
}

export function parseTimestamp(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Pure numeric: ONLY interpret as Excel serial, never as a year
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = Number(s);
    if (num > 25569 && num < 100000) {
      const d = new Date(Math.round((num - 25569) * 86400_000));
      return isReasonableDate(d) ? d : null;
    }
    return null; // numeric but not a valid Excel serial — reject
  }

  // ISO-ish or space-separated
  let d = new Date(s);
  if (isReasonableDate(d)) return d;

  // Replace space with T and retry
  d = new Date(s.replace(" ", "T"));
  if (isReasonableDate(d)) return d;

  // DD/MM/YYYY[ HH:MM:SS]
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (slashMatch) {
    const [, a, b, y, h = "0", m = "0", sec = "0"] = slashMatch;
    d = new Date(Number(y), Number(b) - 1, Number(a), Number(h), Number(m), Number(sec));
    if (isReasonableDate(d) && Number(a) <= 31 && Number(b) <= 12) return d;
    d = new Date(Number(y), Number(a) - 1, Number(b), Number(h), Number(m), Number(sec));
    if (isReasonableDate(d)) return d;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Read activity-table summary for a process from the EventLog table
// ──────────────────────────────────────────────────────────────────────────
export async function getActivityTableSummary(processId: string): Promise<ActivityTableSummary> {
  const events = await prisma.eventLog.findMany({
    where: { processId },
    select: { caseId: true, system: true, timestamp: true },
  });

  if (events.length === 0) {
    return {
      built: false,
      caseCount: 0,
      eventCount: 0,
      systemCount: 0,
      timeRangeStart: null,
      timeRangeEnd: null,
      perSystem: [],
      warnings: [],
    };
  }

  const cases = new Set<string>();
  const perSystemMap = new Map<string, number>();
  let minTs = events[0].timestamp;
  let maxTs = events[0].timestamp;
  for (const e of events) {
    cases.add(e.caseId);
    perSystemMap.set(e.system, (perSystemMap.get(e.system) ?? 0) + 1);
    if (e.timestamp < minTs) minTs = e.timestamp;
    if (e.timestamp > maxTs) maxTs = e.timestamp;
  }

  return {
    built: true,
    caseCount: cases.size,
    eventCount: events.length,
    systemCount: perSystemMap.size,
    timeRangeStart: minTs.toISOString(),
    timeRangeEnd: maxTs.toISOString(),
    perSystem: Array.from(perSystemMap.entries())
      .map(([systemName, eventCount]) => ({ systemName, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount),
    warnings: [],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Build the activity table — read all mapped uploads, emit events,
// replace existing EventLog rows for this process.
// ──────────────────────────────────────────────────────────────────────────
export async function buildActivityTable(
  engagementId: string,
  processId: string
): Promise<ActivityTableSummary> {
  const proc = await prisma.engagementProcess.findUnique({
    where: { id: processId, engagementId },
  });
  if (!proc) throw new Error("Process not found");

  const dataRequest = proc.dataRequest as unknown as DataRequest | null;
  const itemBySlot = new Map<string, { systemName: string }>();
  for (const item of dataRequest?.items ?? []) {
    itemBySlot.set(item.fileName, { systemName: item.systemName });
  }

  const uploads = await prisma.upload.findMany({
    where: {
      engagementId,
      processId,
      dataRequestFileName: { not: null },
    },
    select: {
      id: true,
      originalName: true,
      systemSource: true,
      dataRequestFileName: true,
      caseIdColumn: true,
      activityColumn: true,
      activityFallback: true,
      timestampColumn: true,
      actorColumn: true,
      rawData: true,
    },
  });

  const warnings: string[] = [];
  type Event = {
    caseId: string;
    activity: string;
    timestamp: Date;
    system: string;
    actor: string | null;
    attributes: Record<string, unknown>;
    uploadId: string;
  };
  const events: Event[] = [];

  for (const u of uploads) {
    const rows = (u.rawData ?? []) as Array<Record<string, string>>;
    if (!Array.isArray(rows) || rows.length === 0) {
      warnings.push(`${u.originalName}: no rows in stored CSV`);
      continue;
    }
    const headerCols = Object.keys(rows[0] ?? {});

    // Resolve column roles — confirmed mapping first, then heuristic fallback.
    // Sample rows are used for value-based detection when name patterns miss.
    const sampleRows = rows.slice(0, 12);
    const caseIdCol = u.caseIdColumn ?? guessColumnByRole(headerCols, "case_id", sampleRows);
    const tsCol     = u.timestampColumn ?? guessColumnByRole(headerCols, "timestamp", sampleRows);
    const actorCol  = u.actorColumn ?? guessColumnByRole(headerCols, "actor", sampleRows);

    if (!caseIdCol) {
      warnings.push(`${u.originalName}: no case_id column found — skipped (open Mapping to fix)`);
      continue;
    }
    if (!tsCol) {
      warnings.push(`${u.originalName}: no timestamp column found — skipped (open Mapping to fix)`);
      continue;
    }
    if (!u.activityColumn && !u.activityFallback) {
      warnings.push(`${u.originalName}: no activity column or fallback name — skipped`);
      continue;
    }

    if (!u.caseIdColumn) warnings.push(`${u.originalName}: auto-picked "${caseIdCol}" as case_id (no manual mapping was set)`);
    if (!u.timestampColumn) warnings.push(`${u.originalName}: auto-picked "${tsCol}" as timestamp (no manual mapping was set)`);

    // Use the data-request slot's systemName as authoritative — it's the
    // canonical name shared with the client and avoids inference drift.
    const slotInfo = u.dataRequestFileName ? itemBySlot.get(u.dataRequestFileName) : null;
    const systemName = slotInfo?.systemName ?? u.systemSource ?? "Unknown";

    let skipped = 0;
    for (const row of rows) {
      const caseId = String(row[caseIdCol] ?? "").trim();
      if (!caseId) { skipped++; continue; }

      const ts = parseTimestamp(row[tsCol]);
      if (!ts) { skipped++; continue; }

      const activity = u.activityColumn
        ? String(row[u.activityColumn] ?? "").trim() || u.activityFallback || "Unknown"
        : u.activityFallback ?? "Unknown";

      const actor = actorCol ? String(row[actorCol] ?? "").trim() || null : null;

      // Capture remaining columns as attributes (cap to keep payload reasonable)
      const knownCols = new Set([caseIdCol, tsCol, u.activityColumn, actorCol].filter(Boolean) as string[]);
      const attributes: Record<string, unknown> = {};
      let attrCount = 0;
      for (const [k, v] of Object.entries(row)) {
        if (knownCols.has(k)) continue;
        if (attrCount >= 12) break;
        attributes[k] = v;
        attrCount++;
      }

      events.push({
        caseId, activity, timestamp: ts, system: systemName, actor,
        attributes, uploadId: u.id,
      });
    }

    if (skipped > 0) {
      warnings.push(`${u.originalName}: skipped ${skipped} rows with missing case_id or unparseable timestamp`);
    }
  }

  // Sort by case_id then timestamp for deterministic insert order
  events.sort((a, b) => {
    if (a.caseId !== b.caseId) return a.caseId < b.caseId ? -1 : 1;
    return a.timestamp.getTime() - b.timestamp.getTime();
  });

  // Replace existing events for this process. We don't use a single transaction
  // because at scale (50k+ events) the createMany exceeds the default 5s
  // transaction timeout. The build is idempotent — if a chunk fails partway,
  // the user can rebuild and the next run starts with deleteMany again.
  await prisma.eventLog.deleteMany({ where: { processId } });

  const CHUNK = 2000;
  for (let i = 0; i < events.length; i += CHUNK) {
    const slice = events.slice(i, i + CHUNK);
    await prisma.eventLog.createMany({
      data: slice.map((e) => ({
        engagementId,
        processId,
        uploadId: e.uploadId,
        caseId: e.caseId,
        activity: e.activity,
        timestamp: e.timestamp,
        system: e.system,
        actor: e.actor,
        attributes: JSON.parse(JSON.stringify(e.attributes)),
      })),
    });
  }

  // Storage optimisation: once events are in EventLog, the rawData JSON on
  // each Upload is redundant (and large — 5k cases × 8 files = ~40 MB per
  // engagement build). Null it out to keep Neon storage flat. Schema metadata
  // (case-id col, timestamp col, mapping) stays so the file slot still shows
  // as filled in the ingestion UI.
  await prisma.upload.updateMany({
    where: { engagementId, processId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { rawData: null as any },
  });

  // Compute and return summary
  const summary = await getActivityTableSummary(processId);
  return { ...summary, warnings: [...summary.warnings, ...warnings] };
}
