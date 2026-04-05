"use client";
// src/components/TransactionDetailsModal.tsx
import { useState } from "react";
import { Transaction } from "@/types";
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
  const [showShare, setShowShare] = useState(false); // ✅ restored

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

  // ✅ per-occurrence computation
  const penaltyPerOccurrence =
    tx.penaltyEnabled && tx.penaltyAmount
      ? tx.penaltyType === "PERCENT"
        ? Number(tx.endAmount) * Number(tx.penaltyAmount) / 100
        : Number(tx.penaltyAmount)
      : null;

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
        onSaved={(updated) => {
          setTx(updated);
          onUpdated(updated);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg animate-in max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-base font-semibold text-gray-900">{tx.counterparty ?? "Unknown"}</p>
              <p className="text-xs text-gray-400">
                {tx.type === "LEND" ? "Lent" : "Borrowed"} · {formatDate(tx.transactionDate)}
              </p>
            </div>
            <StatusBadge status={tx.status} />
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

            {/* Amount */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-400">Principal</p>
                <p className="font-semibold">{formatCurrency(tx.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Interest</p>
                <p>+{formatCurrency(interest)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Subtotal</p>
                <p className="font-bold">{formatCurrency(tx.endAmount)}</p>
              </div>
            </div>

            {/* Total with penalty */}
            {showTotalDue && (
              <div className="bg-orange-50 p-3 rounded-xl border text-sm">
                <p className="font-semibold">Total now due: {formatCurrency(totalNowDue)}</p>
                <p className="text-xs text-gray-500">
                  Includes penalty of {formatCurrency(penaltyAmount)}
                </p>
              </div>
            )}

            {/* ✅ Enhanced penalty rule */}
            {tx.penaltyEnabled && (
              <div className="bg-orange-50 p-3 rounded-xl border text-xs">
                <p className="font-semibold">Rule summary</p>
                <p>
                  After {tx.penaltyGraceDays} days overdue, charge{" "}
                  {tx.penaltyType === "PERCENT"
                    ? `${tx.penaltyAmount}% = ${formatCurrency(penaltyPerOccurrence!)}`
                    : formatCurrency(Number(tx.penaltyAmount))}
                  {" "} {tx.penaltyFrequency}
                </p>
              </div>
            )}

            {/* Schedule */}
            {tx.isInstallment && tx.installments && (
              <InstallmentSchedule
                installments={tx.installments}
                onTogglePaid={handleInstallmentToggle}
                payAtEnd={tx.payAtEnd}
              />
            )}

          </div>

          {/* Actions */}
          <div className="px-6 py-3 flex gap-2 border-t">
            <button onClick={() => setEditing(true)} className="flex-1 border rounded-xl py-2">
              Edit
            </button>

            {/* ✅ restored Share button */}
            <button
              onClick={() => setShowShare(true)}
              className="px-4 py-2 border rounded-xl"
            >
              Share
            </button>

            <button onClick={() => setShowDelete(true)} className="px-4 py-2 border text-red-500 rounded-xl">
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete */}
      {showDelete && (
        <DeleteConfirmModal
          counterparty={tx.counterparty}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {/* ✅ restored ShareModal */}
      {showShare && (
        <ShareModal
          transaction={tx}
          onClose={() => setShowShare(false)}
          onUpdated={(updated) => {
            setTx(updated);
            onUpdated(updated);
          }}
        />
      )}
    </>
  );
}