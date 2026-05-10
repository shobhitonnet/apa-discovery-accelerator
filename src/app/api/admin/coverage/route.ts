import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Coverage matrix: for each (country, processKey) cell, return what's seeded.
 * Used by the admin dashboard to show "what's officially supported".
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [templates, coefficients, deviations] = await Promise.all([
    prisma.processTemplate.findMany({
      select: { processKey: true, isActive: true, version: true, name: true },
      orderBy: [{ processKey: "asc" }, { version: "desc" }],
    }),
    prisma.valueCoefficient.findMany({
      select: { country: true, key: true },
    }),
    prisma.deviationPattern.findMany({
      select: { processKey: true, country: true, patternKey: true },
    }),
  ]);

  // Latest template per processKey
  const latestTemplateByKey = new Map<string, { isActive: boolean; version: number; name: string }>();
  for (const t of templates) {
    if (!latestTemplateByKey.has(t.processKey)) {
      latestTemplateByKey.set(t.processKey, { isActive: t.isActive, version: t.version, name: t.name });
    }
  }

  // Coefficient count per country
  const coefByCountry = new Map<string, number>();
  for (const c of coefficients) coefByCountry.set(c.country, (coefByCountry.get(c.country) ?? 0) + 1);

  // Deviation count per (country, processKey)
  const devByCell = new Map<string, number>();
  const cellKey = (country: string, processKey: string) => `${country}|${processKey}`;
  for (const d of deviations) {
    if (d.country && d.processKey) {
      const k = cellKey(d.country, d.processKey);
      devByCell.set(k, (devByCell.get(k) ?? 0) + 1);
    }
  }

  // Build the matrix from observed data
  const countries = Array.from(coefByCountry.keys()).sort();
  const processes = Array.from(latestTemplateByKey.keys()).sort();

  const cells: Record<string, {
    hasActiveTemplate: boolean;
    templateVersion: number | null;
    coefficientCount: number;
    deviationCount: number;
    completeness: "full" | "partial" | "missing";
  }> = {};

  for (const country of countries) {
    for (const processKey of processes) {
      const k = cellKey(country, processKey);
      const t = latestTemplateByKey.get(processKey);
      const hasActiveTemplate = !!t?.isActive;
      const coefCount = coefByCountry.get(country) ?? 0;
      const devCount = devByCell.get(k) ?? 0;

      let completeness: "full" | "partial" | "missing" = "missing";
      if (hasActiveTemplate && coefCount > 0 && devCount > 0) completeness = "full";
      else if (hasActiveTemplate || coefCount > 0 || devCount > 0) completeness = "partial";

      cells[k] = {
        hasActiveTemplate,
        templateVersion: t?.version ?? null,
        coefficientCount: coefCount,
        deviationCount: devCount,
        completeness,
      };
    }
  }

  return NextResponse.json({
    countries,
    processes: processes.map((p) => ({ key: p, name: latestTemplateByKey.get(p)?.name ?? p })),
    cells,
    totals: {
      activeTemplates: Array.from(latestTemplateByKey.values()).filter((t) => t.isActive).length,
      countries: countries.length,
      coefficients: coefficients.length,
      deviationPatterns: deviations.length,
    },
  });
}
