"use client";
// src/app/(dashboard)/transactions/page.tsx
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Transaction, TransactionFilters } from "@/types";
import { formatCurrency, formatDate, getDaysUntilDue } from "@/lib/utils";
import TransactionForm from "@/components/TransactionForm";
import Link from "next/link";

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

function DueBadge({ dueDate, status }: { dueDate: string | Date; status: string }) {
  if (status === "PAID") return null;
  const days = getDaysUntilDue(dueDate);
  if (days > 7) return null;
  const color = days < 0 ? "text-red-500" : days <= 3 ? "text-amber-600" : "text-gray-400";
  const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `${days}d left`;
  return <span className={`text-xs ${color}`}>{label}</span>;
}

function exportCSV(transactions: Transaction[]) {
  const rows = [
    ["Date", "Type", "Person", "Amount", "Interest Rate", "Interest Type", "Total", "Due Date", "Status"],
    ...transactions.map((t) => [
      formatDate(t.transactionDate),
      t.type,
      t.counterparty ?? "",
      Number(t.amount).toFixed(2),
      Number(t.interestRate).toFixed(2),
      t.interestType,
      Number(t.endAmount).toFixed(2),
      formatDate(t.dueDate),
      t.status,
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `debttrack-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [filters, setFilters] = useState<TransactionFilters>({
    type: (searchParams.get("type") as TransactionFilters["type"]) ?? "",
    status: (searchParams.get("status") as TransactionFilters["status"]) ?? "",
    search: searchParams.get("search") ?? "",
    sort: "transactionDate",
    order: "desc",
  });
  const [page, setPage] = useState(1);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.order) params.set("order", filters.order);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  async function markPaid(id: string, current: string) {
    const newStatus = current === "PAID" ? "UNPAID" : "PAID";
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTransactions();
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTransactions();
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          {transactions.length > 0 && (
            <button
              onClick={() => exportCSV(transactions)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v8M3.5 6l3 3 3-3M1 10v1.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <input
              type="text"
              placeholder="Search by name..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>

          {/* Type filter */}
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as TransactionFilters["type"] })}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          >
            <option value="">All types</option>
            <option value="LEND">Lent</option>
            <option value="OWE">Owed</option>
          </select>

          {/* Status filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as TransactionFilters["status"] })}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          >
            <option value="">All status</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </select>

          {/* Sort */}
          <select
            value={`${filters.sort}-${filters.order}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split("-");
              setFilters({ ...filters, sort, order: order as "asc" | "desc" });
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          >
            <option value="transactionDate-desc">Newest first</option>
            <option value="transactionDate-asc">Oldest first</option>
            <option value="amount-desc">Amount (high)</option>
            <option value="amount-asc">Amount (low)</option>
            <option value="dueDate-asc">Due date (soon)</option>
          </select>

          {/* Date range */}
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          />
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          />

          {/* Clear */}
          {(filters.type || filters.status || filters.search || filters.from || filters.to) && (
            <button
              onClick={() => setFilters({ sort: "transactionDate", order: "desc", search: "", type: "", status: "" })}
              className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No transactions found.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-green-600 text-sm hover:underline font-medium"
            >
              Add your first transaction
            </button>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-50">
              <span>Person</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Due</span>
              <span>Status</span>
              <span></span>
            </div>

            <div className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors group"
                >
                  {/* Person + type */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      tx.type === "LEND" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
                    }`}>
                      {tx.type === "LEND" ? "↑" : "↓"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tx.counterparty ?? "—"}</p>
                      <p className="text-xs text-gray-400 md:hidden">{formatDate(tx.transactionDate)}</p>
                    </div>
                  </div>

                  {/* Date */}
                  <span className="hidden md:block text-sm text-gray-500">{formatDate(tx.transactionDate)}</span>

                  {/* Amount */}
                  <div className="hidden md:block">
                    <p className={`text-sm font-semibold ${tx.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
                      {formatCurrency(tx.endAmount)}
                    </p>
                    {Number(tx.interestRate) > 0 && (
                      <p className="text-xs text-gray-400">
                        {formatCurrency(tx.amount)} +{Number(tx.interestRate)}{tx.interestType === "PERCENT" ? "%" : "$"}
                      </p>
                    )}
                  </div>

                  {/* Due */}
                  <div className="hidden md:block">
                    <p className="text-sm text-gray-600">{formatDate(tx.dueDate)}</p>
                    <DueBadge dueDate={tx.dueDate} status={tx.status} />
                  </div>

                  {/* Status */}
                  <div className="hidden md:block">
                    <StatusBadge status={tx.status} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/transactions/${tx.id}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="View"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 7s2-4.5 6-4.5S13 7 13 7s-2 4.5-6 4.5S1 7 1 7z" stroke="currentColor" strokeWidth="1.3"/></svg>
                    </Link>
                    <button
                      onClick={() => markPaid(tx.id, tx.status)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        tx.status === "PAID"
                          ? "text-green-600 hover:text-gray-400 hover:bg-gray-100"
                          : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                      }`}
                      title={tx.status === "PAID" ? "Mark unpaid" : "Mark paid"}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M5.5 6v4M8.5 6v4M3 3.5l.75 8a.5.5 0 0 0 .5.5h5.5a.5.5 0 0 0 .5-.5L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <TransactionForm
          onClose={() => { setShowForm(false); router.replace("/transactions"); }}
          onSaved={() => fetchTransactions()}
        />
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsPageInner />
    </Suspense>
  );
}