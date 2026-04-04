// src/app/api/installments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership via transaction
  const installment = await prisma.installment.findFirst({
    where: { id },
    include: { transaction: { select: { userId: true } } },
  });

  if (!installment || installment.transaction.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { status } = await req.json();
  const newStatus = status ?? (installment.status === "PAID" ? "UNPAID" : "PAID");

  const updated = await prisma.installment.update({
    where: { id },
    data: {
      status: newStatus,
      paidAt: newStatus === "PAID" ? new Date() : null,
    },
  });

  // Recompute parent transaction status
  const allInstallments = await prisma.installment.findMany({
    where: { transactionId: installment.transactionId },
  });

  const allPaid = allInstallments.every((i) => (i.id === id ? newStatus : i.status) === "PAID");
  const anyOverdue = allInstallments.some(
    (i) => (i.id === id ? newStatus : i.status) === "OVERDUE"
  );

  const txStatus = allPaid ? "PAID" : anyOverdue ? "OVERDUE" : "UNPAID";

  await prisma.transaction.update({
    where: { id: installment.transactionId },
    data: {
      status: txStatus,
      paidAt: allPaid ? new Date() : null,
    },
  });

  return NextResponse.json(updated);
}