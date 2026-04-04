"use client";
// src/app/(dashboard)/layout.tsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  // Start closed so users clearly see the hamburger button to open it
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full spinner" />
      </div>
    );
  }

  if (!session) return null;

  const user = {
    name: session.user?.name ?? "",
    email: session.user?.email ?? "",
    image: session.user?.image ?? null,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — width animates 0 ↔ 240px */}
      <Sidebar
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Right side: topbar + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Topbar ── always visible, contains hamburger + logo */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 flex-shrink-0 z-10">
          {/* Hamburger — always shown */}
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            )}
          </button>

          {/* Logo — always shown in topbar */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-600 rounded-md flex items-center justify-center flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 5v6L8 14 2 11V5L8 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 8l3-1.5M8 8v4M8 8L5 6.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">DebtTrack</span>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}