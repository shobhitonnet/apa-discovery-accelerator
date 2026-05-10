import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      uploads: { orderBy: { createdAt: "desc" } },
      analysisResults: { orderBy: { createdAt: "desc" } },
      _count: { select: { eventLogs: true } },
    },
  });

  if (!engagement) {
    return NextResponse.json(
      { error: "Engagement not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(engagement);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const profileFields = ["name", "clientName", "country", "region", "institutionType", "aum", "employees", "customers", "coreBankingSystem"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileData: Record<string, any> = {};
  for (const key of profileFields) {
    if (key in body) profileData[key] = body[key] ?? null;
  }

  const updated = await prisma.engagement.update({
    where: { id },
    data: {
      ...(body.processMap !== undefined && { processMap: body.processMap }),
      ...(body.status !== undefined && { status: body.status }),
      ...profileData,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.engagement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
