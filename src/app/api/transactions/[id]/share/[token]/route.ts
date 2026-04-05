// src/app/api/share/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const tx = await prisma.transaction.findFirst({
    where: { shareToken: token },
    include: {
      installments: {
        orderBy: { monthNumber: "asc" },
        include: { penalties: { orderBy: { appliedAt: "desc" } } },
      },
      penalties: { orderBy: { appliedAt: "desc" } },
      user: { select: { name: true } },
    },
  });

  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check expiry — null means no expiry (never expires)
  if (tx.shareExpiresAt && new Date(tx.shareExpiresAt) < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  // Return safe subset — strip sensitive fields manually
  const sharedBy = tx.user.name;

  return NextResponse.json({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    interestRate: tx.interestRate,
    interestType: tx.interestType,
    endAmount: tx.endAmount,
    counterparty: tx.counterparty,
    notes: tx.notes,
    transactionDate: tx.transactionDate,
    dueDate: tx.dueDate,
    status: tx.status,
    paidAt: tx.paidAt,
    isInstallment: tx.isInstallment,
    installmentMonths: tx.installmentMonths,
    installmentMethod: tx.installmentMethod,
    payAtEnd: tx.payAtEnd,
    penaltyEnabled: tx.penaltyEnabled,
    penaltyGraceDays: tx.penaltyGraceDays,
    penaltyType: tx.penaltyType,
    penaltyAmount: tx.penaltyAmount,
    penaltyFrequency: tx.penaltyFrequency,
    shareExpiresAt: tx.shareExpiresAt,
    installments: tx.installments,
    penalties: tx.penalties,
    sharedBy,
  });
}