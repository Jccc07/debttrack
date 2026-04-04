// src/lib/utils.ts
import { InstallmentScheduleRow } from "@/types";

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

/**
 * Compute installment schedule.
 * @param principal  - loan amount
 * @param monthlyRate - interest rate per month (as percentage, e.g. 2.4 means 2.4%)
 * @param months     - number of installments
 * @param method     - "FLAT" (equal payments) | "REDUCING" (reducing balance)
 * @param startDate  - transaction date; first payment due 1 month after this
 */
export function computeInstallments(
  principal: number,
  monthlyRate: number,
  months: number,
  method: "FLAT" | "REDUCING",
  startDate: Date
): InstallmentScheduleRow[] {
  const schedule: InstallmentScheduleRow[] = [];
  const rate = monthlyRate / 100;

  if (method === "FLAT") {
    // Total interest on full principal for all months, split equally
    const totalInterest = principal * rate * months;
    const monthlyInterest = round2(totalInterest / months);
    const monthlyPrincipal = round2(principal / months);
    const monthlyTotal = round2(monthlyPrincipal + monthlyInterest);

    let remaining = principal;
    for (let i = 1; i <= months; i++) {
      remaining = round2(remaining - monthlyPrincipal);
      const due = addMonths(startDate, i);
      schedule.push({
        monthNumber: i,
        dueDate: due,
        principalAmount: monthlyPrincipal,
        interestAmount: monthlyInterest,
        totalAmount: monthlyTotal,
        remainingBalance: Math.max(0, remaining),
      });
    }
  } else {
    // Reducing balance — interest on remaining balance each month
    const monthlyPrincipal = round2(principal / months);
    let remaining = principal;

    for (let i = 1; i <= months; i++) {
      const interestThisMonth = round2(remaining * rate);
      const totalThisMonth = round2(monthlyPrincipal + interestThisMonth);
      remaining = round2(remaining - monthlyPrincipal);
      const due = addMonths(startDate, i);
      schedule.push({
        monthNumber: i,
        dueDate: due,
        principalAmount: monthlyPrincipal,
        interestAmount: interestThisMonth,
        totalAmount: totalThisMonth,
        remainingBalance: Math.max(0, remaining),
      });
    }
  }

  return schedule;
}

export function computeInstallmentTotal(
  principal: number,
  monthlyRate: number,
  months: number,
  method: "FLAT" | "REDUCING"
): number {
  const dummyDate = new Date();
  const schedule = computeInstallments(principal, monthlyRate, months, method, dummyDate);
  return round2(schedule.reduce((sum, row) => sum + row.totalAmount, 0));
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}