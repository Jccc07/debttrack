// src/app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar user={{ name: session.user?.name ?? "", email: session.user?.email ?? "", image: session.user?.image ?? null }} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}