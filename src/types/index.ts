// src/types/index.ts
export type TransactionType = "LEND" | "OWE";
export type TransactionStatus = "UNPAID" | "PAID" | "OVERDUE";
export type InterestType = "PERCENT" | "FLAT";
export type InstallmentMethod = "FLAT" | "REDUCING";
export type PenaltyType = "PERCENT" | "FLAT";
export type PenaltyFrequency = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";

export interface Penalty {
  id: string;
  transactionId: string;
  installmentId: string | null;
  amount: number | string;
  daysOverdue: number;
  note: string;
  appliedAt: string | Date;
}

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
  penalties?: Penalty[];
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
  counterpartyEmail: string | null;  // ← NEW
  notes: string | null;
  transactionDate: string | Date;
  dueDate: string | Date | null;
  status: TransactionStatus;
  paidAt: string | Date | null;
  // Installment
  isInstallment: boolean;
  installmentMonths: number | null;
  installmentMethod: InstallmentMethod | null;
  installmentIntervalDays: number | null;
  payAtEnd: boolean;
  installments?: Installment[];
  // Penalty rule
  penaltyEnabled: boolean;
  penaltyGraceDays: number | null;
  penaltyType: PenaltyType | null;
  penaltyAmount: number | string | null;
  penaltyFrequency: PenaltyFrequency | null;
  penalties?: Penalty[];
  // Share
  shareToken: string | null;
  shareExpiresAt: string | Date | null;
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

export interface PenaltyPreview {
  amount: number;
  occurrences: number;
  daysOverdue: number;
  daysAfterGrace: number;
  note: string;
}