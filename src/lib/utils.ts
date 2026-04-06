// src/lib/utils.ts
import { InstallmentScheduleRow, PenaltyPreview } from "@/types";

export function computeEndAmount(
  amount: number,
  interestRate: number,
  interestType: "PERCENT" | "FLAT"
): number {
  if (interestType === "FLAT") return amount + interestRate;
  return amount + amount * (interestRate / 100);
}

export function formatCurrency(value: number | string): string {
  const num = Number(value);
  return "₱" + num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "No due date";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(dueDate: Date | string | null | undefined, status: string): boolean {
  if (!dueDate) return false;
  return status !== "PAID" && new Date(dueDate) < new Date();
}

export function getDaysUntilDue(dueDate: Date | string | null | undefined): number | null {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function fractionLabel(fraction: number): string {
  if (fraction === 0) return "";
  if (Math.abs(fraction - 0.5) < 0.001) return "Half month";
  if (Math.abs(fraction - 0.25) < 0.001) return "Quarter month";
  if (Math.abs(fraction - 0.75) < 0.001) return "3/4 month";
  if (Math.abs(fraction - 1 / 3) < 0.01) return "1/3 month";
  if (Math.abs(fraction - 2 / 3) < 0.01) return "2/3 month";
  return `${Math.round(fraction * 100)}% month`;
}

// ─── Standard monthly installments ───────────────────────────────────────────
export function computeInstallments(
  principal: number,
  monthlyRate: number,
  months: number,
  method: "FLAT" | "REDUCING",
  startDate: Date,
  intervalDays: number = 30
): InstallmentScheduleRow[] {
  const schedule: InstallmentScheduleRow[] = [];
  const rate = monthlyRate / 100;

  const wholeMonths       = Math.floor(months);
  const fraction          = round2(months - wholeMonths);
  const totalPeriods      = wholeMonths + (fraction > 0 ? 1 : 0);
  const principalPerMonth = round2(principal / months);
  const useDayInterval    = intervalDays !== 30;

  if (method === "FLAT") {
    const totalInterest    = round2(principal * rate * months);
    const interestPerMonth = round2(totalInterest / months);
    let remaining = principal;

    for (let i = 1; i <= totalPeriods; i++) {
      const isFractional    = i === totalPeriods && fraction > 0;
      const multiplier      = isFractional ? fraction : 1;
      const periodPrincipal = round2(principalPerMonth * multiplier);
      const periodInterest  = round2(interestPerMonth * multiplier);
      const periodTotal     = round2(periodPrincipal + periodInterest);
      remaining = round2(remaining - periodPrincipal);
      schedule.push({
        monthNumber: i,
        dueDate: useDayInterval
          ? dayBasedDueDate(startDate, i, intervalDays)
          : periodDueDate(startDate, wholeMonths, i, fraction),
        principalAmount: periodPrincipal,
        interestAmount: periodInterest,
        totalAmount: periodTotal,
        remainingBalance: Math.max(0, remaining),
      });
    }
  } else {
    let remaining = principal;
    for (let i = 1; i <= totalPeriods; i++) {
      const isFractional    = i === totalPeriods && fraction > 0;
      const multiplier      = isFractional ? fraction : 1;
      const periodPrincipal = round2(principalPerMonth * multiplier);
      const periodInterest  = round2(remaining * rate * multiplier);
      const periodTotal     = round2(periodPrincipal + periodInterest);
      remaining = round2(remaining - periodPrincipal);
      schedule.push({
        monthNumber: i,
        dueDate: useDayInterval
          ? dayBasedDueDate(startDate, i, intervalDays)
          : periodDueDate(startDate, wholeMonths, i, fraction),
        principalAmount: periodPrincipal,
        interestAmount: periodInterest,
        totalAmount: periodTotal,
        remainingBalance: Math.max(0, remaining),
      });
    }
  }

  return schedule;
}

// ─── Bi-monthly installments (two cutoffs per month) ─────────────────────────
// Each monthly payment is split in half.
// day1 = first cutoff (e.g. 15), day2 = second cutoff (e.g. 30).
// For months x full months: generates 2x payments.
// Interest is charged per half-month period (monthlyRate / 2).
export function computeInstallmentsBiMonthly(
  principal: number,
  monthlyRate: number,
  months: number,
  method: "FLAT" | "REDUCING",
  startDate: Date,
  day1: number,  // e.g. 15
  day2: number   // e.g. 30
): InstallmentScheduleRow[] {
  // First build the monthly schedule, then split each period into two halves
  const monthly = computeInstallments(principal, monthlyRate, months, method, startDate);
  const schedule: InstallmentScheduleRow[] = [];
  let periodIndex = 0;

  for (const row of monthly) {
    // Each monthly row spawns two half-payments
    const halfPrincipal = round2(row.principalAmount / 2);
    const halfInterest  = round2(row.interestAmount / 2);
    const halfTotal     = round2(halfPrincipal + halfInterest);

    // Due dates: figure out which calendar month this period falls in
    const baseMonth = new Date(row.dueDate);
    const year  = baseMonth.getFullYear();
    const month = baseMonth.getMonth(); // 0-indexed

    // First half: day1 of that month
    const date1 = new Date(year, month, Math.min(day1, daysInMonth(year, month)));
    // Second half: day2 of that month (cap to last day of month)
    const date2 = new Date(year, month, Math.min(day2, daysInMonth(year, month)));

    // If startDate is after date1, push date1 forward to next occurrence
    const adjustedDate1 = date1 <= startDate
      ? new Date(year, month + 1, Math.min(day1, daysInMonth(year, month + 1)))
      : date1;

    const adjustedDate2 = date2 <= startDate
      ? new Date(year, month + 1, Math.min(day2, daysInMonth(year, month + 1)))
      : date2;

    periodIndex++;
    schedule.push({
      monthNumber: periodIndex,
      dueDate: adjustedDate1,
      principalAmount: halfPrincipal,
      interestAmount: halfInterest,
      totalAmount: halfTotal,
      remainingBalance: round2(row.remainingBalance + halfPrincipal), // still owe second half
    });

    periodIndex++;
    schedule.push({
      monthNumber: periodIndex,
      dueDate: adjustedDate2,
      principalAmount: halfPrincipal,
      interestAmount: halfInterest,
      totalAmount: halfTotal,
      remainingBalance: row.remainingBalance,
    });
  }

  return schedule;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function dayBasedDueDate(startDate: Date, periodIndex: number, intervalDays: number): Date {
  const d = new Date(startDate);
  d.setDate(d.getDate() + periodIndex * intervalDays);
  return d;
}

function periodDueDate(startDate: Date, wholeMonths: number, periodIndex: number, fraction: number): Date {
  const isFractionalPeriod = fraction > 0 && periodIndex > wholeMonths;
  if (!isFractionalPeriod) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + periodIndex);
    return d;
  } else {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + wholeMonths);
    d.setDate(d.getDate() + Math.round(fraction * 30));
    return d;
  }
}

export function computeInstallmentTotal(
  principal: number,
  monthlyRate: number,
  months: number,
  method: "FLAT" | "REDUCING"
): number {
  const schedule = computeInstallments(principal, monthlyRate, months, method, new Date());
  return round2(schedule.reduce((sum, row) => sum + row.totalAmount, 0));
}

export function computePenaltyPreview(
  baseAmount: number,
  dueDate: Date | string,
  graceDays: number,
  penaltyType: "PERCENT" | "FLAT",
  penaltyAmount: number,
  frequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY",
  alreadyApplied: number = 0,
  referenceDate: Date = new Date()
): PenaltyPreview | null {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
  if (daysOverdue <= 0) return null;

  const daysAfterGrace = daysOverdue - graceDays;
  if (daysAfterGrace <= 0) return null;

  let occurrences: number;
  if (frequency === "ONCE") {
    occurrences = 1;
  } else if (frequency === "DAILY") {
    occurrences = daysAfterGrace;
  } else if (frequency === "WEEKLY") {
    occurrences = Math.max(1, Math.floor(daysAfterGrace / 7));
  } else {
    occurrences = Math.max(1, Math.floor(daysAfterGrace / 30));
  }

  const perOccurrence = penaltyType === "PERCENT"
    ? round2(baseAmount * (penaltyAmount / 100))
    : round2(penaltyAmount);

  const grossPenalty = round2(perOccurrence * occurrences);
  const newPenalty   = round2(Math.max(0, grossPenalty - alreadyApplied));

  if (newPenalty <= 0) return null;

  const freqLabel: Record<string, string> = {
    ONCE: "one-time", DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly",
  };

  const note = penaltyType === "PERCENT"
    ? `${penaltyAmount}% ${freqLabel[frequency]} penalty × ${occurrences} occurrence${occurrences > 1 ? "s" : ""} (${daysOverdue}d overdue, ${graceDays}d grace)`
    : `₱${penaltyAmount} ${freqLabel[frequency]} penalty × ${occurrences} occurrence${occurrences > 1 ? "s" : ""} (${daysOverdue}d overdue, ${graceDays}d grace)`;

  return { amount: newPenalty, occurrences, daysOverdue, daysAfterGrace, note };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}