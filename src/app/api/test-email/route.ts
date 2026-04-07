// src/app/api/test-email/route.ts
// DIAGNOSTIC ONLY — lets you test Resend email without waiting for cron
// Hit this URL in your browser after logging in:
//   https://debttrack-chi.vercel.app/api/test-email
// Remove or secure this route once email is confirmed working.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendDueDateReminder } from "@/lib/mailer";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await sendDueDateReminder({
      to: session.user.email,
      ownerName: session.user.name ?? "there",
      counterparty: "Test Person",
      dueDate: new Date(),
      amount: 1234.56,
      type: "LEND",
      transactionId: "test-id-000",
    });

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${session.user.email}. Check your inbox (and spam).`,
      resendFrom: process.env.RESEND_FROM ?? "onboarding@resend.dev",
    });
  } catch (err: any) {
    return NextResponse.json({
      step: "send_mail",
      ok: false,
      error: err?.message ?? String(err),
    }, { status: 500 });
  }
}