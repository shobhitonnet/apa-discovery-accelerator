import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH — update mapping fields on an existing upload
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; processId: string; uploadId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId, uploadId } = await params;
  const body = await req.json().catch(() => ({}));

  const allowed = ["dataRequestFileName", "caseIdColumn", "activityColumn", "activityFallback", "timestampColumn", "actorColumn", "status"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key] ?? null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const upload = await prisma.upload.update({
    where: { id: uploadId, engagementId: id, processId },
    data,
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

  return NextResponse.json(upload);
}

// DELETE — remove an upload (consultant un-maps a file)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; processId: string; uploadId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, processId, uploadId } = await params;

  await prisma.upload.delete({
    where: { id: uploadId, engagementId: id, processId },
  });

  return NextResponse.json({ success: true });
}
