// src/types/index.ts

export type TransactionType = "LEND" | "OWE";
export type TransactionStatus = "UNPAID" | "PAID" | "OVERDUE";
export type InterestType = "PERCENT" | "FLAT";

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
  dueDate: string | Date;
  status: TransactionStatus;
  paidAt: string | Date | null;
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

export interface DashboardStats {
  totalLent: number;
  totalOwed: number;
  totalExpectedReturn: number;
  overdueCount: number;
  recentTransactions: Transaction[];
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