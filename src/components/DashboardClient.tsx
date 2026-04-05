"use client";
// src/components/DashboardClient.tsx
import { useEffect, useState } from "react";
import { formatCurrency, formatDate, computePenaltyPreview } from "@/lib/utils";
import { Transaction } from "@/types";
import Link from "next/link";
import TransactionDetailsModal from "@/components/TransactionDetailsModal";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DashboardData {
  totalLent: number; totalOwed: number; totalExpectedReturn: number;
  totalOwedWithInterest: number;
  overdueCount: number; recentTransactions: Transaction[];
  chartData: { month: string; lent: number; owed: number }[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { PAID: "bg-green-50 text-green-700", UNPAID: "bg-amber-50 text-amber-700", OVERDUE: "bg-red-50 text-red-700" };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-50 text-gray-600"}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="9" height="11" viewBox="0 0 9 11" fill="none" className={className}>
      <path d="M4.5 10.5C2.5 10.5 1 9.1 1 7.2c0-1.2.5-2 1.2-2.7.2-.2.4 0 .3.2-.1.5-.1 1.1.3 1.5.1.1.3.1.3-.1.2-1 .8-2.5 2.4-3.4.2-.1.4.1.3.3-.3.8-.2 1.7.4 2.2.1.1.2 0 .2-.1.1-.4.3-.9.7-1.2.2-.1.4 0 .3.2-.1.4 0 .9.2 1.2C8 5.9 8 6.5 8 7.2c0 1.9-1.5 3.3-3.5 3.3z" fill="currentColor"/>
    </svg>
  );
}

function getLivePenaltyAmount(tx: Transaction): number {
  if (
    !tx.penaltyEnabled || !tx.dueDate || tx.status === "PAID" ||
    tx.penaltyGraceDays === null || tx.penaltyGraceDays === undefined ||
    !tx.penaltyType || !tx.penaltyAmount || !tx.penaltyFrequency
  ) return 0;
  if (tx.isInstallment && !tx.payAtEnd) return 0;
  const preview = computePenaltyPreview(
    Number(tx.endAmount),
    tx.dueDate,
    tx.penaltyGraceDays,
    tx.penaltyType,
    Number(tx.penaltyAmount),
    tx.penaltyFrequency,
    0
  );
  return preview?.amount ?? 0;
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, []);

  function handleTxUpdated(updated: Transaction) {
    setData((prev) => prev ? { ...prev, recentTransactions: prev.recentTransactions.map((t) => t.id === updated.id ? updated : t) } : prev);
    setSelectedTx(updated);
  }

  function handleTxDeleted(id: string) {
    setData((prev) => prev ? { ...prev, recentTransactions: prev.recentTransactions.filter((t) => t.id !== id) } : prev);
    setSelectedTx(null);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" /></div>;
  if (!data) return null;

  const owedDisplay = data.totalOwedWithInterest ?? data.totalOwed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your money at a glance</p>
        </div>
        <Link href="/dashboard/transactions?new=1" className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Add transaction
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total lent" value={formatCurrency(data.totalLent)} sub="Outstanding principal" color="text-blue-600" />
        <StatCard label="Total money owed" value={formatCurrency(owedDisplay)} sub="Principal + interest" color="text-red-500" />
        <StatCard label="Expected return" value={formatCurrency(data.totalExpectedReturn)} sub="Principal + interest" color="text-green-600" />
        <StatCard label="Overdue" value={String(data.overdueCount)} sub={data.overdueCount === 1 ? "transaction" : "transactions"} color={data.overdueCount > 0 ? "text-red-600" : "text-gray-900"} />
      </div>

      {data.chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly activity</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.chartData} barGap={4} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v}`} />
              <Tooltip contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v)]} />
              <Bar dataKey="lent" name="Lent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="owed" name="Borrowed" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /><span className="text-xs text-gray-400">Lent</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /><span className="text-xs text-gray-400">Borrowed</span></div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent transactions</h2>
          <Link href="/dashboard/transactions" className="text-xs text-green-600 hover:underline font-medium">View all →</Link>
        </div>

        {data.recentTransactions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-400">No transactions yet.</p>
            <Link href="/dashboard/transactions?new=1" className="text-sm text-green-600 hover:underline font-medium mt-1 inline-block">Add your first one →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recentTransactions.map((tx) => {
              const livePenalty = getLivePenaltyAmount(tx);
              const hasPenalty = livePenalty > 0;
              const displayAmount = Number(tx.endAmount) + livePenalty;

              return (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group ${hasPenalty ? "border-l-2 border-l-orange-300" : ""}`}
                >
                  {/* Left: icon + name + badges */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${tx.type === "LEND" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"}`}>
                      {tx.type === "LEND" ? "↑" : "↓"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                          {tx.counterparty ?? "Unknown"}
                        </p>
                        {tx.isInstallment && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-medium flex-shrink-0">
                            {tx.installmentMonths}×
                          </span>
                        )}
                        {hasPenalty && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-600 text-xs font-semibold flex-shrink-0">
                            <FlameIcon />
                            penalty
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {tx.type === "LEND" ? "Lent" : "Borrowed"} · {formatDate(tx.transactionDate)}
                        {!tx.isInstallment && tx.dueDate ? ` · Due ${formatDate(tx.dueDate)}` : ""}
                        {tx.isInstallment ? ` · ${tx.installmentMonths} installments` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Right: amount + status */}
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <div className="text-right">
                      {hasPenalty ? (
                        <>
                          <div className="flex items-center justify-end gap-1">
                            <FlameIcon className="text-orange-500" />
                            <p className="text-sm font-bold text-orange-600">
                              {tx.type === "LEND" ? "+" : "−"}{formatCurrency(displayAmount)}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 line-through leading-none">
                            {tx.type === "LEND" ? "+" : "−"}{formatCurrency(tx.endAmount)}
                          </p>
                          <p className="text-xs text-orange-400">+{formatCurrency(livePenalty)} penalty</p>
                        </>
                      ) : (
                        <p className={`text-sm font-bold ${tx.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
                          {tx.type === "LEND" ? "+" : "−"}{formatCurrency(tx.endAmount)}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedTx && (
        <TransactionDetailsModal transaction={selectedTx} onClose={() => setSelectedTx(null)}
          onUpdated={handleTxUpdated} onDeleted={handleTxDeleted} />
      )}
    </div>
  );
}