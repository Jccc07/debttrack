// src/app/api/transactions/[id]/penalty/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const tx = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { amount, daysOverdue, note, installmentId } = body;

  if (!amount || !note) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create the penalty record
  const penalty = await prisma.penalty.create({
    data: {
      transactionId: id,
      installmentId: installmentId ?? null,
      amount,
      daysOverdue,
      note,
    },
  });

  return NextResponse.json(penalty, { status: 201 });
}

export async function GET(
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

  const penalties = await prisma.penalty.findMany({
    where: { transactionId: id },
    orderBy: { appliedAt: "desc" },
  });

  return NextResponse.json(penalties);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { penaltyId } = await req.json();

  // Verify the penalty belongs to this transaction which belongs to this user
  const penalty = await prisma.penalty.findFirst({
    where: { id: penaltyId, transactionId: id, transaction: { userId: session.user.id } },
  });
  if (!penalty) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.penalty.delete({ where: { id: penaltyId } });
  return NextResponse.json({ success: true });
}