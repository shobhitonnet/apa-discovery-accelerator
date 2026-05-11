import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";
import { buildFindingsPrompt, loadFindingsContext, type FindingsResult } from "@/lib/findings";

/**
 * GET — return cached findings for this process. Returns { cached: false }
 * if nothing has been generated yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;
  const proc = await prisma.engagementProcess.findUnique({
    where: { id: processId, engagementId: id },
    select: { findings: true, findingsGeneratedAt: true },
  });
  if (!proc || !proc.findings) {
    return NextResponse.json({ cached: false });
  }
  return NextResponse.json({
    cached: true,
    generatedAt: proc.findingsGeneratedAt?.toISOString() ?? null,
    result: proc.findings as FindingsResult,
  });
}

/**
 * POST — generate fresh findings via Claude and persist to DB. Overwrites any
 * cached version. Use this for "Regenerate" / first generation.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;
  const ctx = await loadFindingsContext(id, processId);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const prompt = buildFindingsPrompt(ctx);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    let jsonStr = raw.startsWith("```") ? raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```\s*$/, "").trim() : raw;
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr) as Omit<FindingsResult, "generatedAt">;
    const generatedAt = new Date();

    // ── Server-side reconciliation ───────────────────────────────────────
    // Trust per-finding annualValueLeak + elasticOpsVertex tags; recompute
    // the triangle totals from those so the math always reconciles. Claude's
    // top-level numbers are kept only for summary/mainFactors text.

    const findings = parsed.findings ?? [];
    const sum = findings.reduce((s, f) => s + (f.annualValueLeak ?? 0), 0);
    const sumByVertex: Record<"growth" | "efficiency" | "control", number> = { growth: 0, efficiency: 0, control: 0 };
    const countByVertex: Record<"growth" | "efficiency" | "control", number> = { growth: 0, efficiency: 0, control: 0 };
    for (const f of findings) {
      const v = (f.elasticOpsVertex ?? "efficiency") as "growth" | "efficiency" | "control";
      sumByVertex[v] += f.annualValueLeak ?? 0;
      countByVertex[v] += 1;
    }

    // Preserve Claude's narrative copy (summary + mainFactors), overwrite numbers.
    const claudeOps = parsed.elasticOps;
    const reconciledOps = {
      growth: {
        totalAnnualValueLeak: sumByVertex.growth,
        findingCount: countByVertex.growth,
        mainFactors: claudeOps?.growth?.mainFactors ?? [],
        summary: claudeOps?.growth?.summary ?? "",
      },
      efficiency: {
        totalAnnualValueLeak: sumByVertex.efficiency,
        findingCount: countByVertex.efficiency,
        mainFactors: claudeOps?.efficiency?.mainFactors ?? [],
        summary: claudeOps?.efficiency?.summary ?? "",
      },
      control: {
        totalAnnualValueLeak: sumByVertex.control,
        findingCount: countByVertex.control,
        mainFactors: claudeOps?.control?.mainFactors ?? [],
        summary: claudeOps?.control?.summary ?? "",
      },
    };

    const result: FindingsResult = {
      ...parsed,
      generatedAt: generatedAt.toISOString(),
      currency: ctx.currency,
      totalAnnualValueLeak: sum,
      elasticOps: reconciledOps,
      findings,
    };

    // Persist to cache.
    await prisma.engagementProcess.update({
      where: { id: processId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { findings: result as any, findingsGeneratedAt: generatedAt },
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Findings generation failed";
    console.error("Findings error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
