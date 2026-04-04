// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount } from "@/lib/utils";

async function getOwned(id: string, userId: string) {
  return prisma.transaction.findFirst({ where: { id, userId } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const tx = await getOwned(id, session.user.id);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tx);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getOwned(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  let endAmount = existing.endAmount;
  if (body.amount !== undefined || body.interestRate !== undefined || body.interestType) {
    const amount = Number(body.amount ?? existing.amount);
    const rate   = Number(body.interestRate ?? existing.interestRate);
    const iType  = body.interestType ?? existing.interestType;
    endAmount = computeEndAmount(amount, rate, iType as "PERCENT" | "FLAT") as any;
  }

  // Build dueDate update — explicitly allow setting to null
  let dueDateUpdate: Date | null | undefined = undefined;
  if ("dueDate" in body) {
    dueDateUpdate = body.dueDate ? new Date(body.dueDate) : null;
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...(body.type        !== undefined && { type: body.type }),
      ...(body.amount      !== undefined && { amount: body.amount }),
      ...(body.interestRate !== undefined && { interestRate: body.interestRate }),
      ...(body.interestType !== undefined && { interestType: body.interestType }),
      ...(body.counterparty !== undefined && { counterparty: body.counterparty }),
      ...(body.notes        !== undefined && { notes: body.notes }),
      ...(body.status       !== undefined && { status: body.status }),
      ...(body.transactionDate && { transactionDate: new Date(body.transactionDate) }),
      ...(dueDateUpdate !== undefined && { dueDate: dueDateUpdate }),
      endAmount,
      ...(body.status === "PAID" && !existing.paidAt ? { paidAt: new Date() } : {}),
      ...(body.status && body.status !== "PAID"      ? { paidAt: null }        : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getOwned(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}