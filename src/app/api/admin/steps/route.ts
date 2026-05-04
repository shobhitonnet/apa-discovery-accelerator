import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const steps = await prisma.processStepTemplate.findMany({
    orderBy: [{ processTemplate: "asc" }, { order: "asc" }],
  });
  return NextResponse.json(steps);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { label, processTemplate, order, description } = body;

  if (!label || !processTemplate) {
    return NextResponse.json({ error: "label and processTemplate required" }, { status: 400 });
  }

  const step = await prisma.processStepTemplate.create({
    data: { label, processTemplate, order: order ?? 0, description: description ?? "" },
  });
  return NextResponse.json(step, { status: 201 });
}
