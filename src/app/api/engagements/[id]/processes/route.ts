import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const processes = await prisma.engagementProcess.findMany({
    where: { engagementId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(processes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { lineOfBusiness, processKey, processName } = await request.json();

  if (!lineOfBusiness || !processKey || !processName) {
    return NextResponse.json({ error: "lineOfBusiness, processKey and processName required" }, { status: 400 });
  }

  const count = await prisma.engagementProcess.count({ where: { engagementId: id } });

  const process = await prisma.engagementProcess.create({
    data: { engagementId: id, lineOfBusiness, processKey, processName, order: count },
  });

  return NextResponse.json(process, { status: 201 });
}
