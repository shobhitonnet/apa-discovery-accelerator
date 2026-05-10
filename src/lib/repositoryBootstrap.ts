/**
 * Repository bootstrap — the cascade lookup that pulls everything an
 * engagement-process needs from the curated knowledge base.
 *
 * Given an engagement-process identity (engagement.country, engagement.institutionType, process.processKey)
 * this returns:
 *   - The active ProcessTemplate for the process key
 *   - All ValueCoefficients for the engagement's country (and matching institution type)
 *   - All Regulations for the engagement's country (process-specific + cross-process)
 *   - All DeviationPatterns for the engagement's country + process key
 *
 * Stage 5 (Findings) consumes this bundle. The bundle is also used to render the
 * "Applicable regulations" card on the process-scan page.
 */

import { prisma } from "@/lib/db";
import type {
  ProcessTemplate, ValueCoefficient, DeviationPattern,
} from "@/generated/prisma/client";

export type RepositoryBundle = {
  template: ProcessTemplate | null;
  templateMissing: boolean;
  coefficients: ValueCoefficient[];
  deviationPatterns: DeviationPattern[];
  // Convenience: a flat lookup of coefficient values by key
  coefficientByKey: Record<string, { value: number; unit: string; description: string; source: string }>;
};

export async function loadRepositoryBundle(opts: {
  country: string | null | undefined;
  institutionType: string | null | undefined;
  processKey: string;
}): Promise<RepositoryBundle> {
  const country = (opts.country ?? "").trim();
  const institutionType = (opts.institutionType ?? "").trim();
  const processKey = opts.processKey;

  // 1. Process template — latest active version for this process key
  const template = await prisma.processTemplate.findFirst({
    where: { processKey, isActive: true },
    orderBy: { version: "desc" },
  });

  // 2. Value coefficients — country-scoped, with institution-type override
  // We pick rows where institutionType is "" (applies to all) OR matches exactly,
  // and prefer the institution-specific value when both exist.
  const coefficients = country
    ? await prisma.valueCoefficient.findMany({
        where: {
          country,
          institutionType: { in: ["", institutionType] },
          OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
        },
      })
    : [];

  // Deduplicate by key — institution-specific wins over generic ""
  const coefByKey = new Map<string, ValueCoefficient>();
  for (const c of coefficients) {
    const existing = coefByKey.get(c.key);
    if (!existing || (existing.institutionType === "" && c.institutionType !== "")) {
      coefByKey.set(c.key, c);
    }
  }
  const dedupedCoefficients = Array.from(coefByKey.values());

  // 3. Deviation patterns — country + process scoped
  const deviationPatterns = await prisma.deviationPattern.findMany({
    where: {
      AND: [
        { OR: [{ country: null }, { country }] },
        { OR: [{ processKey: null }, { processKey }] },
      ],
    },
  });

  // Build the flat coefficient lookup for callers (Stage 5)
  const coefficientByKey: RepositoryBundle["coefficientByKey"] = {};
  for (const c of dedupedCoefficients) {
    coefficientByKey[c.key] = {
      value: c.value,
      unit: c.unit,
      description: c.description,
      source: c.source,
    };
  }

  return {
    template,
    templateMissing: !template,
    coefficients: dedupedCoefficients,
    deviationPatterns,
    coefficientByKey,
  };
}

/**
 * Convenience loader from a saved engagement-process. Looks up the engagement
 * to get country + institutionType, then loads the bundle.
 */
export async function loadRepositoryBundleForProcess(processId: string, engagementId: string): Promise<RepositoryBundle> {
  const [proc, engagement] = await Promise.all([
    prisma.engagementProcess.findUnique({ where: { id: processId, engagementId }, select: { processKey: true } }),
    prisma.engagement.findUnique({ where: { id: engagementId }, select: { country: true, institutionType: true } }),
  ]);

  if (!proc) {
    return { template: null, templateMissing: true, coefficients: [], deviationPatterns: [], coefficientByKey: {} };
  }

  return loadRepositoryBundle({
    country: engagement?.country,
    institutionType: engagement?.institutionType,
    processKey: proc.processKey,
  });
}
