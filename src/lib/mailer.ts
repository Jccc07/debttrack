// src/lib/mailer.ts
import nodemailer from "nodemailer";

/**
 * Create a fresh transporter on every call.
 * DO NOT create it at module level — on Vercel serverless,
 * env vars may not be populated at cold-start module init time.
 */
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(`Gmail credentials missing. GMAIL_USER=${!!user} GMAIL_APP_PASSWORD=${!!pass}`);
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,          // SSL — more reliable than STARTTLS on serverless
    auth: { user, pass },
    pool: false,           // no connection pooling on serverless
    socketTimeout: 10000,  // 10s — well within Vercel's 30s function limit
    greetingTimeout: 10000,
    connectionTimeout: 10000,
  });
}

/** Verify SMTP credentials — call from /api/test-email */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = createTransporter();
    await t.verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

interface SendReminderParams {
  to: string;
  cc?: string;       // counterparty email (optional)
  name: string;
  counterparty: string;
  dueDate: Date;
  amount: number;
  type: string;
  transactionId: string;
}

interface SendOverdueParams extends SendReminderParams {}

export async function sendDueDateReminder(params: SendReminderParams) {
  const { to, cc, name, counterparty, dueDate, amount, type, transactionId } = params;
  const verb   = type === "LEND" ? "from" : "to";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://debttrack-chi.vercel.app";

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    to,
    ...(cc ? { cc } : {}),
    subject: `Reminder: Payment due ${dueDate.toLocaleDateString("en-PH")}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Reminder</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${name}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> is due on
           <strong>${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</strong>.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">₱${Number(amount).toFixed(2)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount due (including interest)</p>
        </div>
        <a href="${appUrl}/dashboard/transactions/${transactionId}"
           style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
          View Transaction →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#999;">Sent by DebtTrack · <a href="${appUrl}" style="color:#999;">debttrack-chi.vercel.app</a></p>
      </div>
    `,
  });
}

export async function sendOverdueAlert(params: SendOverdueParams) {
  const { to, cc, name, counterparty, dueDate, amount, type, transactionId } = params;
  const verb   = type === "LEND" ? "from" : "to";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://debttrack-chi.vercel.app";

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    to,
    ...(cc ? { cc } : {}),
    subject: `⚠️ Overdue Payment: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #dc2626;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Overdue</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${name}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> was due on
           <strong>${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</strong> and is now overdue.</p>
        <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626;">₱${Number(amount).toFixed(2)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount overdue (including interest)</p>
        </div>
        <a href="${appUrl}/dashboard/transactions/${transactionId}"
           style="display:inline-block;background:#dc2626;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
          View Transaction →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#999;">Sent by DebtTrack · <a href="${appUrl}" style="color:#999;">debttrack-chi.vercel.app</a></p>
      </div>
    `,
  });
}