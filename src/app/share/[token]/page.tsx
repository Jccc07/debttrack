"use client";
// src/app/share/[token]/page.tsx
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatCurrency, formatDate, getDaysUntilDue } from "@/lib/utils";

interface ShareData {
  id: string;
  type: string;
  amount: number | string;
  interestRate: number | string;
  interestType: string;
  endAmount: number | string;
  counterparty: string | null;
  notes: string | null;
  transactionDate: string;
  dueDate: string | null;
  status: string;
  paidAt: string | null;
  isInstallment: boolean;
  installmentMonths: number | null;
  installmentMethod: string | null;
  payAtEnd: boolean;
  penaltyEnabled: boolean;
  penaltyGraceDays: number | null;
  penaltyType: string | null;
  penaltyAmount: number | string | null;
  penaltyFrequency: string | null;
  installments?: any[];
  penalties?: any[];
  shareExpiresAt: string | null;
  sharedBy: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-green-100 text-green-700 border-green-200",
    UNPAID: "bg-amber-100 text-amber-700 border-amber-200",
    OVERDUE: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${map[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function SharePage() {
  // useParams is the safe way to read route params in client components
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setError(d.error ?? "Something went wrong"); return; }
        setData(d);
      })
      .catch(() => setError("Something went wrong. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading transaction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 8v7M14 18.5v.5" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="11" stroke="#ef4444" strokeWidth="1.5"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-400 mt-3">This link may have expired or been revoked by the sender.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const interest = Number(data.endAmount) - Number(data.amount);
  const daysLeft = getDaysUntilDue(data.dueDate);
  const totalPenalties = (data.penalties ?? [])
    .filter((p: any) => !p.installmentId)
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const grandTotal = Number(data.endAmount) + totalPenalties;
  const expiresAt = data.shareExpiresAt ? new Date(data.shareExpiresAt) : null;
  const daysUntilExpiry = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 5v6L8 14 2 11V5L8 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 8l3-1.5M8 8v4M8 8L5 6.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">DebtTrack</span>
            <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">View only</span>
          </div>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3L10.5 2" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M8 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.2"/></svg>
                Copy link
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Expiry notice */}
        {daysUntilExpiry !== null && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium ${
            daysUntilExpiry <= 1 ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
          }`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {daysUntilExpiry <= 0
              ? "This link expires today"
              : daysUntilExpiry === 1
              ? "This link expires tomorrow"
              : `This link expires in ${daysUntilExpiry} days`}
          </div>
        )}

        {/* Main card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Card header */}
          <div className={`px-6 py-5 border-b border-gray-100 ${data.type === "LEND" ? "bg-blue-50/40" : "bg-red-50/40"}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                data.type === "LEND" ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-500"
              }`}>
                {data.type === "LEND" ? "↑" : "↓"}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{data.counterparty ?? "Unknown"}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {data.type === "LEND" ? "Lent by" : "Borrowed from"}{" "}
                  <span className="font-medium text-gray-700">{data.sharedBy}</span>
                  {" · "}{formatDate(data.transactionDate)}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={data.status} />
                  {data.isInstallment && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium border border-purple-200">
                      {data.installmentMonths}× installment
                    </span>
                  )}
                  {data.payAtEnd && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium border border-purple-200">
                      Pay at end
                    </span>
                  )}
                  {data.penaltyEnabled && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium border border-orange-200">
                      ⚠ Penalty rule
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Amount breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">Principal</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(data.amount)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">Interest</p>
                <p className="text-lg font-bold text-gray-700">+{formatCurrency(interest)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.isInstallment
                    ? `${data.interestRate}%/mo · ${data.installmentMethod === "FLAT" ? "flat" : "reducing"}`
                    : `${Number(data.interestRate)}${data.interestType === "PERCENT" ? "%" : "₱"}`}
                </p>
              </div>
              <div className={`rounded-xl p-4 ${data.type === "LEND" ? "bg-blue-50" : "bg-red-50"}`}>
                <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                  {totalPenalties > 0 ? "Subtotal" : "Total"}
                </p>
                <p className={`text-lg font-bold ${data.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
                  {formatCurrency(data.endAmount)}
                </p>
              </div>
            </div>

            {/* Grand total with penalties */}
            {totalPenalties > 0 && (
              <div className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600 uppercase tracking-wider">Penalties applied</p>
                  <p className="text-xs text-orange-500 mt-0.5">+{formatCurrency(totalPenalties)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-orange-700 uppercase tracking-wider">Grand total</p>
                  <p className="text-lg font-bold text-orange-800">{formatCurrency(grandTotal)}</p>
                </div>
              </div>
            )}

            {/* Penalty rule */}
            {data.penaltyEnabled && (
              <div className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-100">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">Penalty rule</p>
                <p className="text-xs text-orange-600">
                  After <span className="font-semibold">{data.penaltyGraceDays} day{data.penaltyGraceDays !== 1 ? "s" : ""}</span> overdue,
                  charge{" "}
                  <span className="font-semibold">
                    {data.penaltyType === "PERCENT"
                      ? `${data.penaltyAmount}% of balance`
                      : `₱${Number(data.penaltyAmount).toFixed(2)}`}
                  </span>{" "}
                  {data.penaltyFrequency === "ONCE" ? "(one-time)" : `every ${data.penaltyFrequency?.toLowerCase()}`}.
                </p>
              </div>
            )}

            {/* Installment schedule or due date */}
            {data.isInstallment && data.installments && data.installments.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment schedule</p>
                {data.payAtEnd ? (
                  <div className="bg-purple-50 rounded-xl px-4 py-3 border border-purple-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-purple-700 uppercase tracking-wider">Single payment due</p>
                        <p className="text-base font-bold text-purple-900 mt-0.5">
                          {formatDate(data.installments[data.installments.length - 1].dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-purple-600">Full amount</p>
                        <p className="text-base font-bold text-purple-900">{formatCurrency(data.endAmount)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>{data.installments.filter((i: any) => i.status === "PAID").length} of {data.installments.length} paid</span>
                        <span>{formatCurrency(data.installments.filter((i: any) => i.status !== "PAID").reduce((sum: number, i: any) => sum + Number(i.totalAmount), 0))} remaining</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${(data.installments.filter((i: any) => i.status === "PAID").length / data.installments.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                      {data.installments.map((inst: any) => {
                        const isPaid = inst.status === "PAID";
                        const isOverdue = inst.status === "OVERDUE";
                        const days = getDaysUntilDue(inst.dueDate);
                        const instPenalties = (inst.penalties ?? []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                        return (
                          <div key={inst.id} className={`flex items-center gap-3 px-4 py-3 ${isPaid ? "bg-green-50/30" : isOverdue ? "bg-red-50/30" : ""}`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isPaid ? "bg-green-500 border-green-500" : isOverdue ? "border-red-400" : "border-gray-300"}`}>
                              {isPaid && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div className="flex-shrink-0 w-16">
                              <span className={`text-xs font-semibold ${isPaid ? "text-green-700" : isOverdue ? "text-red-600" : "text-gray-600"}`}>
                                Month {inst.monthNumber}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${isPaid ? "line-through text-gray-400" : "text-gray-700"}`}>
                                {formatDate(inst.dueDate)}
                              </p>
                              {!isPaid && days !== null && (
                                <p className={`text-xs ${days < 0 ? "text-red-500" : days === 0 ? "text-orange-500" : days <= 3 ? "text-amber-600" : "text-gray-400"}`}>
                                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                                </p>
                              )}
                              {isPaid && inst.paidAt && <p className="text-xs text-green-600">Paid {formatDate(inst.paidAt)}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-semibold ${isPaid ? "text-gray-400" : "text-gray-900"}`}>
                                {formatCurrency(inst.totalAmount)}
                              </p>
                              {instPenalties > 0 && (
                                <p className="text-xs text-orange-600">+{formatCurrency(instPenalties)} penalty</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">Due date</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {data.dueDate ? formatDate(data.dueDate) : "No due date"}
                  </span>
                  {data.dueDate && data.status !== "PAID" && daysLeft !== null && (
                    <span className={`ml-2 text-xs ${daysLeft < 0 ? "text-red-500" : daysLeft <= 3 ? "text-amber-600" : "text-gray-400"}`}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "due today" : `${daysLeft}d left`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {data.paidAt && (
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">Fully paid on</span>
                <span className="text-sm font-semibold text-green-600">{formatDate(data.paidAt)}</span>
              </div>
            )}

            {data.notes && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">Notes</p>
                <p className="text-sm text-gray-700 leading-relaxed">{data.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1 pb-8">
          <p className="text-xs text-gray-400">
            Shared via <span className="font-semibold text-gray-500">DebtTrack</span> · View only, no account required
          </p>
          {expiresAt && (
            <p className="text-xs text-gray-400">Link expires {formatDate(expiresAt)}</p>
          )}
        </div>
      </div>
    </div>
  );
}