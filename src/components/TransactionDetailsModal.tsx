"use client";
// src/components/TransactionDetailsModal.tsx
import { useState } from "react";
import { Transaction } from "@/types";
import { formatCurrency, formatDate, getDaysUntilDue } from "@/lib/utils";
import TransactionForm from "./TransactionForm";
import DeleteConfirmModal from "./DeleteConfirmModal";
import InstallmentSchedule from "./InstallmentSchedule";

interface Props {
  transaction: Transaction;
  onClose: () => void;
  onUpdated: (tx: Transaction) => void;
  onDeleted: (id: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-green-50 text-green-700", UNPAID: "bg-amber-50 text-amber-700", OVERDUE: "bg-red-50 text-red-700",
  };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${map[status] ?? "bg-gray-50 text-gray-600"}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export default function TransactionDetailsModal({ transaction: initialTx, onClose, onUpdated, onDeleted }: Props) {
  const [tx, setTx] = useState<Transaction>(initialTx);
  const [editing, setEditing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const daysLeft = getDaysUntilDue(tx.dueDate);
  const interest = Number(tx.endAmount) - Number(tx.amount);

  async function refreshTx() {
    const res = await fetch(`/api/transactions/${tx.id}`);
    if (res.ok) {
      const updated = await res.json();
      setTx(updated);
      onUpdated(updated);
    }
  }

  async function togglePaid() {
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
      <TransactionForm initial={tx} onClose={() => setEditing(false)}
        onSaved={(updated) => { setTx(updated); onUpdated(updated); setEditing(false); }} />
    );
  }

  // payAtEnd installments use a single mark paid/unpaid like regular transactions
  const isPayAtEnd = tx.isInstallment && tx.payAtEnd;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg animate-in max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold ${tx.type === "LEND" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"}`}>
                {tx.type === "LEND" ? "↑" : "↓"}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">{tx.counterparty ?? "Unknown"}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs text-gray-400">{tx.type === "LEND" ? "Lent" : "Borrowed"} · {formatDate(tx.transactionDate)}</p>
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
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={tx.status} />
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors ml-1">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 3l9 9M12 3L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
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
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className={`text-base font-bold ${tx.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>{formatCurrency(tx.endAmount)}</p>
              </div>
            </div>

            {/* Installment schedule OR due date */}
            {tx.isInstallment && tx.installments && tx.installments.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Payment schedule</p>
                <InstallmentSchedule
                  installments={tx.installments}
                  onTogglePaid={handleInstallmentToggle}
                  payAtEnd={tx.payAtEnd}
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
            {/* Show mark paid for non-installment OR payAtEnd installments */}
            {(!tx.isInstallment || isPayAtEnd) && (
              <button onClick={togglePaid} disabled={marking}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  tx.status === "PAID" ? "border border-gray-200 text-gray-600 hover:bg-gray-50" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                {marking
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full spinner" />
                  : tx.status === "PAID"
                  ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                {tx.status === "PAID" ? "Mark unpaid" : "Mark paid"}
              </button>
            )}
            <button onClick={() => setEditing(true)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Edit
            </button>
            <button onClick={() => setShowDelete(true)}
              className="px-4 py-2.5 rounded-xl border border-red-100 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteConfirmModal counterparty={tx.counterparty} loading={deleting}
          onConfirm={handleDelete} onCancel={() => setShowDelete(false)} />
      )}
    </>
  );
}