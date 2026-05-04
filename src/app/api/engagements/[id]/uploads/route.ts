import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: engagementId } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
  });
  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  const body = await request.json();
  const { originalName, rowCount, columnCount, schemaInference, rawData } = body;

  if (!originalName) {
    return NextResponse.json({ error: "originalName is required" }, { status: 400 });
  }

  const upload = await prisma.upload.create({
    data: {
      fileName: originalName,
      originalName,
      rowCount: rowCount ?? null,
      columnCount: columnCount ?? null,
      systemSource: schemaInference?.detectedSystem ?? null,
      schemaInference: schemaInference ?? undefined,
      rawData: rawData ?? undefined,
      status: schemaInference ? "inferred" : "uploaded",
      engagementId,
    },
  });

  // Update engagement status to uploading if still at created
  if (engagement.status === "created") {
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { status: "uploading" },
    });
  }

  return NextResponse.json(upload, { status: 201 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: engagementId } = await params;

  const uploads = await prisma.upload.findMany({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(uploads);
}
