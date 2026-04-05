"use client";
// src/components/TransactionDetailsModal.tsx
import { useState } from "react";
import { Transaction, Installment } from "@/types";
import { formatCurrency, formatDate, getDaysUntilDue, computePenaltyPreview } from "@/lib/utils";
import TransactionForm from "./TransactionForm";
import DeleteConfirmModal from "./DeleteConfirmModal";
import InstallmentSchedule from "./InstallmentSchedule";
import ShareModal from "./ShareModal";

interface Props {
  transaction: Transaction;
  onClose: () => void;
  onUpdated: (tx: Transaction) => void;
  onDeleted: (id: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-green-50 text-green-700",
    UNPAID: "bg-amber-50 text-amber-700",
    OVERDUE: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${map[status] ?? "bg-gray-50 text-gray-600"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function TransactionDetailsModal({ transaction: initialTx, onClose, onUpdated, onDeleted }: Props) {
  const [tx, setTx] = useState<Transaction>(initialTx);
  const [editing, setEditing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const daysLeft = getDaysUntilDue(tx.dueDate);
  const interest = Number(tx.endAmount) - Number(tx.amount);
  const isPayAtEnd = tx.isInstallment && tx.payAtEnd;

  function computeLivePenalty(baseAmount: number, dueDate: Date | string) {
    if (
      !tx.penaltyEnabled ||
      tx.penaltyGraceDays === null || tx.penaltyGraceDays === undefined ||
      !tx.penaltyType || !tx.penaltyAmount || !tx.penaltyFrequency
    ) return null;
    return computePenaltyPreview(
      baseAmount,
      dueDate,
      tx.penaltyGraceDays,
      tx.penaltyType,
      Number(tx.penaltyAmount),
      tx.penaltyFrequency,
      0
    );
  }

  const livePenalty =
    tx.penaltyEnabled && tx.dueDate && tx.status !== "PAID" && (!tx.isInstallment || isPayAtEnd)
      ? computeLivePenalty(Number(tx.endAmount), tx.dueDate)
      : null;

  const penaltyAmount = livePenalty?.amount ?? 0;
  const totalNowDue = Number(tx.endAmount) + penaltyAmount;
  const showTotalDue = tx.status !== "PAID" && penaltyAmount > 0;

  async function refreshTx() {
    const res = await fetch(`/api/transactions/${tx.id}`);
    if (res.ok) {
      const updated = await res.json();
      setTx(updated);
      onUpdated(updated);
    }
  }

  async function togglePaid() {
    if (tx.isInstallment && !tx.payAtEnd) return;
    setMarking(true);
    const newStatus = tx.status === "PAID" ? "UNPAID" : "PAID";
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const updated = await res.json();
    setTx(updated);
    onUpdated(updated);
    setMarking(false);
  }

  async function handleInstallmentToggle(installmentId: string, currentStatus: string) {
    const res = await fetch(`/api/installments/${installmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: currentStatus === "PAID" ? "UNPAID" : "PAID" }),
    });
    if (!res.ok) return;
    await refreshTx();
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    onDeleted(tx.id);
    onClose();
  }

  if (editing) {
    return (
      <TransactionForm
        initial={tx}
        onClose={() => setEditing(false)}
        onSaved={(updated) => { setTx(updated); onUpdated(updated); setEditing(false); }}
      />
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg animate-in max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold ${
                tx.type === "LEND" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
              }`}>
                {tx.type === "LEND" ? "↑" : "↓"}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">{tx.counterparty ?? "Unknown"}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs text-gray-400">
                    {tx.type === "LEND" ? "Lent" : "Borrowed"} · {formatDate(tx.transactionDate)}
                  </p>
                  {tx.isInstallment && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-medium">
                      {tx.installmentMonths}× installment
                    </span>
                  )}
                  {isPayAtEnd && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-xs font-medium">
                      Pay at end
                    </span>
                  )}
                  {tx.penaltyEnabled && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-600 text-xs font-medium">
                      ⚠ Penalty rule on
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={tx.status} />
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors ml-1">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M3 3l9 9M12 3L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

            {/* Amount breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Principal</p>
                <p className="text-base font-semibold text-gray-900">{formatCurrency(tx.amount)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Interest</p>
                <p className="text-base font-semibold text-gray-600">+{formatCurrency(interest)}</p>
                {tx.isInstallment
                  ? <p className="text-xs text-gray-400">{tx.interestRate}%/mo · {tx.installmentMethod === "FLAT" ? "flat" : "reducing"}</p>
                  : <p className="text-xs text-gray-400">{Number(tx.interestRate)}{tx.interestType === "PERCENT" ? "%" : "₱"} {tx.interestType !== "PERCENT" ? "flat" : ""}</p>
                }
              </div>
              <div className={`rounded-xl p-3 ${tx.type === "LEND" ? "bg-blue-50" : "bg-red-50"}`}>
                <p className="text-xs text-gray-400 mb-1">Subtotal</p>
                <p className={`text-base font-bold ${tx.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
                  {formatCurrency(tx.endAmount)}
                </p>
              </div>
            </div>

            {/* Total now due with penalty */}
            {showTotalDue && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Total now due</p>
                    <p className="text-xs text-orange-400 mt-0.5">As of today · includes penalty</p>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">{formatCurrency(totalNowDue)}</p>
                </div>
                <div className="border-t border-orange-100 divide-y divide-orange-100">
                  <div className="px-4 py-2 flex justify-between text-xs text-orange-600">
                    <span>Subtotal (principal + interest)</span>
                    <span className="font-medium">{formatCurrency(tx.endAmount)}</span>
                  </div>
                  <div className="px-4 py-2 text-xs text-orange-600">
                    <div className="flex justify-between">
                      <span className="font-medium">+ Penalty</span>
                      <span className="font-semibold text-orange-700">+{formatCurrency(penaltyAmount)}</span>
                    </div>
                    <p className="text-orange-400 mt-0.5 leading-relaxed">
                      {tx.penaltyType === "PERCENT"
                        ? `${tx.penaltyAmount}% of ₱${Number(tx.endAmount).toFixed(2)}`
                        : `₱${Number(tx.penaltyAmount).toFixed(2)} flat`}
                      {" "}× {livePenalty!.occurrences} {tx.penaltyFrequency?.toLowerCase()} occurrence{livePenalty!.occurrences !== 1 ? "s" : ""}
                      {" "}({livePenalty!.daysOverdue}d overdue, {tx.penaltyGraceDays}d grace period)
                    </p>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between text-sm font-bold text-orange-800 bg-orange-100/50">
                    <span>Total</span>
                    <span>{formatCurrency(totalNowDue)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Penalty rule summary */}
            {tx.penaltyEnabled && (
              <div className="rounded-xl px-4 py-3 border bg-orange-50 border-orange-100">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">Penalty rule active</p>
                <p className="text-xs text-orange-600">
                  After <span className="font-semibold">{tx.penaltyGraceDays} day{tx.penaltyGraceDays !== 1 ? "s" : ""}</span> overdue,
                  charge{" "}
                  <span className="font-semibold">
                    {tx.penaltyType === "PERCENT"
                      ? `${tx.penaltyAmount}% of balance`
                      : `₱${Number(tx.penaltyAmount).toFixed(2)}`}
                  </span>{" "}
                  {tx.penaltyFrequency === "ONCE" ? "(one-time)" : `every ${tx.penaltyFrequency?.toLowerCase()}`}.
                </p>
                {!showTotalDue && tx.status !== "PAID" && (
                  <p className="text-xs text-orange-400 mt-1">
                    {daysLeft !== null && daysLeft > 0
                      ? `Penalty will apply ${tx.penaltyGraceDays} day${tx.penaltyGraceDays !== 1 ? "s" : ""} after the due date.`
                      : daysLeft !== null && daysLeft <= 0
                      ? "Within grace period — penalty not yet active."
                      : ""}
                  </p>
                )}
              </div>
            )}

            {/* Installment schedule OR due date */}
            {tx.isInstallment && tx.installments && tx.installments.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Payment schedule</p>
                <InstallmentSchedule
                  monthsFloat={typeof tx.installmentMonths === "number" ? tx.installmentMonths : undefined}
                  installments={tx.installments}
                  onTogglePaid={handleInstallmentToggle}
                  payAtEnd={tx.payAtEnd}
                  penaltyEnabled={tx.penaltyEnabled}
                  penaltyGraceDays={tx.penaltyGraceDays ?? undefined}
                  penaltyType={tx.penaltyType ?? undefined}
                  penaltyAmount={tx.penaltyAmount !== null ? Number(tx.penaltyAmount) : undefined}
                  penaltyFrequency={tx.penaltyFrequency ?? undefined}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between py-3 border-t border-gray-50">
                <span className="text-sm text-gray-500">Due date</span>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {tx.dueDate ? formatDate(tx.dueDate) : "No due date"}
                  </span>
                  {tx.dueDate && tx.status !== "PAID" && daysLeft !== null && (
                    <span className={`ml-2 text-xs ${daysLeft < 0 ? "text-red-500" : daysLeft <= 3 ? "text-amber-600" : "text-gray-400"}`}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "due today" : `${daysLeft}d left`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {tx.paidAt && (
              <div className="flex items-center justify-between py-3 border-t border-gray-50">
                <span className="text-sm text-gray-500">Fully paid on</span>
                <span className="text-sm font-medium text-green-600">{formatDate(tx.paidAt)}</span>
              </div>
            )}

            {tx.notes && (
              <div className="pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{tx.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-5 pt-3 flex gap-2 border-t border-gray-50 flex-shrink-0">
            {(!tx.isInstallment || tx.payAtEnd) && (
              <button
                onClick={togglePaid}
                disabled={marking}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  tx.status === "PAID"
                    ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {marking
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full spinner" />
                  : tx.status === "PAID"
                  ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
                {tx.status === "PAID" ? "Mark unpaid" : "Mark paid"}
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setShowShare(true)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="3" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4.5 6.2l5-2.5M4.5 7.8l5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Share
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="px-4 py-2.5 rounded-xl border border-red-100 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteConfirmModal
          counterparty={tx.counterparty}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {showShare && (
        <ShareModal
          transaction={tx}
          onClose={() => setShowShare(false)}
          onUpdated={(updated) => { setTx(updated); onUpdated(updated); }}
        />
      )}
    </>
  );
}