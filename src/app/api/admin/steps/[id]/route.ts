import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const step = await prisma.processStepTemplate.update({
    where: { id },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.processTemplate !== undefined && { processTemplate: body.processTemplate }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });
  return NextResponse.json(step);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.processStepTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
