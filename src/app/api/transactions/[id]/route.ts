// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount, computeInstallments } from "@/lib/utils";

async function getOwned(id: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: { installments: { orderBy: { monthNumber: "asc" } } },
  });
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

  // --- Installment transaction update ---
  if (existing.isInstallment) {
    const newMonths = body.installmentMonths !== undefined
      ? Number(body.installmentMonths)
      : Number(existing.installmentMonths);
    const newRate = body.interestRate !== undefined
      ? Number(body.interestRate)
      : Number(existing.interestRate);
    const newMethod = body.installmentMethod ?? existing.installmentMethod;
    const newAmount = body.amount !== undefined ? Number(body.amount) : Number(existing.amount);
    const newPayAtEnd = body.payAtEnd !== undefined ? body.payAtEnd : existing.payAtEnd;
    const txDate = body.transactionDate
      ? new Date(body.transactionDate)
      : new Date(existing.transactionDate);

    const installmentRows = computeInstallments(
      newAmount, newRate, newMonths, newMethod as "FLAT" | "REDUCING", txDate
    );
    const newEndAmount = Math.round(
      installmentRows.reduce((sum, r) => sum + r.totalAmount, 0) * 100
    ) / 100;
    const newDueDate = installmentRows[installmentRows.length - 1].dueDate;

    const updated = await prisma.$transaction(async (tx) => {
      // Delete all installments and recreate with new schedule
      await tx.installment.deleteMany({ where: { transactionId: id } });

      await tx.installment.createMany({
        data: installmentRows.map((row) => ({
          transactionId: id,
          monthNumber: row.monthNumber,
          dueDate: row.dueDate,
          principalAmount: row.principalAmount,
          interestAmount: row.interestAmount,
          totalAmount: row.totalAmount,
          status: "UNPAID",
        })),
      });

      return tx.transaction.update({
        where: { id },
        data: {
          ...(body.type !== undefined && { type: body.type }),
          ...(body.counterparty !== undefined && { counterparty: body.counterparty }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.transactionDate && { transactionDate: txDate }),
          amount: newAmount,
          interestRate: newRate,
          installmentMonths: newMonths,
          installmentMethod: newMethod,
          payAtEnd: newPayAtEnd,
          endAmount: newEndAmount,
          dueDate: newDueDate,
          status: "UNPAID",
          paidAt: null,
        },
        include: { installments: { orderBy: { monthNumber: "asc" } } },
      });
    });

    return NextResponse.json(updated);
  }

  // --- Regular (non-installment) transaction update ---
  let endAmount = existing.endAmount;
  if (body.amount !== undefined || body.interestRate !== undefined || body.interestType) {
    const amount = Number(body.amount ?? existing.amount);
    const rate = Number(body.interestRate ?? existing.interestRate);
    const iType = body.interestType ?? existing.interestType;
    endAmount = computeEndAmount(amount, rate, iType as "PERCENT" | "FLAT") as any;
  }

  let dueDateUpdate: Date | null | undefined = undefined;
  if ("dueDate" in body) {
    dueDateUpdate = body.dueDate ? new Date(body.dueDate) : null;
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...(body.type !== undefined && { type: body.type }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.interestRate !== undefined && { interestRate: body.interestRate }),
      ...(body.interestType !== undefined && { interestType: body.interestType }),
      ...(body.counterparty !== undefined && { counterparty: body.counterparty }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.transactionDate && { transactionDate: new Date(body.transactionDate) }),
      ...(dueDateUpdate !== undefined && { dueDate: dueDateUpdate }),
      endAmount,
      ...(body.status === "PAID" && !existing.paidAt ? { paidAt: new Date() } : {}),
      ...(body.status && body.status !== "PAID" ? { paidAt: null } : {}),
    },
    include: { installments: { orderBy: { monthNumber: "asc" } } },
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