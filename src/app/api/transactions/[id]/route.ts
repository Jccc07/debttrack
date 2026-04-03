// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount } from "@/lib/utils";

async function getOwned(id: string, userId: string) {
  return prisma.transaction.findFirst({ where: { id, userId } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await getOwned(params.id, session.user.id);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(tx);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await getOwned(params.id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Recompute endAmount if amount or interest changed
  let endAmount = existing.endAmount;
  if (body.amount || body.interestRate !== undefined || body.interestType) {
    const amount = Number(body.amount ?? existing.amount);
    const rate = Number(body.interestRate ?? existing.interestRate);
    const iType = body.interestType ?? existing.interestType;
    endAmount = computeEndAmount(amount, rate, iType as "PERCENT" | "FLAT");
  }

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...body,
      endAmount,
      ...(body.status === "PAID" && !existing.paidAt ? { paidAt: new Date() } : {}),
      ...(body.status !== "PAID" ? { paidAt: null } : {}),
      transactionDate: body.transactionDate ? new Date(body.transactionDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await getOwned(params.id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transaction.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}