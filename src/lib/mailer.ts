// src/lib/mailer.ts
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(`Gmail credentials missing. GMAIL_USER=${!!user} GMAIL_APP_PASSWORD=${!!pass}`);
  }

  const options: SMTPTransport.Options = {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  };

  return nodemailer.createTransport(options);
}

export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = createTransporter();
    await t.verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://debttrack-chi.vercel.app";

function viewBtn(href: string, color = "#16a34a") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">View Transaction →</a>`;
}

function footer() {
  return `<p style="margin-top:32px;font-size:12px;color:#999;">Sent by DebtTrack · <a href="${appUrl()}" style="color:#999;">debttrack-chi.vercel.app</a></p>`;
}

function fmt(amount: number) {
  return "₱" + Number(amount).toFixed(2);
}

// ─── Base params shared by all notification types ───────────────────────────
interface BaseParams {
  to: string;
  counterpartyEmail?: string | null; // always CC'd when present
  ownerName: string;                 // the app user's name
  counterparty: string;              // other party's name
  amount: number;
  type: string;                      // LEND | OWE
  transactionId: string;
  shareUrl?: string | null;          // non-expiring share link
}

interface DueDateParams extends BaseParams { dueDate: Date; }
interface OverdueParams  extends BaseParams { dueDate: Date; }
interface PenaltyParams  extends BaseParams { dueDate: Date; penaltyAmount: number; totalDue: number; }
interface PaidParams     extends BaseParams { paidAt: Date; }
interface CreatedParams  extends BaseParams { dueDate: Date | null; }

// ─── Helper to build the recipients object ───────────────────────────────────
function recipients(to: string, cc?: string | null) {
  return { to, ...(cc ? { cc } : {}) };
}

// ─── 1. Transaction created ──────────────────────────────────────────────────
export async function sendTransactionCreated(params: CreatedParams) {
  const { to, counterpartyEmail, ownerName, counterparty, amount, type, transactionId, dueDate, shareUrl } = params;
  const verb = type === "LEND" ? "to" : "from";
  const t = createTransporter();

  await t.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    ...recipients(to, counterpartyEmail),
    subject: `Transaction recorded: ${verb} ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Transaction Recorded</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A new transaction has been recorded — <strong>${fmt(amount)}</strong> ${verb} <strong>${counterparty}</strong>${dueDate ? ` due on <strong>${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</strong>` : ""}.</p>
        ${shareUrl ? `
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:24px 0;border:1px solid #bbf7d0;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#15803d;">Shareable link for ${counterparty}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#166534;">Send this link so ${counterparty} can view the transaction details anytime:</p>
          <a href="${shareUrl}" style="display:inline-block;background:#16a34a;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;word-break:break-all;">${shareUrl}</a>
        </div>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`)}
        ${footer()}
      </div>
    `,
  });
}

// ─── 2. Upcoming due (1–3 days) ──────────────────────────────────────────────
export async function sendDueDateReminder(params: DueDateParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  const t = createTransporter();

  await t.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    ...recipients(to, counterpartyEmail),
    subject: `Reminder: Payment due ${dueDate.toLocaleDateString("en-PH")}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Reminder</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> is due on <strong>${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</strong>.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount due (including interest)</p>
        </div>
        ${shareUrl ? `<p style="font-size:13px;color:#666;">Share link for ${counterparty}: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`)}
        ${footer()}
      </div>
    `,
  });
}

// ─── 3. Due today ─────────────────────────────────────────────────────────────
export async function sendDueToday(params: DueDateParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  const t = createTransporter();

  await t.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    ...recipients(to, counterpartyEmail),
    subject: `Payment due today: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #f59e0b;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Due Today</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> is <strong>due today</strong> (${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}).</p>
        <div style="background:#fffbeb;border-radius:8px;padding:16px;margin:24px 0;border:1px solid #fde68a;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#d97706;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount due today</p>
        </div>
        ${shareUrl ? `<p style="font-size:13px;color:#666;">Share link for ${counterparty}: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`, "#d97706")}
        ${footer()}
      </div>
    `,
  });
}

// ─── 4. Overdue ───────────────────────────────────────────────────────────────
export async function sendOverdueAlert(params: OverdueParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  const t = createTransporter();

  await t.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    ...recipients(to, counterpartyEmail),
    subject: `⚠️ Overdue Payment: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #dc2626;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Overdue</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> was due on <strong>${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</strong> and is now overdue.</p>
        <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount overdue (including interest)</p>
        </div>
        ${shareUrl ? `<p style="font-size:13px;color:#666;">Share link for ${counterparty}: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`, "#dc2626")}
        ${footer()}
      </div>
    `,
  });
}

// ─── 5. Penalty accrued ───────────────────────────────────────────────────────
export async function sendPenaltyAlert(params: PenaltyParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, penaltyAmount, totalDue, type, transactionId, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  const t = createTransporter();

  await t.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    ...recipients(to, counterpartyEmail),
    subject: `🔥 Penalty applied: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #ea580c;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Penalty Applied</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A penalty has been applied to the payment ${verb} <strong>${counterparty}</strong> (was due ${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}).</p>
        <div style="background:#fff7ed;border-radius:8px;padding:16px;margin:24px 0;border:1px solid #fed7aa;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:#666;">Original amount</span>
            <span style="font-size:13px;font-weight:600;color:#1a1a1a;">${fmt(amount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:#ea580c;">+ Penalty</span>
            <span style="font-size:13px;font-weight:600;color:#ea580c;">+${fmt(penaltyAmount)}</span>
          </div>
          <div style="border-top:1px solid #fed7aa;padding-top:8px;display:flex;justify-content:space-between;">
            <span style="font-size:14px;font-weight:700;color:#1a1a1a;">Total now due</span>
            <span style="font-size:18px;font-weight:700;color:#ea580c;">${fmt(totalDue)}</span>
          </div>
        </div>
        ${shareUrl ? `<p style="font-size:13px;color:#666;">Share link for ${counterparty}: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`, "#ea580c")}
        ${footer()}
      </div>
    `,
  });
}

// ─── 6. Transaction paid ──────────────────────────────────────────────────────
export async function sendPaymentConfirmation(params: PaidParams) {
  const { to, counterpartyEmail, ownerName, counterparty, amount, type, transactionId, paidAt, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  const t = createTransporter();

  await t.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    ...recipients(to, counterpartyEmail),
    subject: `✅ Payment marked as paid: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Complete</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>The payment ${verb} <strong>${counterparty}</strong> has been marked as <strong>fully paid</strong> on ${paidAt.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}.</p>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:24px 0;border:1px solid #bbf7d0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Total amount settled</p>
        </div>
        ${shareUrl ? `<p style="font-size:13px;color:#666;">Share link for ${counterparty}: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`)}
        ${footer()}
      </div>
    `,
  });
}