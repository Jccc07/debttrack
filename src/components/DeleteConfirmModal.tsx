"use client";
// src/components/DeleteConfirmModal.tsx

interface DeleteConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  counterparty?: string | null;
  loading?: boolean;
}

export default function DeleteConfirmModal({ onConfirm, onCancel, counterparty, loading }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-sm animate-in p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 6v4M9 12.5v.5" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M7.56 2.5a1.6 1.6 0 0 1 2.88 0l5.76 10a1.6 1.6 0 0 1-1.44 2.5H3.24A1.6 1.6 0 0 1 1.8 12.5l5.76-10z" stroke="#ef4444" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Delete transaction</h3>
            <p className="text-sm text-gray-500">
              {counterparty ? `With ${counterparty}` : "This transaction"} will be permanently removed.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5 pl-13">
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}