import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActivityTableSummary } from "@/lib/activityTable";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { processId } = await params;
  const summary = await getActivityTableSummary(processId);
  return NextResponse.json(summary);
}
