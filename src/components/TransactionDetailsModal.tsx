"use client";
// src/components/TransactionDetailsModal.tsx
import { useState } from "react";
import { Transaction, Installment, PenaltyPreview } from "@/types";
import { formatCurrency, formatDate, getDaysUntilDue, computePenaltyPreview } from "@/lib/utils";
import TransactionForm from "./TransactionForm";
import DeleteConfirmModal from "./DeleteConfirmModal";
import InstallmentSchedule from "./InstallmentSchedule";
import PenaltyConfirmModal from "./PenaltyConfirmModal";

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

  // Penalty state
  const [penaltyPreview, setPenaltyPreview] = useState<PenaltyPreview | null>(null);
  const [penaltyInstallmentId, setPenaltyInstallmentId] = useState<string | null>(null);
  const [applyingPenalty, setApplyingPenalty] = useState(false);
  const [removingPenaltyId, setRemovingPenaltyId] = useState<string | null>(null);

  const daysLeft = getDaysUntilDue(tx.dueDate);
  const interest = Number(tx.endAmount) - Number(tx.amount);
  const isPayAtEnd = tx.isInstallment && tx.payAtEnd;

  // Transaction-level penalties (already applied/confirmed)
  const txLevelPenalties = (tx.penalties ?? []).filter((p) => !p.installmentId);
  const totalPenaltiesApplied = txLevelPenalties.reduce((sum, p) => sum + Number(p.amount), 0);
  const grandTotal = Number(tx.endAmount) + totalPenaltiesApplied;

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

  // ── Penalty helpers ──

  function buildPenaltyPreview(
    baseAmount: number,
    dueDate: Date | string,
    alreadyApplied: number
  ): PenaltyPreview | null {
    if (
      !tx.penaltyEnabled ||
      tx.penaltyGraceDays === null ||
      tx.penaltyGraceDays === undefined ||
      !tx.penaltyType ||
      !tx.penaltyAmount ||
      !tx.penaltyFrequency
    ) return null;

    return computePenaltyPreview(
      baseAmount,
      dueDate,
      tx.penaltyGraceDays ?? 0,
      tx.penaltyType,
      Number(tx.penaltyAmount),
      tx.penaltyFrequency,
      alreadyApplied
    );
  }

  function openPenaltyForTransaction() {
    if (!tx.dueDate) return;
    const preview = buildPenaltyPreview(Number(tx.endAmount), tx.dueDate, totalPenaltiesApplied);
    if (!preview) return;
    setPenaltyInstallmentId(null);
    setPenaltyPreview(preview);
  }

  function openPenaltyForInstallment(inst: Installment) {
    const instPenaltiesTotal = (inst.penalties ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const preview = buildPenaltyPreview(Number(inst.totalAmount), inst.dueDate, instPenaltiesTotal);
    if (!preview) return;
    setPenaltyInstallmentId(inst.id);
    setPenaltyPreview(preview);
  }

  async function confirmApplyPenalty() {
    if (!penaltyPreview) return;
    setApplyingPenalty(true);
    await fetch(`/api/transactions/${tx.id}/penalty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: penaltyPreview.amount,
        daysOverdue: penaltyPreview.daysOverdue,
        note: penaltyPreview.note,
        installmentId: penaltyInstallmentId,
      }),
    });
    setPenaltyPreview(null);
    setPenaltyInstallmentId(null);
    setApplyingPenalty(false);
    await refreshTx();
  }

  async function removePenalty(penaltyId: string) {
    setRemovingPenaltyId(penaltyId);
    await fetch(`/api/transactions/${tx.id}/penalty`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ penaltyId }),
    });
    setRemovingPenaltyId(null);
    await refreshTx();
  }

  // Pending (accrued but not yet applied) penalty previews
  const pendingTxPenalty =
    tx.penaltyEnabled && tx.dueDate && tx.status !== "PAID" && !tx.isInstallment
      ? buildPenaltyPreview(Number(tx.endAmount), tx.dueDate, totalPenaltiesApplied)
      : null;

  const pendingPayAtEndPenalty =
    tx.penaltyEnabled && tx.dueDate && tx.status !== "PAID" && isPayAtEnd
      ? buildPenaltyPreview(Number(tx.endAmount), tx.dueDate, totalPenaltiesApplied)
      : null;

  const activePendingPenalty = pendingTxPenalty ?? pendingPayAtEndPenalty ?? null;

  // Can the "Apply penalty" button be shown?
  const canApplyTxPenalty =
    tx.penaltyEnabled && tx.dueDate && tx.status !== "PAID" && !tx.isInstallment && pendingTxPenalty !== null;

  const canApplyPayAtEndPenalty =
    tx.penaltyEnabled && tx.dueDate && tx.status !== "PAID" && isPayAtEnd && pendingPayAtEndPenalty !== null;

  // ── Projected total: subtotal + applied penalties + pending (accrued) penalty ──
  const pendingPenaltyAmount = activePendingPenalty?.amount ?? 0;
  const projectedTotal = grandTotal + pendingPenaltyAmount;
  // Only show the projected total row when there is something extra to show
  const showProjectedTotal = tx.status !== "PAID" && projectedTotal > Number(tx.endAmount);

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

            {/* ── NEW: Amount now due — shown whenever there's penalties applied or accruing ── */}
            {showProjectedTotal && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
                      Amount now due
                    </p>
                    <p className="text-xs text-orange-500 mt-0.5">Subtotal + penalties</p>
                  </div>
                  <p className="text-xl font-bold text-orange-700">{formatCurrency(projectedTotal)}</p>
                </div>

                {/* Breakdown rows */}
                <div className="border-t border-orange-100 divide-y divide-orange-100 text-xs">
                  <div className="px-4 py-2 flex justify-between text-orange-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(tx.endAmount)}</span>
                  </div>

                  {totalPenaltiesApplied > 0 && (
                    <div className="px-4 py-2 flex justify-between text-orange-600">
                      <span>Penalties applied</span>
                      <span className="font-medium">+{formatCurrency(totalPenaltiesApplied)}</span>
                    </div>
                  )}

                  {pendingPenaltyAmount > 0 && (
                    <div className="px-4 py-2 flex justify-between text-orange-600">
                      <span>
                        Accrued penalty
                        <span className="ml-1 text-orange-400">(not yet applied)</span>
                      </span>
                      <span className="font-medium">+{formatCurrency(pendingPenaltyAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Penalty rule info box */}
            {tx.penaltyEnabled && (
              <div className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-100">
                <div className="flex items-start justify-between gap-2">
                  <div>
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
                  </div>
                </div>

                {/* Pending penalty note inside the rule box */}
                {activePendingPenalty && (
                  <div className="mt-2 pt-2 border-t border-orange-100">
                    <p className="text-xs text-orange-700">
                      <span className="font-semibold">Penalty now due:</span>{" "}
                      <span className="font-bold text-orange-800">
                        +{formatCurrency(activePendingPenalty.amount)}
                      </span>
                      {" "}— {activePendingPenalty.note}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Penalties already applied (transaction-level) */}
            {txLevelPenalties.length > 0 && (
              <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                <p className="text-xs font-medium text-orange-700 uppercase tracking-wider mb-2">Penalties applied</p>
                <div className="space-y-1.5">
                  {txLevelPenalties.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-orange-700">+{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-orange-500 leading-snug">{p.note}</p>
                        <p className="text-xs text-orange-400">{formatDate(p.appliedAt)}</p>
                      </div>
                      <button
                        onClick={() => removePenalty(p.id)}
                        disabled={removingPenaltyId === p.id}
                        className="p-1 rounded-lg text-orange-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        title="Remove penalty"
                      >
                        {removingPenaltyId === p.id
                          ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full spinner inline-block" />
                          : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M4.5 3V2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1M5 5v3.5M8 5v3.5M2.5 3l.6 7a.5.5 0 0 0 .5.5h4.8a.5.5 0 0 0 .5-.5l.6-7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apply penalty button */}
            {(canApplyTxPenalty || canApplyPayAtEndPenalty) && (
              <button
                onClick={openPenaltyForTransaction}
                className="w-full py-2 rounded-xl border border-orange-200 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                Apply penalty (+{formatCurrency(activePendingPenalty!.amount)})
              </button>
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
                  onApplyPenalty={tx.penaltyEnabled && !tx.payAtEnd ? openPenaltyForInstallment : undefined}
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

      {penaltyPreview && (
        <PenaltyConfirmModal
          preview={penaltyPreview}
          counterparty={tx.counterparty}
          loading={applyingPenalty}
          onConfirm={confirmApplyPenalty}
          onCancel={() => { setPenaltyPreview(null); setPenaltyInstallmentId(null); }}
        />
      )}
    </>
  );
}