// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount, computeInstallments, computeInstallmentsBiMonthly } from "@/lib/utils";
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
  const sendShareLink = body.sendShareLink !== false; // default true

  const addingCounterpartyEmail =
    body.counterpartyEmail && !existing.counterpartyEmail &&
    body.counterpartyEmail !== existing.counterpartyEmail;

  const beingMarkedPaid = body.status === "PAID" && existing.status !== "PAID";

  // ── Installment update ──
  if (existing.isInstallment) {
    const newMonths    = body.installmentMonths !== undefined ? Number(body.installmentMonths) : Number(existing.installmentMonths);
    const newRate      = body.interestRate !== undefined ? Number(body.interestRate) : Number(existing.interestRate);
    const newMethod    = body.installmentMethod ?? existing.installmentMethod;
    const newAmount    = body.amount !== undefined ? Number(body.amount) : Number(existing.amount);
    const newPayAtEnd  = body.payAtEnd !== undefined ? body.payAtEnd : existing.payAtEnd;
    const txDate       = body.transactionDate ? new Date(body.transactionDate) : new Date(existing.transactionDate);
    const newFrequency = body.installmentFrequency ?? existing.installmentFrequency ?? "MONTHLY";
    const newDay1      = body.biMonthlyDay1 !== undefined ? Number(body.biMonthlyDay1) : (existing.biMonthlyDay1 ?? 15);
    const newDay2      = body.biMonthlyDay2 !== undefined ? Number(body.biMonthlyDay2) : (existing.biMonthlyDay2 ?? 30);
    const isBiMonthly  = newFrequency === "TWICE_MONTHLY";

    const installmentRows = isBiMonthly
      ? computeInstallmentsBiMonthly(newAmount, newRate, newMonths, newMethod as "FLAT" | "REDUCING", txDate, newDay1, newDay2)
      : computeInstallments(newAmount, newRate, newMonths, newMethod as "FLAT" | "REDUCING", txDate);

    const newEndAmount = Math.round(installmentRows.reduce((sum, r) => sum + r.totalAmount, 0) * 100) / 100;
    const newDueDate   = installmentRows[installmentRows.length - 1].dueDate;

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
          installmentFrequency: newFrequency,
          biMonthlyDay1: isBiMonthly ? newDay1 : null,
          biMonthlyDay2: isBiMonthly ? newDay2 : null,
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

    if (addingCounterpartyEmail && existing.shareToken) {
      const shareUrl = sendShareLink ? `${appUrl}/share/${existing.shareToken}` : null;
      const pen = updated.penaltyEnabled && updated.penaltyGraceDays != null && updated.penaltyType && updated.penaltyAmount && updated.penaltyFrequency
        ? { graceDays: updated.penaltyGraceDays, penaltyType: updated.penaltyType as any, penaltyAmount: Number(updated.penaltyAmount), penaltyFrequency: updated.penaltyFrequency as any, baseAmount: newEndAmount }
        : null;
      sendTransactionCreated({
        to: (existing as any).user.email,
        counterpartyEmail: body.counterpartyEmail,
        ownerName: (existing as any).user.name,
        counterparty: updated.counterparty ?? "Unknown",
        amount: newEndAmount, type: updated.type, transactionId: id,
        dueDate: newDueDate, shareUrl, penaltyRule: pen,
        // ✅ Fix: added missing CreatedParams fields
        principalAmount: newAmount,
        interestRate: newRate,
        interestType: updated.interestType ?? "PERCENT",
        paymentMethod: newMethod ?? "STRAIGHT",
        isInstallment: true,
        installmentMonths: newMonths,
      }).catch((err) => console.error("[send-counterparty-added]", err));
    }

    return NextResponse.json(updated);
  }

  // ── Regular update ──
  let endAmount = existing.endAmount;
  if (body.amount !== undefined || body.interestRate !== undefined || body.interestType) {
    endAmount = computeEndAmount(
      Number(body.amount ?? existing.amount),
      Number(body.interestRate ?? existing.interestRate),
      (body.interestType ?? existing.interestType) as "PERCENT" | "FLAT"
    ) as any;
  }

  let dueDateUpdate: Date | null | undefined = undefined;
  if ("dueDate" in body) dueDateUpdate = body.dueDate ? new Date(body.dueDate) : null;

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
      ...(beingMarkedPaid                      ? { paidAt: paidAt! } : {}),
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

  if (addingCounterpartyEmail && existing.shareToken) {
    const shareUrl = sendShareLink ? `${appUrl}/share/${existing.shareToken}` : null;
    const pen = updated.penaltyEnabled && updated.penaltyGraceDays != null && updated.penaltyType && updated.penaltyAmount && updated.penaltyFrequency
      ? { graceDays: updated.penaltyGraceDays, penaltyType: updated.penaltyType as any, penaltyAmount: Number(updated.penaltyAmount), penaltyFrequency: updated.penaltyFrequency as any, baseAmount: Number(endAmount) }
      : null;
    sendTransactionCreated({
      to: (existing as any).user.email,
      counterpartyEmail: body.counterpartyEmail,
      ownerName: (existing as any).user.name,
      counterparty: updated.counterparty ?? "Unknown",
      amount: Number(endAmount), type: updated.type, transactionId: id,
      dueDate: updated.dueDate ?? null, shareUrl, penaltyRule: pen,
      principalAmount: Number(existing.amount),
      interestRate: Number(updated.interestRate),
      interestType: updated.interestType ?? "PERCENT",
      paymentMethod: (updated.installmentMethod as string) ?? "STRAIGHT",
      isInstallment: false,
    }).catch((err) => console.error("[send-counterparty-added]", err));
  }

  if (beingMarkedPaid && paidAt) {
    const shareUrl = sendShareLink && existing.shareToken ? `${appUrl}/share/${existing.shareToken}` : null;
    sendPaymentConfirmation({
      to: (existing as any).user.email,
      counterpartyEmail: existing.counterpartyEmail ?? null,
      ownerName: (existing as any).user.name,
      counterparty: existing.counterparty ?? "Unknown",
      amount: Number(endAmount), type: existing.type, transactionId: id,
      paidAt, shareUrl,
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