import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * PATCH — set/clear an override for a single assumed metric.
 * Body: { key: string; value: number | null }  (null clears the override)
 *
 * GET — return all overrides for this process.
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
    select: { metricOverrides: true },
  });
  return NextResponse.json(proc?.metricOverrides ?? {});
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;
  const body = await req.json();
  const { key, value } = body;
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const proc = await prisma.engagementProcess.findUnique({
    where: { id: processId, engagementId: id },
    select: { metricOverrides: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = (proc?.metricOverrides ?? {}) as Record<string, any>;
  if (value === null || value === undefined || value === "") {
    delete current[key];
  } else {
    current[key] = Number(value);
  }
  const updated = await prisma.engagementProcess.update({
    where: { id: processId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { metricOverrides: current as any },
    select: { metricOverrides: true },
  });
  return NextResponse.json(updated.metricOverrides);
}
