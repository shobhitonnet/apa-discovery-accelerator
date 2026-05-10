import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.deviationPattern.findMany({
    orderBy: [{ type: "asc" }, { patternKey: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { patternKey, type, stepKeyword, processKey = null, country = null, reasons = [] } = body;
  if (!patternKey || !type || !stepKeyword) {
    return NextResponse.json({ error: "patternKey, type, stepKeyword required" }, { status: 400 });
  }
  const created = await prisma.deviationPattern.create({
    data: { patternKey, type, stepKeyword, processKey, country, reasons },
  });
  return NextResponse.json(created, { status: 201 });
}
