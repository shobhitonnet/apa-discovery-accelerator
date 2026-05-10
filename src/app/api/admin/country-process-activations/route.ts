import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const country = url.searchParams.get("country");
  const where = country ? { country } : {};
  const items = await prisma.countryProcessActivation.findMany({
    where,
    orderBy: [{ country: "asc" }, { processKey: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { country, processKey, basedOnTemplateVersion = 1, isActive = false, notes = "" } = body;
  if (!country || !processKey) {
    return NextResponse.json({ error: "country and processKey are required" }, { status: 400 });
  }

  // Upsert by (country, processKey)
  const existing = await prisma.countryProcessActivation.findUnique({
    where: { country_processKey: { country, processKey } },
  });
  const data = { country, processKey, basedOnTemplateVersion, isActive, notes };
  const result = existing
    ? await prisma.countryProcessActivation.update({ where: { id: existing.id }, data })
    : await prisma.countryProcessActivation.create({ data });
  return NextResponse.json(result, { status: existing ? 200 : 201 });
}
