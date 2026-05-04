import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actors = await prisma.processActor.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(actors);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, color, description, type } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const actor = await prisma.processActor.create({
    data: { name, color: color ?? "#3366FF", description: description ?? "", type: type ?? "employee" },
  });
  return NextResponse.json(actor, { status: 201 });
}
