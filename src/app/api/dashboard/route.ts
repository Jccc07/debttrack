// src/app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [transactions, recentTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      select: { type: true, amount: true, endAmount: true, status: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { installments: { orderBy: { monthNumber: "asc" } } },
    }),
  ]);

  const totalLent = transactions
    .filter((t) => t.type === "LEND" && t.status !== "PAID")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalOwed = transactions
    .filter((t) => t.type === "OWE" && t.status !== "PAID")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpectedReturn = transactions
    .filter((t) => t.type === "LEND" && t.status !== "PAID")
    .reduce((sum, t) => sum + Number(t.endAmount), 0);

  const overdueCount = transactions.filter((t) => t.status === "OVERDUE").length;

  // Monthly data for chart (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyTransactions = await prisma.transaction.findMany({
    where: { userId, transactionDate: { gte: sixMonthsAgo } },
    select: { type: true, amount: true, transactionDate: true },
  });

  const monthlyMap: Record<string, { lent: number; owed: number }> = {};
  monthlyTransactions.forEach((t) => {
    const key = new Date(t.transactionDate).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    if (!monthlyMap[key]) monthlyMap[key] = { lent: 0, owed: 0 };
    if (t.type === "LEND") monthlyMap[key].lent += Number(t.amount);
    else monthlyMap[key].owed += Number(t.amount);
  });

  const chartData = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data }));

  return NextResponse.json({
    totalLent,
    totalOwed,
    totalExpectedReturn,
    overdueCount,
    recentTransactions,
    chartData,
  });
}