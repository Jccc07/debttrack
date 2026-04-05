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
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const threeDaysEnd = new Date(todayEnd);
  threeDaysEnd.setDate(threeDaysEnd.getDate() + 3);

  const errors: string[] = [];

  // ── 1. Mark overdue regular transactions ──
  const { count: markedOverdue } = await prisma.transaction.updateMany({
    where: { status: "UNPAID", isInstallment: false, dueDate: { lt: todayStart } },
    data: { status: "OVERDUE" },
  });

  // ── 2. Mark overdue installments (skip payAtEnd) ──
  await prisma.installment.updateMany({
    where: { status: "UNPAID", dueDate: { lt: todayStart }, transaction: { payAtEnd: false } },
    data: { status: "OVERDUE" },
  });

  await prisma.transaction.updateMany({
    where: { status: "UNPAID", isInstallment: true, payAtEnd: true, dueDate: { lt: todayStart } },
    data: { status: "OVERDUE" },
  });

  // Recompute parent status for installment transactions
  const overdueInstallmentTxIds = await prisma.installment.findMany({
    where: { status: "OVERDUE", transaction: { payAtEnd: false } },
    select: { transactionId: true },
    distinct: ["transactionId"],
  });
  for (const { transactionId } of overdueInstallmentTxIds) {
    const all = await prisma.installment.findMany({ where: { transactionId } });
    const allPaid   = all.every((i) => i.status === "PAID");
    const anyOverdue = all.some((i) => i.status === "OVERDUE");
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: allPaid ? "PAID" : anyOverdue ? "OVERDUE" : "UNPAID", paidAt: allPaid ? new Date() : null },
    });
  }

  // ── Helper: safely send email and log errors instead of swallowing them ──
  async function trySend(fn: () => Promise<void>, label: string) {
    try { await fn(); }
    catch (err: any) {
      const msg = `[${label}] ${err?.message ?? String(err)} (code: ${err?.code ?? "?"})`;
      console.error(msg);
      errors.push(msg);
    }
  }

  // ── 3. Overdue — regular transactions ──
  const overdueRegular = await prisma.transaction.findMany({
    where: { status: "OVERDUE", isInstallment: false, dueDate: { not: null } },
    include: { user: true },
  });
  let overdueNotified = 0;
  for (const tx of overdueRegular) {
    const already = await prisma.notification.findFirst({ where: { transactionId: tx.id, type: "OVERDUE" } });
    if (already) continue;
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "OVERDUE",
        message: `Payment ${verb} ${tx.counterparty ?? "Unknown"} is overdue (was due ${tx.dueDate!.toLocaleDateString("en-PH")})`,
        sentAt: new Date() },
    });
    await trySend(() => sendOverdueAlert({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: tx.dueDate!, amount: Number(tx.endAmount), type: tx.type, transactionId: tx.id,
    }), `overdue:${tx.id}`);
    overdueNotified++;
  }

  // ── 4. Overdue — payAtEnd installments ──
  const overduePayAtEnd = await prisma.transaction.findMany({
    where: { status: "OVERDUE", isInstallment: true, payAtEnd: true },
    include: { user: true },
  });
  for (const tx of overduePayAtEnd) {
    const already = await prisma.notification.findFirst({ where: { transactionId: tx.id, type: "OVERDUE" } });
    if (already) continue;
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "OVERDUE",
        message: `Full payment ${verb} ${tx.counterparty ?? "Unknown"} is overdue (was due ${tx.dueDate!.toLocaleDateString("en-PH")}) — ${formatAmt(tx.endAmount)}`,
        sentAt: new Date() },
    });
    await trySend(() => sendOverdueAlert({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: tx.dueDate!, amount: Number(tx.endAmount), type: tx.type, transactionId: tx.id,
    }), `overdue-payatend:${tx.id}`);
    overdueNotified++;
  }

  // ── 5. Overdue — installments (non-payAtEnd) ──
  const overdueInstallments = await prisma.installment.findMany({
    where: { status: "OVERDUE", transaction: { payAtEnd: false } },
    include: { transaction: { include: { user: true } } },
  });
  for (const inst of overdueInstallments) {
    const notifType = `OVERDUE_INSTALLMENT_${inst.id}`;
    const already = await prisma.notification.findFirst({ where: { transactionId: inst.transactionId, type: notifType } });
    if (already) continue;
    const tx = inst.transaction;
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "OVERDUE",
        message: `Installment ${inst.monthNumber} of ${tx.installmentMonths} ${verb} ${tx.counterparty ?? "Unknown"} is overdue (was due ${inst.dueDate.toLocaleDateString("en-PH")})`,
        sentAt: new Date() },
    });
    await trySend(() => sendOverdueAlert({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: inst.dueDate, amount: Number(inst.totalAmount), type: tx.type, transactionId: tx.id,
    }), `overdue-inst:${inst.id}`);
  }

  // ── 6. Due today — regular ──
  const dueTodayRegular = await prisma.transaction.findMany({
    where: { status: "UNPAID", isInstallment: false, dueDate: { gte: todayStart, lte: todayEnd } },
    include: { user: true },
  });
  let dueTodayNotified = 0;
  for (const tx of dueTodayRegular) {
    const already = await prisma.notification.findFirst({ where: { transactionId: tx.id, type: "DUE_TODAY" } });
    if (already) continue;
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "DUE_TODAY",
        message: `Payment ${verb} ${tx.counterparty ?? "Unknown"} is due today!`, sentAt: new Date() },
    });
    await trySend(() => sendDueDateReminder({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: tx.dueDate!, amount: Number(tx.endAmount), type: tx.type, transactionId: tx.id,
    }), `due-today:${tx.id}`);
    dueTodayNotified++;
  }

  // ── 7. Due today — payAtEnd ──
  const dueTodayPayAtEnd = await prisma.transaction.findMany({
    where: { status: "UNPAID", isInstallment: true, payAtEnd: true, dueDate: { gte: todayStart, lte: todayEnd } },
    include: { user: true },
  });
  for (const tx of dueTodayPayAtEnd) {
    const already = await prisma.notification.findFirst({ where: { transactionId: tx.id, type: "DUE_TODAY" } });
    if (already) continue;
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "DUE_TODAY",
        message: `Full payment ${verb} ${tx.counterparty ?? "Unknown"} is due today! — ${formatAmt(tx.endAmount)}`, sentAt: new Date() },
    });
    await trySend(() => sendDueDateReminder({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: tx.dueDate!, amount: Number(tx.endAmount), type: tx.type, transactionId: tx.id,
    }), `due-today-payatend:${tx.id}`);
    dueTodayNotified++;
  }

  // ── 8. Due today — installments ──
  const dueTodayInstallments = await prisma.installment.findMany({
    where: { status: "UNPAID", dueDate: { gte: todayStart, lte: todayEnd }, transaction: { payAtEnd: false } },
    include: { transaction: { include: { user: true } } },
  });
  for (const inst of dueTodayInstallments) {
    const already = await prisma.notification.findFirst({ where: { transactionId: inst.transactionId, type: `DUE_TODAY_INST_${inst.monthNumber}` } });
    if (already) continue;
    const tx = inst.transaction;
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "DUE_TODAY",
        message: `Installment ${inst.monthNumber}/${tx.installmentMonths} ${verb} ${tx.counterparty ?? "Unknown"} is due today! (${formatAmt(inst.totalAmount)})`, sentAt: new Date() },
    });
    await trySend(() => sendDueDateReminder({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: inst.dueDate, amount: Number(inst.totalAmount), type: tx.type, transactionId: tx.id,
    }), `due-today-inst:${inst.id}`);
    dueTodayNotified++;
  }

  // ── 9. Upcoming (1-3 days) — regular ──
  const upcomingRegular = await prisma.transaction.findMany({
    where: { status: "UNPAID", isInstallment: false, dueDate: { gt: todayEnd, lte: threeDaysEnd } },
    include: { user: true },
  });
  let upcomingNotified = 0;
  for (const tx of upcomingRegular) {
    const already = await prisma.notification.findFirst({ where: { transactionId: tx.id, type: "UPCOMING_DUE" } });
    if (already) continue;
    const daysLeft = Math.ceil((tx.dueDate!.getTime() - todayStart.getTime()) / 86400000);
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "UPCOMING_DUE",
        message: `Payment ${verb} ${tx.counterparty ?? "Unknown"} is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${tx.dueDate!.toLocaleDateString("en-PH")})`, sentAt: new Date() },
    });
    await trySend(() => sendDueDateReminder({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: tx.dueDate!, amount: Number(tx.endAmount), type: tx.type, transactionId: tx.id,
    }), `upcoming:${tx.id}`);
    upcomingNotified++;
  }

  // ── 10. Upcoming — payAtEnd ──
  const upcomingPayAtEnd = await prisma.transaction.findMany({
    where: { status: "UNPAID", isInstallment: true, payAtEnd: true, dueDate: { gt: todayEnd, lte: threeDaysEnd } },
    include: { user: true },
  });
  for (const tx of upcomingPayAtEnd) {
    const already = await prisma.notification.findFirst({ where: { transactionId: tx.id, type: "UPCOMING_DUE" } });
    if (already) continue;
    const daysLeft = Math.ceil((tx.dueDate!.getTime() - todayStart.getTime()) / 86400000);
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "UPCOMING_DUE",
        message: `Full payment ${verb} ${tx.counterparty ?? "Unknown"} due in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — ${formatAmt(tx.endAmount)}`, sentAt: new Date() },
    });
    await trySend(() => sendDueDateReminder({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: tx.dueDate!, amount: Number(tx.endAmount), type: tx.type, transactionId: tx.id,
    }), `upcoming-payatend:${tx.id}`);
    upcomingNotified++;
  }

  // ── 11. Upcoming — installments ──
  const upcomingInstallments = await prisma.installment.findMany({
    where: { status: "UNPAID", dueDate: { gt: todayEnd, lte: threeDaysEnd }, transaction: { payAtEnd: false } },
    include: { transaction: { include: { user: true } } },
  });
  for (const inst of upcomingInstallments) {
    const already = await prisma.notification.findFirst({ where: { transactionId: inst.transactionId, type: `UPCOMING_INST_${inst.monthNumber}` } });
    if (already) continue;
    const daysLeft = Math.ceil((inst.dueDate.getTime() - todayStart.getTime()) / 86400000);
    const tx = inst.transaction;
    const verb = tx.type === "LEND" ? "from" : "to";
    await prisma.notification.create({
      data: { userId: tx.userId, transactionId: tx.id, type: "UPCOMING_DUE",
        message: `Installment ${inst.monthNumber}/${tx.installmentMonths} ${verb} ${tx.counterparty ?? "Unknown"} due in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — ${formatAmt(inst.totalAmount)}`, sentAt: new Date() },
    });
    await trySend(() => sendDueDateReminder({
      to: tx.user.email,
      cc: (tx as any).counterpartyEmail ?? undefined,
      name: tx.user.name, counterparty: tx.counterparty ?? "Unknown",
      dueDate: inst.dueDate, amount: Number(inst.totalAmount), type: tx.type, transactionId: tx.id,
    }), `upcoming-inst:${inst.id}`);
    upcomingNotified++;
  }

  return NextResponse.json({
    ok: true,
    markedOverdue,
    overdueNotified,
    dueTodayNotified,
    upcomingNotified,
    emailErrors: errors,
    ranAt: now.toISOString(),
  });
}

function formatAmt(v: any): string {
  return "₱" + Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}