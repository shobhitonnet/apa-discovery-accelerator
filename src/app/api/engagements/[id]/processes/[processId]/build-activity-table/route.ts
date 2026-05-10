import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildActivityTable } from "@/lib/activityTable";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;

  try {
    const summary = await buildActivityTable(id, processId);
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Build failed";
    console.error("buildActivityTable failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
