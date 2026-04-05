"use client";
// src/components/ShareModal.tsx
import { useState } from "react";
import { Transaction } from "@/types";
import { formatDate } from "@/lib/utils";

interface Props {
  transaction: Transaction;
  onClose: () => void;
  onUpdated: (tx: Transaction) => void;
}

const EXPIRY_OPTIONS = [
  { label: "24 hours", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "No expiry", days: null },
];

export default function ShareModal({ transaction: tx, onClose, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number | null>(null); // default: no expiry
  const [shareUrl, setShareUrl] = useState<string | null>(
    tx.shareToken ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/share/${tx.shareToken}` : null
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(
    tx.shareExpiresAt ? String(tx.shareExpiresAt) : null
  );

  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  async function generateLink() {
    setGenerating(true);
    const res = await fetch(`/api/transactions/${tx.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: selectedDays }),
    });
    if (res.ok) {
      const data = await res.json();
      setShareUrl(data.shareUrl);
      setExpiresAt(data.shareExpiresAt ?? null);
      onUpdated({ ...tx, shareToken: data.shareToken, shareExpiresAt: data.shareExpiresAt ?? null });
    }
    setGenerating(false);
  }

  async function revokeLink() {
    setRevoking(true);
    await fetch(`/api/transactions/${tx.id}/share`, { method: "DELETE" });
    setShareUrl(null);
    setExpiresAt(null);
    onUpdated({ ...tx, shareToken: null, shareExpiresAt: null });
    setRevoking(false);
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-md animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="12" cy="4" r="2" stroke="#16a34a" strokeWidth="1.3"/>
                <circle cx="4" cy="8" r="2" stroke="#16a34a" strokeWidth="1.3"/>
                <circle cx="12" cy="12" r="2" stroke="#16a34a" strokeWidth="1.3"/>
                <path d="M6 7l4-2M6 9l4 2" stroke="#16a34a" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Share transaction</h2>
              <p className="text-xs text-gray-400">{tx.counterparty ?? "Unknown"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M3 3l9 9M12 3L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* What they'll see */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">What the recipient sees</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Transaction details</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Amount & interest</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Payment schedule</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Status & due dates</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Penalty rules</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-red-400 rounded-full" />Your email / login</span>
            </div>
          </div>

          {shareUrl && !isExpired ? (
            <>
              {/* Active link */}
              <div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="flex-1 text-xs text-gray-600 truncate font-mono">{shareUrl}</p>
                  <button
                    onClick={copyLink}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      copied
                        ? "bg-green-500 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1"/>
                    <path d="M5.5 3v2.5L7 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                  {expiresAt
                    ? `Expires ${formatDate(expiresAt)}`
                    : "No expiry — link stays active until revoked"}
                </p>
              </div>

              {/* Share buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="white" strokeWidth="1.3"/>
                    <path d="M9.5 4.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Here's your transaction details: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white text-sm font-semibold transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
              </div>

              {/* Regenerate / Revoke */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={generateLink}
                  disabled={generating}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Regenerate link
                </button>
                <button
                  onClick={revokeLink}
                  disabled={revoking}
                  className="flex-1 py-2 rounded-xl border border-red-100 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {revoking
                    ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                    : null}
                  Revoke link
                </button>
              </div>
            </>
          ) : (
            <>
              {/* No link or expired */}
              {isExpired && (
                <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100 text-xs text-amber-700">
                  Your previous link has expired. Generate a new one below.
                </div>
              )}

              {/* Expiry selector */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Link expires after</p>
                <div className="grid grid-cols-3 gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.days)}
                      type="button"
                      onClick={() => setSelectedDays(opt.days)}
                      className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all text-center ${
                        selectedDays === opt.days
                          ? "bg-green-600 border-green-600 text-white"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {selectedDays === null && (
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.1"/>
                      <path d="M5.5 3v1.5M5.5 6v.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                    Link stays active until you manually revoke it
                  </p>
                )}
              </div>

              <button
                onClick={generateLink}
                disabled={generating}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {generating
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <circle cx="11" cy="4" r="2" stroke="white" strokeWidth="1.3"/>
                      <circle cx="4" cy="7.5" r="2" stroke="white" strokeWidth="1.3"/>
                      <circle cx="11" cy="11" r="2" stroke="white" strokeWidth="1.3"/>
                      <path d="M6 6.5l3.5-2M6 8.5l3.5 2" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                }
                Generate shareable link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}