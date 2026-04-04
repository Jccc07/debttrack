// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEndAmount } from "@/lib/utils";

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

  // Handle nullable dueDate sort — nulls go last for "asc", last for "desc" too
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
    } = body;

    if (!type || !amount || !transactionDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const endAmount = computeEndAmount(Number(amount), Number(interestRate), interestType);

    const transaction = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type,
        amount,
        interestRate,
        interestType,
        endAmount,
        counterparty: counterparty || null,
        notes: notes || null,
        transactionDate: new Date(transactionDate),
        dueDate: dueDate ? new Date(dueDate) : null,   // nullable
        status: "UNPAID",
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}