// src/app/api/test-email/route.ts
// DIAGNOSTIC ONLY — hit this URL after logging in to test email delivery:
//   https://debttrack-chi.vercel.app/api/test-email
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifySmtp, sendDueDateReminder } from "@/lib/mailer";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Step 1: verify SMTP credentials first
  const verify = await verifySmtp();
  if (!verify.ok) {
    return NextResponse.json({
      step: "smtp_verify",
      ok: false,
      error: verify.error,
      hint: "Check GMAIL_USER and GMAIL_APP_PASSWORD env vars. Password should have no spaces.",
    }, { status: 500 });
  }

  // Step 2: send a test email
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
      smtpUser: process.env.GMAIL_USER,
    });
  } catch (err: any) {
    return NextResponse.json({
      step: "send_mail",
      ok: false,
      error: err?.message ?? String(err),
    }, { status: 500 });
  }
}