import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProcessGraph } from "@/lib/processGraph";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { processId } = await params;
  const url = new URL(req.url);
  const fromIso = url.searchParams.get("fromDate");
  const toIso = url.searchParams.get("toDate");
  const fromDate = fromIso ? new Date(fromIso) : null;
  const toDate = toIso ? new Date(toIso) : null;

  const summary = await getProcessGraph(processId, { fromDate, toDate });
  return NextResponse.json(summary);
}
