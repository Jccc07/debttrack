"use client";
// src/components/DashboardClient.tsx
import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import Link from "next/link";
import TransactionDetailsModal from "@/components/TransactionDetailsModal";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface DashboardData {
  totalLent: number;
  totalOwed: number;
  totalExpectedReturn: number;
  overdueCount: number;
  recentTransactions: Transaction[];
  chartData: { month: string; lent: number; owed: number }[];
}

function StatCard({ label, value, sub, color, accent }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  accent?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm ${accent ?? ""}`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID:    "bg-green-50 text-green-700",
    UNPAID:  "bg-amber-50 text-amber-700",
    OVERDUE: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-50 text-gray-600"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  function handleTxUpdated(updated: Transaction) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recentTransactions: prev.recentTransactions.map((t) =>
          t.id === updated.id ? updated : t
        ),
      };
    });
    setSelectedTx(updated);
  }

  function handleTxDeleted(id: string) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recentTransactions: prev.recentTransactions.filter((t) => t.id !== id),
      };
    });
    setSelectedTx(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your money at a glance</p>
        </div>
        <Link
          href="/transactions?new=1"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add transaction
        </Link>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total lent"
          value={formatCurrency(data.totalLent)}
          sub="Outstanding principal"
          color="text-blue-600"
        />
        <StatCard
          label="Total borrowed"
          value={formatCurrency(data.totalOwed)}
          sub="What you owe"
          color="text-red-500"
        />
        <StatCard
          label="Expected return"
          value={formatCurrency(data.totalExpectedReturn)}
          sub="Principal + interest"
          color="text-green-600"
        />
        <StatCard
          label="Overdue"
          value={String(data.overdueCount)}
          sub={data.overdueCount === 1 ? "transaction" : "transactions"}
          color={data.overdueCount > 0 ? "text-red-600" : "text-gray-900"}
        />
      </div>

      {/* ── Monthly activity chart ── */}
      {data.chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly activity</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.chartData} barGap={4} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₱${v}`}
              />
              <Tooltip
                contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v)]}
              />
              <Bar dataKey="lent" name="Lent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="owed" name="Borrowed" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
              <span className="text-xs text-gray-400">Lent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
              <span className="text-xs text-gray-400">Borrowed</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent transactions ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent transactions</h2>
          <Link href="/transactions" className="text-xs text-green-600 hover:underline font-medium">
            View all →
          </Link>
        </div>

        {data.recentTransactions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 5v4M9 11v.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="9" cy="9" r="7.5" stroke="#9ca3af" strokeWidth="1.3"/>
              </svg>
            </div>
            <p className="text-sm text-gray-400">No transactions yet.</p>
            <Link href="/transactions?new=1" className="text-sm text-green-600 hover:underline font-medium mt-1 inline-block">
              Add your first one →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recentTransactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
              >
                {/* Left: icon + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    tx.type === "LEND" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
                  }`}>
                    {tx.type === "LEND" ? "↑" : "↓"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                      {tx.counterparty ?? "Unknown"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {tx.type === "LEND" ? "Lent" : "Borrowed"} · {formatDate(tx.transactionDate)}
                      {tx.dueDate ? ` · Due ${formatDate(tx.dueDate)}` : ""}
                    </p>
                  </div>
                </div>

                {/* Right: amount + status */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <p className={`text-sm font-bold ${tx.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
                    {tx.type === "LEND" ? "+" : "−"}{formatCurrency(tx.endAmount)}
                  </p>
                  <StatusBadge status={tx.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Transaction details modal */}
      {selectedTx && (
        <TransactionDetailsModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onUpdated={handleTxUpdated}
          onDeleted={handleTxDeleted}
        />
      )}
    </div>
  );
}