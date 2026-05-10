import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Returns each country known to the repository, with summary counts.
 * A country is "known" if it appears in ValueCoefficient OR CountryProcessActivation.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [coefficients, activations] = await Promise.all([
    prisma.valueCoefficient.findMany({ select: { country: true } }),
    prisma.countryProcessActivation.findMany({ select: { country: true, isActive: true } }),
  ]);

  const countries = new Map<string, { coefficientCount: number; activeProcessCount: number; draftProcessCount: number }>();
  for (const c of coefficients) {
    if (!countries.has(c.country)) countries.set(c.country, { coefficientCount: 0, activeProcessCount: 0, draftProcessCount: 0 });
    countries.get(c.country)!.coefficientCount++;
  }
  for (const a of activations) {
    if (!countries.has(a.country)) countries.set(a.country, { coefficientCount: 0, activeProcessCount: 0, draftProcessCount: 0 });
    if (a.isActive) countries.get(a.country)!.activeProcessCount++;
    else countries.get(a.country)!.draftProcessCount++;
  }

  return NextResponse.json(
    Array.from(countries.entries())
      .map(([country, stats]) => ({ country, ...stats }))
      .sort((a, b) => a.country.localeCompare(b.country))
  );
}
