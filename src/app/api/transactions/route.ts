// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount, computeInstallments, computeInstallmentTotal } from "@/lib/utils";

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
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: { installments: { orderBy: { monthNumber: "asc" } } },
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
      counterparty, notes, transactionDate, dueDate,
      isInstallment = false, installmentMonths, installmentMethod,
    } = body;

    if (!type || !amount || !transactionDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const txDate = new Date(transactionDate);

    let endAmount: number;
    let txDueDate: Date | null;
    let installmentRows: ReturnType<typeof computeInstallments> = [];

    if (isInstallment && installmentMonths && installmentMethod) {
      // Installment transaction
      installmentRows = computeInstallments(
        Number(amount),
        Number(interestRate),
        Number(installmentMonths),
        installmentMethod,
        txDate
      );
      endAmount = installmentRows.reduce((sum, r) => sum + r.totalAmount, 0);
      endAmount = Math.round(endAmount * 100) / 100;
      // Due date = last installment's due date
      txDueDate = installmentRows[installmentRows.length - 1].dueDate;
    } else {
      endAmount = computeEndAmount(Number(amount), Number(interestRate), interestType);
      txDueDate = dueDate ? new Date(dueDate) : null;
    }

    // Create transaction + installments in one DB transaction
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId: session.user.id,
          type,
          amount,
          interestRate,
          interestType,
          endAmount,
          counterparty: counterparty || null,
          notes: notes || null,
          transactionDate: txDate,
          dueDate: txDueDate,
          status: "UNPAID",
          isInstallment,
          installmentMonths: isInstallment ? Number(installmentMonths) : null,
          installmentMethod: isInstallment ? installmentMethod : null,
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
        include: { installments: { orderBy: { monthNumber: "asc" } } },
      });
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}