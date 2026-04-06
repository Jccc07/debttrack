// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount, computeInstallments } from "@/lib/utils";
import { sendTransactionCreated, sendPaymentConfirmation } from "@/lib/mailer";

async function getOwned(id: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: {
      installments: {
        orderBy: { monthNumber: "asc" },
        include: { penalties: { orderBy: { appliedAt: "desc" } } },
      },
      penalties: { orderBy: { appliedAt: "desc" } },
      user: { select: { name: true, email: true } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const tx = await getOwned(id, session.user.id);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { user: _user, ...txData } = tx as any;
  return NextResponse.json(txData);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getOwned(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://debttrack-chi.vercel.app";

  // Determine if counterpartyEmail is being added for the first time
  const addingCounterpartyEmail =
    body.counterpartyEmail &&
    !existing.counterpartyEmail &&
    body.counterpartyEmail !== existing.counterpartyEmail;

  // Determine if status is being flipped to PAID
  const beingMarkedPaid = body.status === "PAID" && existing.status !== "PAID";

  // ── Installment update ──
  if (existing.isInstallment) {
    const newMonths   = body.installmentMonths !== undefined ? Number(body.installmentMonths) : Number(existing.installmentMonths);
    const newRate     = body.interestRate !== undefined ? Number(body.interestRate) : Number(existing.interestRate);
    const newMethod   = body.installmentMethod ?? existing.installmentMethod;
    const newAmount   = body.amount !== undefined ? Number(body.amount) : Number(existing.amount);
    const newPayAtEnd = body.payAtEnd !== undefined ? body.payAtEnd : existing.payAtEnd;
    const txDate      = body.transactionDate ? new Date(body.transactionDate) : new Date(existing.transactionDate);

    const installmentRows = computeInstallments(newAmount, newRate, newMonths, newMethod as "FLAT" | "REDUCING", txDate);
    const newEndAmount    = Math.round(installmentRows.reduce((sum, r) => sum + r.totalAmount, 0) * 100) / 100;
    const newDueDate      = installmentRows[installmentRows.length - 1].dueDate;

    const updated = await prisma.$transaction(async (tx) => {
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
          ...(body.type              !== undefined && { type: body.type }),
          ...(body.counterparty      !== undefined && { counterparty: body.counterparty }),
          ...(body.counterpartyEmail !== undefined && { counterpartyEmail: body.counterpartyEmail || null }),
          ...(body.notes             !== undefined && { notes: body.notes }),
          ...(body.transactionDate               && { transactionDate: txDate }),
          amount: newAmount, interestRate: newRate,
          installmentMonths: newMonths, installmentMethod: newMethod,
          payAtEnd: newPayAtEnd, endAmount: newEndAmount, dueDate: newDueDate,
          status: "UNPAID", paidAt: null,
          ...(body.penaltyEnabled   !== undefined && { penaltyEnabled: body.penaltyEnabled }),
          ...(body.penaltyGraceDays !== undefined && { penaltyGraceDays: body.penaltyGraceDays }),
          ...(body.penaltyType      !== undefined && { penaltyType: body.penaltyType }),
          ...(body.penaltyAmount    !== undefined && { penaltyAmount: body.penaltyAmount }),
          ...(body.penaltyFrequency !== undefined && { penaltyFrequency: body.penaltyFrequency }),
        },
        include: {
          installments: { orderBy: { monthNumber: "asc" }, include: { penalties: { orderBy: { appliedAt: "desc" } } } },
          penalties: { orderBy: { appliedAt: "desc" } },
        },
      });
    });

    // Fire notification if counterpartyEmail newly added
    if (addingCounterpartyEmail && existing.shareToken) {
      const shareUrl = `${appUrl}/share/${existing.shareToken}`;
      sendTransactionCreated({
        to: (existing as any).user.email,
        counterpartyEmail: body.counterpartyEmail,
        ownerName: (existing as any).user.name,
        counterparty: updated.counterparty ?? "Unknown",
        amount: newEndAmount,
        type: updated.type,
        transactionId: id,
        dueDate: newDueDate,
        shareUrl,
      }).catch((err) => console.error("[send-counterparty-added]", err));
    }

    return NextResponse.json(updated);
  }

  // ── Regular transaction update ──
  let endAmount = existing.endAmount;
  if (body.amount !== undefined || body.interestRate !== undefined || body.interestType) {
    const amount = Number(body.amount ?? existing.amount);
    const rate   = Number(body.interestRate ?? existing.interestRate);
    const iType  = body.interestType ?? existing.interestType;
    endAmount = computeEndAmount(amount, rate, iType as "PERCENT" | "FLAT") as any;
  }

  let dueDateUpdate: Date | null | undefined = undefined;
  if ("dueDate" in body) {
    dueDateUpdate = body.dueDate ? new Date(body.dueDate) : null;
  }

  const paidAt = beingMarkedPaid ? new Date() : undefined;

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...(body.type              !== undefined && { type: body.type }),
      ...(body.amount            !== undefined && { amount: body.amount }),
      ...(body.interestRate      !== undefined && { interestRate: body.interestRate }),
      ...(body.interestType      !== undefined && { interestType: body.interestType }),
      ...(body.counterparty      !== undefined && { counterparty: body.counterparty }),
      ...(body.counterpartyEmail !== undefined && { counterpartyEmail: body.counterpartyEmail || null }),
      ...(body.notes             !== undefined && { notes: body.notes }),
      ...(body.status            !== undefined && { status: body.status }),
      ...(body.transactionDate               && { transactionDate: new Date(body.transactionDate) }),
      ...(dueDateUpdate !== undefined        && { dueDate: dueDateUpdate }),
      endAmount,
      ...(beingMarkedPaid                    ? { paidAt: paidAt! } : {}),
      ...(body.status && body.status !== "PAID" ? { paidAt: null } : {}),
      ...(body.penaltyEnabled   !== undefined && { penaltyEnabled: body.penaltyEnabled }),
      ...(body.penaltyGraceDays !== undefined && { penaltyGraceDays: body.penaltyGraceDays }),
      ...(body.penaltyType      !== undefined && { penaltyType: body.penaltyType }),
      ...(body.penaltyAmount    !== undefined && { penaltyAmount: body.penaltyAmount }),
      ...(body.penaltyFrequency !== undefined && { penaltyFrequency: body.penaltyFrequency }),
    },
    include: {
      installments: { orderBy: { monthNumber: "asc" }, include: { penalties: { orderBy: { appliedAt: "desc" } } } },
      penalties: { orderBy: { appliedAt: "desc" } },
    },
  });

  // Fire emails after update (non-blocking)

  // Counterparty email newly added — send transaction details + share link
  if (addingCounterpartyEmail && existing.shareToken) {
    const shareUrl = `${appUrl}/share/${existing.shareToken}`;
    sendTransactionCreated({
      to: (existing as any).user.email,
      counterpartyEmail: body.counterpartyEmail,
      ownerName: (existing as any).user.name,
      counterparty: updated.counterparty ?? "Unknown",
      amount: Number(endAmount),
      type: updated.type,
      transactionId: id,
      dueDate: updated.dueDate ?? null,
      shareUrl,
    }).catch((err) => console.error("[send-counterparty-added]", err));
  }

  // Marked as paid
  if (beingMarkedPaid && paidAt) {
    const shareUrl = existing.shareToken ? `${appUrl}/share/${existing.shareToken}` : null;
    sendPaymentConfirmation({
      to: (existing as any).user.email,
      counterpartyEmail: existing.counterpartyEmail ?? null,
      ownerName: (existing as any).user.name,
      counterparty: existing.counterparty ?? "Unknown",
      amount: Number(endAmount),
      type: existing.type,
      transactionId: id,
      paidAt,
      shareUrl,
    }).catch((err) => console.error("[send-paid]", err));
  }

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