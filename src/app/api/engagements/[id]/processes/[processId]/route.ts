import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { processId } = await params;
  const body = await request.json();

  const updated = await prisma.engagementProcess.update({
    where: { id: processId },
    data: {
      ...(body.processMap     !== undefined && { processMap:     JSON.parse(JSON.stringify(body.processMap)) }),
      ...(body.dataRequest    !== undefined && { dataRequest:    JSON.parse(JSON.stringify(body.dataRequest)) }),
      ...(body.processMetrics      !== undefined && { processMetrics:      JSON.parse(JSON.stringify(body.processMetrics)) }),
      ...(body.processCapabilities !== undefined && { processCapabilities: JSON.parse(JSON.stringify(body.processCapabilities)) }),
      ...(body.status         !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { processId } = await params;
  await prisma.engagementProcess.delete({ where: { id: processId } });
  return NextResponse.json({ success: true });
}
