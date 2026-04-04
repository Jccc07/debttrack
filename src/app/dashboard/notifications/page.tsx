"use client";
export const dynamic = "force-dynamic";
// src/app/dashboard/notifications/page.tsx
import { useEffect, useState } from "react";
import { Notification } from "@/types";
import { useRouter } from "next/navigation";

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "OVERDUE") {
    return (
      <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v4M7 9.5v.5" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round"/>
          <circle cx="7" cy="7" r="5.5" stroke="#ef4444" strokeWidth="1.3"/>
        </svg>
      </div>
    );
  }
  if (type === "DUE_TODAY") {
    return (
      <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="#ea580c" strokeWidth="1.3"/>
          <path d="M7 4v3.5l2 1.5" stroke="#ea580c" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }
  if (type === "UPCOMING_DUE") {
    return (
      <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="#d97706" strokeWidth="1.3"/>
          <path d="M7 4v3.5l2 1.5" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M2 7l3.5 3.5L12 3" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => { setNotifications(data); setLoading(false); });
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function handleView(n: Notification) {
    if (!n.isRead) {
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    }
    if (n.transactionId) {
      router.push(`/dashboard/transactions?view=${n.transactionId}`);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-green-600 hover:underline font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                <path d="M10 3a5.5 5.5 0 0 0-5.5 5.5v3L3 13h14l-1.5-2.5v-3A5.5 5.5 0 0 0 10 3z" stroke="#9ca3af" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M8 13v.5a2 2 0 0 0 4 0V13" stroke="#9ca3af" strokeWidth="1.3"/>
              </svg>
            </div>
            <p className="text-gray-500 font-medium text-sm">No notifications yet</p>
            <p className="text-gray-400 text-xs mt-1 max-w-xs">
              You'll be alerted here when payments are upcoming, due today, or overdue.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                  !n.isRead ? "bg-green-50/40" : "hover:bg-gray-50"
                }`}
              >
                <NotificationIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${
                    !n.isRead ? "font-semibold text-gray-900" : "text-gray-700"
                  }`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {n.transactionId && (
                    <button
                      onClick={() => handleView(n)}
                      className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline transition-colors whitespace-nowrap"
                    >
                      View →
                    </button>
                  )}
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}