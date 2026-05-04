import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const systems = await prisma.applicationSystem.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(systems);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, color, description, processTemplates } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const system = await prisma.applicationSystem.create({
    data: {
      name,
      color: color ?? "#3366FF",
      description: description ?? "",
      processTemplates: processTemplates ?? ["*"],
    },
  });
  return NextResponse.json(system, { status: 201 });
}
