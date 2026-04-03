// src/lib/utils.ts

export function computeEndAmount(
  amount: number,
  interestRate: number,
  interestType: "PERCENT" | "FLAT"
): number {
  if (interestType === "FLAT") return amount + interestRate;
  return amount + amount * (interestRate / 100);
}

export function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(dueDate: Date | string, status: string): boolean {
  return status !== "PAID" && new Date(dueDate) < new Date();
}

export function getDaysUntilDue(dueDate: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}