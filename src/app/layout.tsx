import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "DebtTrack — Money Lending Tracker",
  description: "Track money you lend and owe with interest, due dates, and reminders.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%2316a34a'/><path d='M16 4L28 10v12L16 28 4 22V10L16 4z' stroke='white' strokeWidth='2' strokeLinejoin='round' fill='none'/><path d='M16 16l6-3M16 16v8M16 16L10 13' stroke='white' strokeWidth='1.8' strokeLinecap='round'/></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}