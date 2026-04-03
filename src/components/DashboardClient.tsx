"use client";
import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@/types";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DashboardData {
  totalLent: number;
  totalOwed: number;
  totalExpectedReturn: number;
  overdueCount: number;
  recentTransactions: Transaction[];
  chartData: { month: string; lent: number; owed: number }[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-in">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-green-50 text-green-700",
    UNPAID: "bg-amber-50 text-amber-700",
    OVERDUE: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-50 text-gray-600"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your money at a glance</p>
        </div>
        <Link href="/transactions?new=1" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add transaction
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total lent" value={formatCurrency(data.totalLent)} sub="Outstanding principal" color="text-blue-600" />
        <StatCard label="Total owed" value={formatCurrency(data.totalOwed)} sub="What you owe" color="text-red-500" />
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
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v)]} />
              <Bar dataKey="lent" name="Lent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="owed" name="Owed" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /><span className="text-xs text-gray-400">Lent</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /><span className="text-xs text-gray-400">Owed</span></div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Recent transactions</h2>
          <Link href="/transactions" className="text-xs text-green-600 hover:underline font-medium">View all →</Link>
        </div>
        {data.recentTransactions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No transactions yet.{" "}
            <Link href="/transactions?new=1" className="text-green-600 hover:underline">Add your first one</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recentTransactions.map((tx) => (
              <Link key={tx.id} href={`/transactions/${tx.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${tx.type === "LEND" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"}`}>
                    {tx.type === "LEND" ? "↑" : "↓"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.counterparty ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400">{formatDate(tx.transactionDate)} · Due {formatDate(tx.dueDate)}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <p className={`text-sm font-semibold ${tx.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
                    {tx.type === "LEND" ? "+" : "-"}{formatCurrency(tx.endAmount)}
                  </p>
                  <StatusBadge status={tx.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
