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
 * Returns a human-readable label for the fractional part of a month count.
 * e.g. 0.5 → "Half month", 0.25 → "Quarter month"
 */
export function fractionLabel(fraction: number): string {
  if (fraction === 0) return "";
  if (Math.abs(fraction - 0.5) < 0.001) return "Half month";
  if (Math.abs(fraction - 0.25) < 0.001) return "Quarter month";
  if (Math.abs(fraction - 0.75) < 0.001) return "3/4 month";
  if (Math.abs(fraction - 1 / 3) < 0.01) return "1/3 month";
  if (Math.abs(fraction - 2 / 3) < 0.01) return "2/3 month";
  return `${Math.round(fraction * 100)}% month`;
}

/**
 * Compute installment schedule supporting fractional month counts.
 *
 * e.g. months=2.5 produces:
 *   Period 1 — full month payment, due start+1mo
 *   Period 2 — full month payment, due start+2mo
 *   Period 3 — prorated (×0.5) payment, due start+2mo+15days
 *
 * @param principal   - loan amount
 * @param monthlyRate - interest rate per FULL month (as %, e.g. 2.4 = 2.4%)
 * @param months      - total duration in months, can be fractional (e.g. 1.5, 2.5)
 * @param method      - "FLAT" | "REDUCING"
 * @param startDate   - transaction date; first payment due 1 month after
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

  // Split into whole months + fractional remainder
  const wholeMonths = Math.floor(months);
  const fraction    = round2(months - wholeMonths); // e.g. 0.5 for 2.5
  const totalPeriods = wholeMonths + (fraction > 0 ? 1 : 0);

  // Principal per full month = principal / total months (not total periods)
  const principalPerMonth = round2(principal / months);

  if (method === "FLAT") {
    // Total interest = principal × rate × months (fractional months reduce interest proportionally)
    const totalInterest     = round2(principal * rate * months);
    const interestPerMonth  = round2(totalInterest / months); // per full month

    let remaining = principal;

    for (let i = 1; i <= totalPeriods; i++) {
      const isFractional = i === totalPeriods && fraction > 0;
      const multiplier   = isFractional ? fraction : 1;

      const periodPrincipal = round2(principalPerMonth * multiplier);
      const periodInterest  = round2(interestPerMonth  * multiplier);
      const periodTotal     = round2(periodPrincipal + periodInterest);

      remaining = round2(remaining - periodPrincipal);

      schedule.push({
        monthNumber: i,
        dueDate: periodDueDate(startDate, wholeMonths, i, fraction),
        principalAmount: periodPrincipal,
        interestAmount: periodInterest,
        totalAmount: periodTotal,
        remainingBalance: Math.max(0, remaining),
      });
    }
  } else {
    // Reducing balance — interest = remaining balance × rate × period_fraction
    let remaining = principal;

    for (let i = 1; i <= totalPeriods; i++) {
      const isFractional = i === totalPeriods && fraction > 0;
      const multiplier   = isFractional ? fraction : 1;

      const periodPrincipal = round2(principalPerMonth * multiplier);
      const periodInterest  = round2(remaining * rate * multiplier);
      const periodTotal     = round2(periodPrincipal + periodInterest);

      remaining = round2(remaining - periodPrincipal);

      schedule.push({
        monthNumber: i,
        dueDate: periodDueDate(startDate, wholeMonths, i, fraction),
        principalAmount: periodPrincipal,
        interestAmount: periodInterest,
        totalAmount: periodTotal,
        remainingBalance: Math.max(0, remaining),
      });
    }
  }

  return schedule;
}

/**
 * Calculate the due date for period i.
 * Whole-month periods: start + i months (calendar month arithmetic).
 * Fractional final period: start + wholeMonths months + fraction×30 days.
 */
function periodDueDate(startDate: Date, wholeMonths: number, periodIndex: number, fraction: number): Date {
  const isFractionalPeriod = fraction > 0 && periodIndex > wholeMonths;

  if (!isFractionalPeriod) {
    // Regular calendar month addition
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + periodIndex);
    return d;
  } else {
    // After all whole months, add fractional days (fraction × 30)
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}