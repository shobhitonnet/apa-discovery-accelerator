import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const engagements = await prisma.engagement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { uploads: true, eventLogs: true } },
    },
  });

  return NextResponse.json(engagements);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name, clientName,
    country, region, institutionType, aum, employees, customers,
  } = body;

  if (!name || !clientName) {
    return NextResponse.json(
      { error: "name and clientName are required" },
      { status: 400 }
    );
  }

  const userId = (session.user as { id: string }).id;

  const engagement = await prisma.engagement.create({
    data: {
      name, clientName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ country: country || null, region: region || null, institutionType: institutionType || null, aum: aum || null, employees: employees || null, customers: customers || null } as any),
      createdById: userId,
    },
  });

  return NextResponse.json(engagement, { status: 201 });
}
