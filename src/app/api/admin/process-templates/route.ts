import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.processTemplate.findMany({
    orderBy: [{ processKey: "asc" }, { version: "desc" }],
  });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { processKey, version = 1, name, description = "", lineOfBusiness, applicableInstTypes = [], isActive = false } = body;
  if (!processKey || !name || !lineOfBusiness) {
    return NextResponse.json({ error: "processKey, name and lineOfBusiness are required" }, { status: 400 });
  }

  const created = await prisma.processTemplate.create({
    data: {
      processKey, version, name, description, lineOfBusiness,
      applicableInstTypes,
      isActive,
      defaultProcessMap: {},
      subProcesses: [],
      metricDefinitions: [],
    },
  });
  return NextResponse.json(created, { status: 201 });
}
