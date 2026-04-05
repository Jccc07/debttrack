// src/types/index.ts

export type TransactionType = "LEND" | "OWE";
export type TransactionStatus = "UNPAID" | "PAID" | "OVERDUE";
export type InterestType = "PERCENT" | "FLAT";
export type InstallmentMethod = "FLAT" | "REDUCING";

export interface Installment {
  id: string;
  transactionId: string;
  monthNumber: number;
  dueDate: string | Date;
  principalAmount: number | string;
  interestAmount: number | string;
  totalAmount: number | string;
  status: TransactionStatus;
  paidAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number | string;
  interestRate: number | string;
  interestType: InterestType;
  endAmount: number | string;
  counterparty: string | null;
  notes: string | null;
  transactionDate: string | Date;
  dueDate: string | Date | null;
  status: TransactionStatus;
  paidAt: string | Date | null;
  isInstallment: boolean;
  installmentMonths: number | null;
  installmentMethod: InstallmentMethod | null;
  installmentIntervalDays: number | null;
  payAtEnd: boolean;
  installments?: Installment[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Notification {
  id: string;
  userId: string;
  transactionId: string | null;
  type: string;
  message: string;
  isRead: boolean;
  sentAt: string | Date | null;
  createdAt: string | Date;
}

export interface TransactionFilters {
  type?: TransactionType | "";
  status?: TransactionStatus | "";
  search?: string;
  from?: string;
  to?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface InstallmentScheduleRow {
  monthNumber: number;
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  remainingBalance: number;
}

// Interval preset definition
export interface IntervalOption {
  label: string;        // display name: "Every 2 weeks"
  shortLabel: string;   // used in schedule rows: "Period", "Week", etc.
  days: number;         // interval in days
  rateLabel: string;    // label for interest rate field: "Biweekly rate (%)"
}

export const INTERVAL_OPTIONS: IntervalOption[] = [
  { label: "Every 2 weeks",      shortLabel: "Period", days: 14, rateLabel: "Biweekly rate (%)" },
  { label: "Every half month",   shortLabel: "Period", days: 15, rateLabel: "Semi-monthly rate (%)" },
  { label: "Every month",        shortLabel: "Month",  days: 30, rateLabel: "Monthly rate (%)" },
  { label: "Every 6 weeks",      shortLabel: "Period", days: 45, rateLabel: "6-week rate (%)" },
  { label: "Every 2 months",     shortLabel: "Period", days: 60, rateLabel: "Bi-monthly rate (%)" },
];