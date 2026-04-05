"use client";
// src/components/TransactionForm.tsx
import { useState, useMemo } from "react";
import { Transaction, TransactionType, InterestType, InstallmentMethod } from "@/types";
import { computeEndAmount, computeInstallments, formatCurrency } from "@/lib/utils";

interface TransactionFormProps {
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
  initial?: Partial<Transaction>;
}

const today = new Date().toISOString().split("T")[0];

export default function TransactionForm({ onClose, onSaved, initial }: TransactionFormProps) {
  const isEdit = !!initial?.id;
  const isExistingInstallment = initial?.isInstallment === true;

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
    noDueDate: !initial?.dueDate && !!initial?.id && !initial?.isInstallment,
    isInstallment: initial?.isInstallment ?? false,
    installmentMonths: String(initial?.installmentMonths ?? "3"),
    installmentMethod: (initial?.installmentMethod ?? "FLAT") as InstallmentMethod,
    payAtEnd: initial?.payAtEnd ?? false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);

  const installmentSchedule = useMemo(() => {
    if (!form.isInstallment || !form.amount || !form.installmentMonths) return [];
    const months = parseInt(form.installmentMonths);
    if (isNaN(months) || months < 1) return [];
    return computeInstallments(
      Number(form.amount),
      Number(form.interestRate),
      months,
      form.installmentMethod,
      new Date(form.transactionDate)
    );
  }, [form.isInstallment, form.amount, form.interestRate, form.installmentMonths, form.installmentMethod, form.transactionDate]);

  const installmentTotal = installmentSchedule.reduce((s, r) => s + r.totalAmount, 0);
  const simpleTotal = form.amount
    ? computeEndAmount(Number(form.amount), Number(form.interestRate), form.interestType)
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isEdit ? `/api/transactions/${initial!.id}` : "/api/transactions";
    const method = isEdit ? "PATCH" : "POST";

    const payload: Record<string, unknown> = {
      type: form.type,
      amount: Number(form.amount),
      interestRate: Number(form.interestRate),
      interestType: form.interestType,
      counterparty: form.counterparty || null,
      notes: form.notes || null,
      transactionDate: form.transactionDate,
    };

    if (!isEdit) {
      payload.isInstallment = form.isInstallment;
      if (form.isInstallment) {
        payload.installmentMonths = parseInt(form.installmentMonths);
        payload.installmentMethod = form.installmentMethod;
        payload.payAtEnd = form.payAtEnd;
      } else {
        payload.dueDate = form.noDueDate ? null : form.dueDate;
      }
    } else {
      if (isExistingInstallment) {
        payload.installmentMonths = parseInt(form.installmentMonths);
        payload.installmentMethod = form.installmentMethod;
        payload.payAtEnd = form.payAtEnd;
      } else {
        payload.dueDate = form.noDueDate ? null : form.dueDate;
      }
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg animate-in max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? "Edit transaction" : "Add transaction"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["LEND", "OWE"] as TransactionType[]).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    form.type === t
                      ? t === "LEND" ? "bg-blue-600 border-blue-600 text-white" : "bg-red-500 border-red-500 text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {t === "LEND" ? "↑ Lent" : "↓ Borrowed"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Amount (₱)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₱</span>
              <input type="number" required min="0.01" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="0.00" />
            </div>
          </div>

          {/* Installment toggle */}
          <div>
            <div className={`flex items-center justify-between py-3 px-4 rounded-xl border ${
              isExistingInstallment ? "bg-purple-50/50 border-purple-100" : "bg-purple-50 border-purple-100"
            }`}>
              <div>
                <p className="text-sm font-medium text-purple-900">Installment plan</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  {isExistingInstallment
                    ? "Enabled — you can update months and rate below"
                    : "Split into monthly payments"}
                </p>
              </div>
              <button
                type="button"
                disabled={isExistingInstallment}
                onClick={() => !isExistingInstallment && setForm({ ...form, isInstallment: !form.isInstallment, payAtEnd: false })}
                className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  form.isInstallment ? "bg-purple-600" : "bg-gray-200"
                } ${isExistingInstallment ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                <span className={`inline-block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  form.isInstallment ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
          </div>

          {/* Installment options */}
          {form.isInstallment && (
            <div className="space-y-3 bg-purple-50/50 rounded-xl p-4 border border-purple-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Months</label>
                  <input type="number" min="2" max="60" step="1"
                    value={form.installmentMonths}
                    onChange={(e) => setForm({ ...form, installmentMonths: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    placeholder="e.g. 6" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Monthly rate (%)</label>
                  <input type="number" min="0" step="0.01"
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    placeholder="e.g. 2.4" />
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Interest method</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["FLAT", "REDUCING"] as InstallmentMethod[]).map((m) => (
                    <button key={m} type="button"
                      onClick={() => setForm({ ...form, installmentMethod: m })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                        form.installmentMethod === m
                          ? "bg-purple-600 border-purple-600 text-white"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      <span className="block font-semibold">{m === "FLAT" ? "Flat rate" : "Reducing balance"}</span>
                      <span className={`block text-xs mt-0.5 ${form.installmentMethod === m ? "text-purple-100" : "text-gray-400"}`}>
                        {m === "FLAT" ? "Equal payments" : "Lower each month"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pay at end toggle */}
              <div className="flex items-center justify-between py-2.5 px-3 bg-white rounded-xl border border-purple-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Pay at end</p>
                  <p className="text-xs text-gray-400 mt-0.5">One lump sum payment on the final due date</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, payAtEnd: !form.payAtEnd })}
                  className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    form.payAtEnd ? "bg-purple-600" : "bg-gray-200"
                  }`}
                >
                  <span className={`inline-block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    form.payAtEnd ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              {/* Schedule preview */}
              {installmentSchedule.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</span>
                      <span className="text-sm font-bold text-purple-700">{formatCurrency(installmentTotal)}</span>
                    </div>
                    <button type="button" onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                      className="text-xs text-purple-600 hover:underline">
                      {showSchedulePreview ? "Hide" : "Preview"} schedule
                    </button>
                  </div>

                  {showSchedulePreview && (
                    <div className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                      <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-medium text-gray-400 uppercase border-b border-gray-50">
                        <span>Month</span>
                        <span className="text-right">Principal</span>
                        <span className="text-right">Interest</span>
                        <span className="text-right">Total</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                        {installmentSchedule.map((row) => (
                          <div key={row.monthNumber} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs">
                            <span className="text-gray-500">
                              {row.dueDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                            </span>
                            <span className="text-right text-gray-700">{formatCurrency(row.principalAmount)}</span>
                            <span className="text-right text-gray-500">{formatCurrency(row.interestAmount)}</span>
                            <span className="text-right font-semibold text-gray-900">{formatCurrency(row.totalAmount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-gray-100 bg-purple-50">
                        <span className="text-xs font-semibold text-purple-700">Total</span>
                        <span className="text-right text-xs font-semibold text-purple-700">{formatCurrency(Number(form.amount))}</span>
                        <span className="text-right text-xs font-semibold text-purple-600">{formatCurrency(installmentTotal - Number(form.amount))}</span>
                        <span className="text-right text-xs font-bold text-purple-700">{formatCurrency(installmentTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pay at end info */}
              {form.payAtEnd && installmentSchedule.length > 0 && (
                <div className="bg-purple-100/60 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-purple-800">
                    <span className="font-semibold">Single due date:</span>{" "}
                    {new Date(installmentSchedule[installmentSchedule.length - 1].dueDate)
                      .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                    Full amount of <span className="font-semibold">{formatCurrency(installmentTotal)}</span> due then.
                    You'll be notified once when it's approaching.
                  </p>
                </div>
              )}

              {isExistingInstallment && (
                <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Note:</span> Changing months or rate will reset the payment schedule.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Interest (for non-installment) */}
          {!form.isInstallment && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Interest</label>
                  <input type="number" min="0" step="0.01" value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Type</label>
                  <select value={form.interestType}
                    onChange={(e) => setForm({ ...form, interestType: e.target.value as InterestType })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition bg-white">
                    <option value="PERCENT">% Percent</option>
                    <option value="FLAT">₱ Flat fee</option>
                  </select>
                </div>
              </div>
              {form.amount && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-xs text-gray-500">Total to repay</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(simpleTotal)}</span>
                </div>
              )}
            </>
          )}

          {/* Counterparty */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Person / Company</label>
            <input type="text" value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="e.g. Maria, John, BPI Bank" />
          </div>

          {/* Transaction date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Transaction date</label>
            <input type="date" required value={form.transactionDate}
              onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition" />
          </div>

          {/* Due date — only for non-installment */}
          {!form.isInstallment && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Due date</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form.noDueDate}
                    onChange={(e) => setForm({ ...form, noDueDate: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <span className="text-xs text-gray-500">No due date</span>
                </label>
              </div>
              {!form.noDueDate ? (
                <input type="date" required={!form.noDueDate} value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition" />
              ) : (
                <div className="px-3 py-2.5 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">No due date set</div>
              )}
            </div>
          )}

          {/* Installment due date info */}
          {form.isInstallment && !isExistingInstallment && !form.payAtEnd && installmentSchedule.length > 0 && (
            <div className="bg-purple-50 rounded-xl px-4 py-3">
              <p className="text-xs text-purple-700">
                <span className="font-semibold">Due dates</span> are auto-calculated monthly from the transaction date.
                First payment due {new Date(installmentSchedule[0].dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Notes <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
              placeholder="Any extra details..." />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />}
              {isEdit ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}