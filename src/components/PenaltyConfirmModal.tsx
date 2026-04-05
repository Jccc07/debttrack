"use client";
// src/components/PenaltyConfirmModal.tsx
import { PenaltyPreview } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface PenaltyConfirmModalProps {
  preview: PenaltyPreview;
  counterparty: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const FREQ_LABEL: Record<string, string> = {
  ONCE: "One-time", DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly",
};

export default function PenaltyConfirmModal({
  preview,
  counterparty,
  onConfirm,
  onCancel,
  loading,
}: PenaltyConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-sm animate-in p-6">
        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3v6M9 12.5v.5" stroke="#ea580c" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="9" cy="9" r="7.5" stroke="#ea580c" strokeWidth="1.3"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Apply penalty</h3>
            <p className="text-sm text-gray-500">
              {counterparty ? `For ${counterparty}` : "Confirm penalty"}
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-orange-50 rounded-xl p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-orange-700 font-medium uppercase tracking-wider">Penalty amount</span>
            <span className="text-xl font-bold text-orange-700">{formatCurrency(preview.amount)}</span>
          </div>
          <div className="border-t border-orange-100 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-orange-600">
              <span>Days overdue</span>
              <span className="font-medium">{preview.daysOverdue} days</span>
            </div>
            <div className="flex justify-between text-xs text-orange-600">
              <span>After grace period</span>
              <span className="font-medium">{preview.daysAfterGrace} days</span>
            </div>
            <div className="flex justify-between text-xs text-orange-600">
              <span>Occurrences</span>
              <span className="font-medium">{preview.occurrences}</span>
            </div>
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-gray-400 mb-5 leading-relaxed">{preview.note}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />}
            Apply penalty
          </button>
        </div>
      </div>
    </div>
  );
}