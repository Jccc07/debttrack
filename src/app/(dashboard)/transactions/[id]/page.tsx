"use client";
// src/app/(dashboard)/transactions/[id]/page.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Transaction } from "@/types";
import { formatCurrency, formatDate, getDaysUntilDue } from "@/lib/utils";
import TransactionForm from "@/components/TransactionForm";
import Link from "next/link";

export default function TransactionDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const router = useRouter();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetch(`/api/transactions/${params.id}`)
      .then((r) => { if (!r.ok) router.push("/transactions"); return r.json(); })
      .then(setTx)
      .finally(() => setLoading(false));
  }, [params.id, router]);

  async function markPaid() {
    if (!tx) return;
    setMarking(true);
    const newStatus = tx.status === "PAID" ? "UNPAID" : "PAID";
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const updated = await res.json();
    setTx(updated);
    setMarking(false);
  }

  async function deleteTransaction() {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    await fetch(`/api/transactions/${params.id}`, { method: "DELETE" });
    router.push("/transactions");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" />
      </div>
    );
  }

  if (!tx) return null;

  const daysLeft = getDaysUntilDue(tx.dueDate);
  const interest = Number(tx.endAmount) - Number(tx.amount);

  return (
    <div className="max-w-2xl space-y-6 animate-in">
      <Link href="/transactions" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Transactions
      </Link>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold ${
              tx.type === "LEND" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
            }`}>
              {tx.type === "LEND" ? "↑" : "↓"}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{tx.counterparty ?? "Unknown"}</h1>
              <p className="text-sm text-gray-400">
                {tx.type === "LEND" ? "You lent money" : "You owe money"} · {formatDate(tx.transactionDate)}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            tx.status === "PAID" ? "bg-green-50 text-green-700" :
            tx.status === "OVERDUE" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
          }`}>
            {tx.status.charAt(0) + tx.status.slice(1).toLowerCase()}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Principal</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(tx.amount)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Interest</p>
            <p className="text-lg font-semibold text-gray-600">
              +{formatCurrency(interest)}
              <span className="text-xs font-normal text-gray-400 ml-1">
                ({Number(tx.interestRate)}{tx.interestType === "PERCENT" ? "%" : "$"})
              </span>
            </p>
          </div>
          <div className={`rounded-xl p-4 ${tx.type === "LEND" ? "bg-blue-50" : "bg-red-50"}`}>
            <p className="text-xs text-gray-400 mb-1">Total</p>
            <p className={`text-lg font-bold ${tx.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
              {formatCurrency(tx.endAmount)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-gray-50">
          <span className="text-sm text-gray-500">Due date</span>
          <div className="text-right">
            <span className="text-sm font-medium text-gray-900">{formatDate(tx.dueDate)}</span>
            {tx.status !== "PAID" && (
              <span className={`ml-2 text-xs ${
                daysLeft < 0 ? "text-red-500" : daysLeft <= 3 ? "text-amber-600" : "text-gray-400"
              }`}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : daysLeft === 0 ? "Due today" : `${daysLeft} days left`}
              </span>
            )}
          </div>
        </div>
        {tx.paidAt && (
          <div className="flex items-center justify-between py-3 border-t border-gray-50">
            <span className="text-sm text-gray-500">Paid on</span>
            <span className="text-sm font-medium text-green-600">{formatDate(tx.paidAt)}</span>
          </div>
        )}
        {tx.notes && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{tx.notes}</p>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={markPaid}
          disabled={marking}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            tx.status === "PAID"
              ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {marking && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full spinner" />}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {tx.status === "PAID" ? "Mark as unpaid" : "Mark as paid"}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={deleteTransaction}
          className="px-4 py-2.5 rounded-xl border border-red-100 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      </div>
      {editing && (
        <TransactionForm
          initial={tx}
          onClose={() => setEditing(false)}
          onSaved={(updated) => setTx(updated)}
        />
      )}
    </div>
  );
}
