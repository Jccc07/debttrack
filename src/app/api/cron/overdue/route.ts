// src/app/api/cron/overdue/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDueDateReminder, sendOverdueAlert } from "@/lib/mailer";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // 1. Mark overdue transactions
  const { count: markedOverdue } = await prisma.transaction.updateMany({
    where: { status: "UNPAID", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });

  // 2. Create overdue notifications + send emails
  const overdueTransactions = await prisma.transaction.findMany({
    where: { status: "OVERDUE", dueDate: { lt: now } },
    include: { user: true },
  });

  for (const tx of overdueTransactions) {
    const alreadyNotified = await prisma.notification.findFirst({
      where: { transactionId: tx.id, type: "OVERDUE" },
    });
    if (alreadyNotified) continue;

    await prisma.notification.create({
      data: {
        userId: tx.userId,
        transactionId: tx.id,
        type: "OVERDUE",
        message: `Payment ${tx.type === "LEND" ? "from" : "to"} ${tx.counterparty ?? "Unknown"} is overdue (due ${new Date(tx.dueDate).toLocaleDateString()})`,
        sentAt: new Date(),
      },
    });

    try {
      await sendOverdueAlert({
        to: tx.user.email,
        name: tx.user.name,
        counterparty: tx.counterparty ?? "Unknown",
        dueDate: tx.dueDate,
        amount: Number(tx.endAmount),
        type: tx.type,
        transactionId: tx.id,
      });
    } catch (err) {
      console.error("Failed to send overdue email:", err);
    }
  }

  // 3. Upcoming due date reminders (within 3 days)
  const upcoming = await prisma.transaction.findMany({
    where: {
      status: "UNPAID",
      dueDate: { gte: now, lte: threeDaysFromNow },
    },
    include: { user: true },
  });

  for (const tx of upcoming) {
    const alreadyNotified = await prisma.notification.findFirst({
      where: { transactionId: tx.id, type: "UPCOMING_DUE" },
    });
    if (alreadyNotified) continue;

    await prisma.notification.create({
      data: {
        userId: tx.userId,
        transactionId: tx.id,
        type: "UPCOMING_DUE",
        message: `Payment ${tx.type === "LEND" ? "from" : "to"} ${tx.counterparty ?? "Unknown"} is due on ${new Date(tx.dueDate).toLocaleDateString()}`,
        sentAt: new Date(),
      },
    });

    try {
      await sendDueDateReminder({
        to: tx.user.email,
        name: tx.user.name,
        counterparty: tx.counterparty ?? "Unknown",
        dueDate: tx.dueDate,
        amount: Number(tx.endAmount),
        type: tx.type,
        transactionId: tx.id,
      });
    } catch (err) {
      console.error("Failed to send reminder email:", err);
    }
  }

  return NextResponse.json({
    markedOverdue,
    overdueNotified: overdueTransactions.length,
    upcomingReminded: upcoming.length,
  });
}