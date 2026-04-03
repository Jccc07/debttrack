"use client";
// src/app/(dashboard)/notifications/page.tsx
import { useEffect, useState } from "react";
import { Notification } from "@/types";
import Link from "next/link";

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
      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v4M7 9.5v.5" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round"/><circle cx="7" cy="7" r="5.5" stroke="#ef4444" strokeWidth="1.3"/></svg>
      </div>
    );
  }
  if (type === "UPCOMING_DUE") {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#d97706" strokeWidth="1.3"/><path d="M7 4v3.5l2 1.5" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
  );
}

export default function NotificationsPage() {
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">{unreadCount} unread</p>
          )}
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3a5.5 5.5 0 0 0-5.5 5.5v3L3 13h14l-1.5-2.5v-3A5.5 5.5 0 0 0 10 3z" stroke="#9ca3af" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 13v.5a2 2 0 0 0 4 0V13" stroke="#9ca3af" strokeWidth="1.3"/></svg>
            </div>
            <p className="text-gray-400 text-sm">No notifications yet</p>
            <p className="text-gray-300 text-xs mt-1">We'll alert you about upcoming and overdue payments</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                  !n.isRead ? "bg-green-50/30" : "hover:bg-gray-50"
                }`}
              >
                <NotificationIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.isRead ? "font-medium text-gray-900" : "text-gray-700"}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
                {n.transactionId && (
                  <Link
                    href={`/transactions/${n.transactionId}`}
                    className="flex-shrink-0 text-xs text-green-600 hover:underline font-medium"
                  >
                    View →
                  </Link>
                )}
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}