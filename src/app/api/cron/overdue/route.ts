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

  // Boundary times for "today"
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // 3 days from now (end of day)
  const threeDaysEnd = new Date(todayEnd);
  threeDaysEnd.setDate(threeDaysEnd.getDate() + 3);

  // ── 1. Mark UNPAID transactions whose dueDate has passed as OVERDUE ──
  const { count: markedOverdue } = await prisma.transaction.updateMany({
    where: {
      status: "UNPAID",
      dueDate: { lt: todayStart }, // strictly before today = overdue
    },
    data: { status: "OVERDUE" },
  });

  // ── 2. Notify + email OVERDUE transactions (once per transaction) ──
  const overdueTransactions = await prisma.transaction.findMany({
    where: {
      status: "OVERDUE",
      dueDate: { not: null },
    },
    include: { user: true },
  });

  let overdueNotified = 0;
  for (const tx of overdueTransactions) {
    const alreadyNotified = await prisma.notification.findFirst({
      where: { transactionId: tx.id, type: "OVERDUE" },
    });
    if (alreadyNotified) continue;

    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: {
        userId: tx.userId,
        transactionId: tx.id,
        type: "OVERDUE",
        message: `Payment ${verb} ${tx.counterparty ?? "Unknown"} is overdue (was due ${tx.dueDate!.toLocaleDateString()})`,
        sentAt: new Date(),
      },
    });

    try {
      await sendOverdueAlert({
        to: tx.user.email,
        name: tx.user.name,
        counterparty: tx.counterparty ?? "Unknown",
        dueDate: tx.dueDate!,
        amount: Number(tx.endAmount),
        type: tx.type,
        transactionId: tx.id,
      });
    } catch (err) {
      console.error("Failed to send overdue email:", err);
    }
    overdueNotified++;
  }

  // ── 3. Notify DUE TODAY (once per transaction) ──
  const dueToday = await prisma.transaction.findMany({
    where: {
      status: "UNPAID",
      dueDate: { gte: todayStart, lte: todayEnd },
    },
    include: { user: true },
  });

  let dueTodayNotified = 0;
  for (const tx of dueToday) {
    const alreadyNotified = await prisma.notification.findFirst({
      where: { transactionId: tx.id, type: "DUE_TODAY" },
    });
    if (alreadyNotified) continue;

    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: {
        userId: tx.userId,
        transactionId: tx.id,
        type: "DUE_TODAY",
        message: `Payment ${verb} ${tx.counterparty ?? "Unknown"} is due today!`,
        sentAt: new Date(),
      },
    });

    try {
      await sendDueDateReminder({
        to: tx.user.email,
        name: tx.user.name,
        counterparty: tx.counterparty ?? "Unknown",
        dueDate: tx.dueDate!,
        amount: Number(tx.endAmount),
        type: tx.type,
        transactionId: tx.id,
      });
    } catch (err) {
      console.error("Failed to send due-today email:", err);
    }
    dueTodayNotified++;
  }

  // ── 4. Notify DUE IN 1–3 DAYS (once per transaction) ──
  const upcoming = await prisma.transaction.findMany({
    where: {
      status: "UNPAID",
      dueDate: {
        gt: todayEnd,         // strictly after today (not today, that's above)
        lte: threeDaysEnd,
      },
    },
    include: { user: true },
  });

  let upcomingNotified = 0;
  for (const tx of upcoming) {
    const alreadyNotified = await prisma.notification.findFirst({
      where: { transactionId: tx.id, type: "UPCOMING_DUE" },
    });
    if (alreadyNotified) continue;

    const daysLeft = Math.ceil(
      (tx.dueDate!.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const verb = tx.type === "LEND" ? "from" : "to";

    await prisma.notification.create({
      data: {
        userId: tx.userId,
        transactionId: tx.id,
        type: "UPCOMING_DUE",
        message: `Payment ${verb} ${tx.counterparty ?? "Unknown"} is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${tx.dueDate!.toLocaleDateString()})`,
        sentAt: new Date(),
      },
    });

    try {
      await sendDueDateReminder({
        to: tx.user.email,
        name: tx.user.name,
        counterparty: tx.counterparty ?? "Unknown",
        dueDate: tx.dueDate!,
        amount: Number(tx.endAmount),
        type: tx.type,
        transactionId: tx.id,
      });
    } catch (err) {
      console.error("Failed to send upcoming email:", err);
    }
    upcomingNotified++;
  }

  return NextResponse.json({
    markedOverdue,
    overdueNotified,
    dueTodayNotified,
    upcomingNotified,
  });
}