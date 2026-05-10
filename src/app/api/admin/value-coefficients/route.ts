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
  const items = await prisma.valueCoefficient.findMany({
    where,
    orderBy: [{ country: "asc" }, { category: "asc" }, { key: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    country, institutionType = "", key, value, unit,
    category = "operational", description = "", source = "",
    validFrom = new Date().toISOString(),
  } = body;

  if (!country || !key || value === undefined || !unit) {
    return NextResponse.json({ error: "country, key, value, unit are required" }, { status: 400 });
  }

  const created = await prisma.valueCoefficient.create({
    data: {
      country, institutionType, key,
      value: Number(value), unit, category, description, source,
      validFrom: new Date(validFrom),
    },
  });
  return NextResponse.json(created, { status: 201 });
}
