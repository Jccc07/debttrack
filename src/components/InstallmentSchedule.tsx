"use client";
// src/components/InstallmentSchedule.tsx
import { useState } from "react";
import { Installment, PenaltyType, PenaltyFrequency } from "@/types";
import { formatCurrency, formatDate, getDaysUntilDue, fractionLabel, computePenaltyPreview } from "@/lib/utils";

interface InstallmentScheduleProps {
  installments: Installment[];
  onTogglePaid: (installmentId: string, currentStatus: string) => Promise<void>;
  readonly?: boolean;
  payAtEnd?: boolean;
  monthsFloat?: number;
  penaltyEnabled?: boolean;
  penaltyGraceDays?: number;
  penaltyType?: PenaltyType;
  penaltyAmount?: number;
  penaltyFrequency?: PenaltyFrequency;
}

/** Ordinal suffix: 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th" … */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** "1st Payment", "2nd Payment", … or fractional label for the last prorated period */
function periodLabel(index: number, total: number, monthsFloat: number): string {
  const wholeMonths = Math.floor(monthsFloat);
  const fraction    = Math.round((monthsFloat - wholeMonths) * 100) / 100;
  const hasFraction = fraction > 0;
  if (hasFraction && index === total) return fractionLabel(fraction);
  return `${ordinal(index)} Payment`;
}

export default function InstallmentSchedule({
  installments,
  onTogglePaid,
  readonly,
  payAtEnd,
  monthsFloat,
  penaltyEnabled,
  penaltyGraceDays,
  penaltyType,
  penaltyAmount,
  penaltyFrequency,
}: InstallmentScheduleProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const totalCount      = installments.length;
  const paidCount       = installments.filter((i) => i.status === "PAID").length;
  const totalAmount     = installments.reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const remainingAmount = installments
    .filter((i) => i.status !== "PAID")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const resolvedMonths = monthsFloat ?? totalCount;
  const wholeMonths    = Math.floor(resolvedMonths);
  const fraction       = Math.round((resolvedMonths - wholeMonths) * 100) / 100;
  const hasFraction    = fraction > 0;

  async function handleToggle(inst: Installment) {
    if (readonly || payAtEnd) return;
    setTogglingId(inst.id);
    await onTogglePaid(inst.id, inst.status);
    setTogglingId(null);
  }

  function getLivePenalty(inst: Installment) {
    if (
      !penaltyEnabled || inst.status === "PAID" ||
      penaltyGraceDays === undefined || !penaltyType || !penaltyAmount || !penaltyFrequency
    ) return null;
    return computePenaltyPreview(
      Number(inst.totalAmount), inst.dueDate,
      penaltyGraceDays, penaltyType, penaltyAmount, penaltyFrequency, 0
    );
  }

  // ── payAtEnd mode ──
  if (payAtEnd) {
    const lastInstallment = installments[installments.length - 1];
    return (
      <div className="space-y-3">
        <div className="bg-purple-50 rounded-xl px-4 py-3 border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-700 uppercase tracking-wider">Single payment due</p>
              <p className="text-base font-bold text-purple-900 mt-0.5">{formatDate(lastInstallment.dueDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-purple-600">Full amount</p>
              <p className="text-base font-bold text-purple-900">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Breakdown (reference only)
          </p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
              {installments.map((inst, idx) => {
                const label  = periodLabel(idx + 1, totalCount, resolvedMonths);
                const isLast = idx === totalCount - 1;
                const isFrac = isLast && hasFraction;
                return (
                  <div key={inst.id} className={`flex items-center gap-3 px-3 py-2.5 ${isFrac ? "bg-purple-50/40" : ""}`}>
                    <div className="flex-shrink-0 w-28">
                      <span className={`text-xs font-semibold ${isFrac ? "text-purple-600" : "text-gray-500"}`}>
                        {label}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600">{formatDate(inst.dueDate)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${isFrac ? "text-purple-700" : "text-gray-900"}`}>
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
        </div>
      </div>
    );
  }

  // ── Regular installment schedule ──
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

      {/* Rows */}
      <div className="space-y-2">
        {installments.map((inst, idx) => {
          const daysLeft          = getDaysUntilDue(inst.dueDate);
          const isPaid            = inst.status === "PAID";
          const isOverdue         = inst.status === "OVERDUE";
          const toggling          = togglingId === inst.id;
          const isLast            = idx === totalCount - 1;
          const isFrac            = isLast && hasFraction;
          const label             = periodLabel(idx + 1, totalCount, resolvedMonths);
          const livePenalty       = getLivePenalty(inst);
          const livePenaltyAmount = livePenalty?.amount ?? 0;
          const totalWithPenalty  = Number(inst.totalAmount) + livePenaltyAmount;

          return (
            <div
              key={inst.id}
              className={`rounded-xl border transition-colors overflow-hidden ${
                isPaid      ? "bg-green-50/50 border-green-100"
                : isOverdue ? "bg-red-50/50 border-red-100"
                : isFrac    ? "bg-purple-50/30 border-purple-100"
                :             "bg-gray-50 border-gray-100"
              }`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 p-3">
                {/* Checkbox */}
                {!readonly && (
                  <button
                    onClick={() => handleToggle(inst)}
                    disabled={toggling}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isPaid      ? "bg-green-500 border-green-500"
                      : isOverdue ? "border-red-400 hover:border-red-500"
                      :             "border-gray-300 hover:border-green-400"
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

                {/* Label */}
                <div className="flex-shrink-0 w-28">
                  <span className={`text-xs font-semibold ${
                    isPaid      ? "text-green-700"
                    : isOverdue ? "text-red-600"
                    : isFrac    ? "text-purple-600"
                    :             "text-gray-600"
                  }`}>
                    {label}
                  </span>
                  {isFrac && <span className="block text-xs text-purple-400">prorated</span>}
                </div>

                {/* Due date + urgency */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isPaid ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {formatDate(inst.dueDate)}
                  </p>
                  {!isPaid && daysLeft !== null && (
                    <p className={`text-xs ${
                      daysLeft < 0    ? "text-red-500"
                      : daysLeft === 0 ? "text-orange-500"
                      : daysLeft <= 3  ? "text-amber-600"
                      :                  "text-gray-400"
                    }`}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                    </p>
                  )}
                  {isPaid && inst.paidAt && (
                    <p className="text-xs text-green-600">Paid {formatDate(inst.paidAt)}</p>
                  )}
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  {livePenaltyAmount > 0 ? (
                    <>
                      <p className="text-xs text-gray-400 line-through">{formatCurrency(inst.totalAmount)}</p>
                      <p className="text-sm font-bold text-orange-700">{formatCurrency(totalWithPenalty)}</p>
                      <p className="text-xs text-orange-500">+{formatCurrency(livePenaltyAmount)} penalty</p>
                    </>
                  ) : (
                    <>
                      <p className={`text-sm font-semibold ${
                        isPaid ? "text-gray-400" : isFrac ? "text-purple-700" : "text-gray-900"
                      }`}>
                        {formatCurrency(inst.totalAmount)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatCurrency(inst.principalAmount)} + {formatCurrency(inst.interestAmount)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Penalty breakdown sub-row */}
              {livePenaltyAmount > 0 && !isPaid && (
                <div className="border-t border-orange-100 bg-orange-50/60 px-3 py-2 text-xs text-orange-600 flex justify-between items-start gap-2">
                  <span className="leading-relaxed">
                    <span className="font-medium">Penalty:</span>{" "}
                    {penaltyType === "PERCENT"
                      ? `${penaltyAmount}% of ₱${Number(inst.totalAmount).toFixed(2)}`
                      : `₱${Number(penaltyAmount).toFixed(2)} flat`}
                    {" "}× {livePenalty!.occurrences} {penaltyFrequency?.toLowerCase()} occurrence{livePenalty!.occurrences !== 1 ? "s" : ""}
                    {" "}({livePenalty!.daysOverdue}d overdue, {penaltyGraceDays}d grace)
                  </span>
                  <span className="font-semibold text-orange-700 flex-shrink-0">+{formatCurrency(livePenaltyAmount)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}