import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const allowed = ["country", "institutionType", "key", "value", "unit", "category", "description", "source", "validFrom", "validTo"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  for (const k of allowed) if (k in body) {
    if (k === "value") data[k] = Number(body[k]);
    else if (k === "validFrom" || k === "validTo") data[k] = body[k] ? new Date(body[k]) : null;
    else data[k] = body[k];
  }
  const updated = await prisma.valueCoefficient.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.valueCoefficient.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
