import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// DELETE — clear all uploads for this process (used by Reset button)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;

  // Cascade: delete eventLogs scoped to this process first, then uploads
  await prisma.$transaction([
    prisma.eventLog.deleteMany({ where: { processId } }),
    prisma.upload.deleteMany({ where: { engagementId: id, processId } }),
  ]);

  return NextResponse.json({ success: true });
}

// GET — list uploads scoped to this process
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;

  const uploads = await prisma.upload.findMany({
    where: { engagementId: id, processId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      systemSource: true,
      rowCount: true,
      columnCount: true,
      status: true,
      schemaInference: true,
      dataRequestFileName: true,
      caseIdColumn: true,
      activityColumn: true,
      activityFallback: true,
      timestampColumn: true,
      actorColumn: true,
      createdAt: true,
    },
  });

  return NextResponse.json(uploads);
}

// POST — create a new upload bound to this process
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId } = await params;

  const proc = await prisma.engagementProcess.findUnique({ where: { id: processId, engagementId: id } });
  if (!proc) return NextResponse.json({ error: "Process not found" }, { status: 404 });

  const body = await req.json();
  const {
    originalName, rowCount, columnCount, schemaInference, rawData,
    dataRequestFileName, caseIdColumn, activityColumn, activityFallback,
    timestampColumn, actorColumn,
  } = body;

  if (!originalName) {
    return NextResponse.json({ error: "originalName is required" }, { status: 400 });
  }

  // Re-upload semantics: if a file with the same originalName already exists for
  // this process, delete it first so the new file replaces (and frees its slot).
  await prisma.upload.deleteMany({
    where: { engagementId: id, processId, originalName },
  });

  const upload = await prisma.upload.create({
    data: {
      fileName: originalName,
      originalName,
      rowCount: rowCount ?? null,
      columnCount: columnCount ?? null,
      systemSource: schemaInference?.detectedSystem ?? null,
      schemaInference: schemaInference ?? undefined,
      rawData: rawData ?? undefined,
      status: dataRequestFileName ? "matched" : "inferred",
      engagementId: id,
      processId,
      dataRequestFileName: dataRequestFileName ?? null,
      caseIdColumn: caseIdColumn ?? null,
      activityColumn: activityColumn ?? null,
      activityFallback: activityFallback ?? null,
      timestampColumn: timestampColumn ?? null,
      actorColumn: actorColumn ?? null,
    },
    select: {
      id: true,
      originalName: true,
      systemSource: true,
      rowCount: true,
      columnCount: true,
      status: true,
      schemaInference: true,
      dataRequestFileName: true,
      caseIdColumn: true,
      activityColumn: true,
      activityFallback: true,
      timestampColumn: true,
      actorColumn: true,
      createdAt: true,
    },
  });

  return NextResponse.json(upload, { status: 201 });
}
