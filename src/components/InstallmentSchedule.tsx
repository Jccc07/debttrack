"use client";
// src/components/InstallmentSchedule.tsx
import { useState } from "react";
import { Installment } from "@/types";
import { formatCurrency, formatDate, getDaysUntilDue } from "@/lib/utils";

interface InstallmentScheduleProps {
  installments: Installment[];
  onTogglePaid: (installmentId: string, currentStatus: string) => Promise<void>;
  readonly?: boolean;
}

export default function InstallmentSchedule({ installments, onTogglePaid, readonly }: InstallmentScheduleProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const paidCount = installments.filter((i) => i.status === "PAID").length;
  const totalCount = installments.length;
  const paidAmount = installments
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const remainingAmount = installments
    .filter((i) => i.status !== "PAID")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);

  async function handleToggle(inst: Installment) {
    if (readonly) return;
    setTogglingId(inst.id);
    await onTogglePaid(inst.id, inst.status);
    setTogglingId(null);
  }

  return (
    <div className="space-y-3">
      {/* Progress summary */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{paidCount} of {totalCount} payments made</span>
        <span>{formatCurrency(remainingAmount)} remaining</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${totalCount > 0 ? (paidCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {/* Installment rows */}
      <div className="space-y-2">
        {installments.map((inst) => {
          const daysLeft = getDaysUntilDue(inst.dueDate);
          const isPaid = inst.status === "PAID";
          const isOverdue = inst.status === "OVERDUE";
          const toggling = togglingId === inst.id;

          return (
            <div
              key={inst.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                isPaid
                  ? "bg-green-50/50 border-green-100"
                  : isOverdue
                  ? "bg-red-50/50 border-red-100"
                  : "bg-gray-50 border-gray-100"
              }`}
            >
              {/* Checkbox */}
              {!readonly && (
                <button
                  onClick={() => handleToggle(inst)}
                  disabled={toggling}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isPaid
                      ? "bg-green-500 border-green-500"
                      : isOverdue
                      ? "border-red-400 hover:border-red-500"
                      : "border-gray-300 hover:border-green-400"
                  }`}
                  title={isPaid ? "Mark as unpaid" : "Mark as paid"}
                >
                  {toggling ? (
                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full spinner inline-block" />
                  ) : isPaid ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : null}
                </button>
              )}

              {/* Month label */}
              <div className="flex-shrink-0 w-16">
                <span className={`text-xs font-semibold ${
                  isPaid ? "text-green-700" : isOverdue ? "text-red-600" : "text-gray-600"
                }`}>
                  Month {inst.monthNumber}
                </span>
              </div>

              {/* Due date */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${isPaid ? "line-through text-gray-400" : "text-gray-700"}`}>
                  {formatDate(inst.dueDate)}
                </p>
                {!isPaid && daysLeft !== null && (
                  <p className={`text-xs ${
                    daysLeft < 0 ? "text-red-500" : daysLeft === 0 ? "text-orange-500" : daysLeft <= 3 ? "text-amber-600" : "text-gray-400"
                  }`}>
                    {daysLeft < 0
                      ? `${Math.abs(daysLeft)}d overdue`
                      : daysLeft === 0
                      ? "Due today"
                      : `${daysLeft}d left`}
                  </p>
                )}
                {isPaid && inst.paidAt && (
                  <p className="text-xs text-green-600">Paid {formatDate(inst.paidAt)}</p>
                )}
              </div>

              {/* Breakdown */}
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-semibold ${isPaid ? "text-gray-400" : "text-gray-900"}`}>
                  {formatCurrency(inst.totalAmount)}
                </p>
                <p className="text-xs text-gray-400">
                  {formatCurrency(inst.principalAmount)} + {formatCurrency(inst.interestAmount)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}