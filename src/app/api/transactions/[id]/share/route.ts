// src/app/api/transactions/[id]/share/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  // days: null means no expiry
  const days = body.days === null ? null : Number(body.days) || 7;

  const tx = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = randomBytes(32).toString("hex");

  let expiresAt: Date | null = null;
  if (days !== null) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      shareToken: token,
      shareExpiresAt: expiresAt,
    },
  });

  return NextResponse.json({
    shareToken: updated.shareToken,
    shareExpiresAt: updated.shareExpiresAt,
    shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const tx = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transaction.update({
    where: { id },
    data: { shareToken: null, shareExpiresAt: null },
  });

  return NextResponse.json({ success: true });
}