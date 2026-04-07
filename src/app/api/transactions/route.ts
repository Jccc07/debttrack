// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount, computeInstallments, computeInstallmentsBiMonthly } from "@/lib/utils";
import { sendTransactionCreated } from "@/lib/mailer";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type   = searchParams.get("type");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const sort   = searchParams.get("sort") ?? "transactionDate";
  const order  = (searchParams.get("order") ?? "desc") as "asc" | "desc";
  const page   = parseInt(searchParams.get("page") ?? "1");
  const limit  = parseInt(searchParams.get("limit") ?? "20");

  const where = {
    userId: session.user.id,
    ...(type   && { type }),
    ...(status && { status }),
    ...(search && { counterparty: { contains: search, mode: "insensitive" as const } }),
  };

  let orderBy: object;
  if (sort === "dueDate") {
    orderBy = { dueDate: { sort: order, nulls: "last" } };
  } else {
    orderBy = { [sort]: order };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where, orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        installments: { orderBy: { monthNumber: "asc" }, include: { penalties: { orderBy: { appliedAt: "desc" } } } },
        penalties: { orderBy: { appliedAt: "desc" } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      type, amount, interestRate = 0, interestType = "PERCENT",
      counterparty, counterpartyEmail, notes, transactionDate, dueDate,
      isInstallment = false, installmentMonths, installmentMethod,
      installmentIntervalDays = 30, payAtEnd = false,
      // Bi-monthly
      installmentFrequency = "MONTHLY",
      biMonthlyDay1, biMonthlyDay2,
      // Penalty
      penaltyEnabled = false, penaltyGraceDays, penaltyType, penaltyAmount, penaltyFrequency,
      // Email preference
      sendShareLink = true,
    } = body;

    if (!type || !amount || !transactionDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const txDate = new Date(transactionDate);
    const intervalDays = Number(installmentIntervalDays) || 30;
    const isBiMonthly = isInstallment && installmentFrequency === "TWICE_MONTHLY";

    let endAmount: number;
    let txDueDate: Date | null;
    let installmentRows: ReturnType<typeof computeInstallments> = [];

    if (isInstallment && installmentMonths && installmentMethod) {
      if (isBiMonthly) {
        const d1 = Number(biMonthlyDay1) || 15;
        const d2 = Number(biMonthlyDay2) || 30;
        installmentRows = computeInstallmentsBiMonthly(
          Number(amount), Number(interestRate), Number(installmentMonths),
          installmentMethod, txDate, d1, d2
        );
      } else {
        installmentRows = computeInstallments(
          Number(amount), Number(interestRate), Number(installmentMonths),
          installmentMethod, txDate, intervalDays
        );
      }
      endAmount = Math.round(installmentRows.reduce((sum, r) => sum + r.totalAmount, 0) * 100) / 100;
      txDueDate = installmentRows[installmentRows.length - 1].dueDate;
    } else {
      endAmount = computeEndAmount(Number(amount), Number(interestRate), interestType);
      txDueDate = dueDate ? new Date(dueDate) : null;
    }

    const shareToken = randomBytes(32).toString("hex");

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId: session.user.id,
          type, amount, interestRate, interestType, endAmount,
          counterparty: counterparty || null,
          counterpartyEmail: counterpartyEmail || null,
          notes: notes || null,
          transactionDate: txDate,
          dueDate: txDueDate,
          status: "UNPAID",
          isInstallment,
          installmentMonths: isInstallment ? Number(installmentMonths) : null,
          installmentMethod: isInstallment ? installmentMethod : null,
          installmentIntervalDays: isInstallment ? intervalDays : null,
          payAtEnd: isInstallment ? payAtEnd : false,
          installmentFrequency: isInstallment ? installmentFrequency : null,
          biMonthlyDay1: isBiMonthly ? (Number(biMonthlyDay1) || 15) : null,
          biMonthlyDay2: isBiMonthly ? (Number(biMonthlyDay2) || 30) : null,
          penaltyEnabled,
          penaltyGraceDays: penaltyEnabled ? (penaltyGraceDays ?? null) : null,
          penaltyType: penaltyEnabled ? (penaltyType ?? null) : null,
          penaltyAmount: penaltyEnabled ? (penaltyAmount ?? null) : null,
          penaltyFrequency: penaltyEnabled ? (penaltyFrequency ?? null) : null,
          shareToken,
          shareExpiresAt: null,
        },
      });

      if (isInstallment && installmentRows.length > 0) {
        await tx.installment.createMany({
          data: installmentRows.map((row) => ({
            transactionId: created.id,
            monthNumber: row.monthNumber,
            dueDate: row.dueDate,
            principalAmount: row.principalAmount,
            interestAmount: row.interestAmount,
            totalAmount: row.totalAmount,
            status: "UNPAID",
          })),
        });
      }

      return tx.transaction.findUnique({
        where: { id: created.id },
        include: {
          installments: { orderBy: { monthNumber: "asc" }, include: { penalties: { orderBy: { appliedAt: "desc" } } } },
          penalties: { orderBy: { appliedAt: "desc" } },
          user: { select: { name: true, email: true } },
        },
      });
    });

    if (!transaction) throw new Error("Transaction creation failed");

    // ─── Send creation email (fire and forget) ────────────────────────────────
    const shareUrl = sendShareLink
      ? `${process.env.NEXT_PUBLIC_APP_URL}/share/${shareToken}`
      : null;

    const penaltyRule = penaltyEnabled && penaltyGraceDays != null && penaltyType && penaltyAmount && penaltyFrequency
      ? { graceDays: Number(penaltyGraceDays), penaltyType, penaltyAmount: Number(penaltyAmount), penaltyFrequency, baseAmount: endAmount }
      : null;

    // Determine payment method label for the email
    const paymentMethod = isInstallment
      ? (installmentMethod ?? "INSTALLMENT")
      : interestType === "PERCENT"
        ? "STRAIGHT"
        : "STRAIGHT";

    sendTransactionCreated({
      to: (transaction as any).user.email,
      counterpartyEmail: counterpartyEmail || null,
      ownerName: (transaction as any).user.name,
      counterparty: counterparty || "Unknown",
      amount: endAmount,
      type,
      transactionId: transaction.id,
      dueDate: txDueDate,
      shareUrl,
      penaltyRule,
      // New fields
      principalAmount: Number(amount),
      interestRate: Number(interestRate),
      interestType,
      paymentMethod,
      isInstallment,
      installmentMonths: isInstallment ? Number(installmentMonths) : null,
    }).catch((err) => console.error("[send-created]", err));

    const { user: _user, ...txData } = transaction as any;
    return NextResponse.json(txData, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}