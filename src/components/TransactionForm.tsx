"use client";
// src/components/TransactionForm.tsx
import { useState } from "react";
import { Transaction, TransactionType, InterestType } from "@/types";
import { computeEndAmount, formatCurrency } from "@/lib/utils";

interface TransactionFormProps {
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
  initial?: Partial<Transaction>;
}

const today = new Date().toISOString().split("T")[0];

export default function TransactionForm({ onClose, onSaved, initial }: TransactionFormProps) {
  const isEdit = !!initial?.id;

  const [form, setForm] = useState({
    type: (initial?.type ?? "LEND") as TransactionType,
    amount: String(initial?.amount ?? ""),
    interestRate: String(initial?.interestRate ?? "0"),
    interestType: (initial?.interestType ?? "PERCENT") as InterestType,
    counterparty: initial?.counterparty ?? "",
    notes: initial?.notes ?? "",
    transactionDate: initial?.transactionDate
      ? new Date(initial.transactionDate).toISOString().split("T")[0]
      : today,
    dueDate: initial?.dueDate
      ? new Date(initial.dueDate).toISOString().split("T")[0]
      : today,
    noDueDate: !initial?.dueDate && !!initial?.id, // if editing and dueDate is null
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const previewEnd = form.amount
    ? computeEndAmount(Number(form.amount), Number(form.interestRate), form.interestType)
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isEdit ? `/api/transactions/${initial!.id}` : "/api/transactions";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        amount: Number(form.amount),
        interestRate: Number(form.interestRate),
        interestType: form.interestType,
        counterparty: form.counterparty || null,
        notes: form.notes || null,
        transactionDate: form.transactionDate,
        dueDate: form.noDueDate ? null : form.dueDate,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Something went wrong");
      return;
    }

    const tx = await res.json();
    onSaved(tx);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-md animate-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? "Edit transaction" : "Add transaction"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "LEND" })}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  form.type === "LEND"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                ↑ Lent
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "OWE" })}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  form.type === "OWE"
                    ? "bg-red-500 border-red-500 text-white"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                ↓ Borrowed
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Amount (₱)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₱</span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Interest */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Interest
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Type
              </label>
              <select
                value={form.interestType}
                onChange={(e) => setForm({ ...form, interestType: e.target.value as InterestType })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition bg-white"
              >
                <option value="PERCENT">% Percent</option>
                <option value="FLAT">₱ Flat fee</option>
              </select>
            </div>
          </div>

          {/* End amount preview */}
          {form.amount && (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs text-gray-500">Total to repay</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(previewEnd)}</span>
            </div>
          )}

          {/* Counterparty */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Person / Company
            </label>
            <input
              type="text"
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="e.g. Maria, John, BPI Bank"
            />
          </div>

          {/* Transaction date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Transaction date
            </label>
            <input
              type="date"
              required
              value={form.transactionDate}
              onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>

          {/* Due date */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due date
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.noDueDate}
                  onChange={(e) => setForm({ ...form, noDueDate: e.target.checked })}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-gray-500">No due date</span>
              </label>
            </div>
            {!form.noDueDate && (
              <input
                type="date"
                required={!form.noDueDate}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
            )}
            {form.noDueDate && (
              <div className="px-3 py-2.5 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                No due date set
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Notes <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
              placeholder="Any extra details..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />
              )}
              {isEdit ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}