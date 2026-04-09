// src/lib/mailer.ts
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error(`Gmail credentials missing. GMAIL_USER=${!!user} GMAIL_APP_PASSWORD=${!!pass}`);
  const options: SMTPTransport.Options = {
    host: "smtp.gmail.com",
    port: 587,          // 587 + STARTTLS is more reliable on Vercel than 465
    secure: false,      // STARTTLS — upgrades after connection
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  };
  return nodemailer.createTransport(options);
}

export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  try { await createTransporter().verify(); return { ok: true }; }
  catch (err: any) { return { ok: false, error: err?.message ?? String(err) }; }
}

async function sendMail(options: {
  to: string;
  cc?: string | null;
  subject: string;
  html: string;
}) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    to: options.to,
    ...(options.cc ? { cc: options.cc } : {}),
    subject: options.subject,
    html: options.html,
  });
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://debttrack-chi.vercel.app";

function viewBtn(href: string, color = "#16a34a") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;margin-top:4px;">View Transaction →</a>`;
}

function footer() {
  return `<p style="margin-top:32px;font-size:12px;color:#999;">Sent by DebtTrack · <a href="${appUrl()}" style="color:#999;">debttrack-chi.vercel.app</a></p>`;
}

function fmt(amount: number) {
  return "₱" + Number(amount).toFixed(2);
}

// ─── Penalty warning block ────────────────────────────────────────────────────
interface PenaltyRule {
  graceDays: number;
  penaltyType: "PERCENT" | "FLAT";
  penaltyAmount: number;
  penaltyFrequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  baseAmount: number;
}

function penaltyWarningBlock(rule: PenaltyRule | null | undefined): string {
  if (!rule) return "";
  const { graceDays, penaltyType, penaltyAmount, penaltyFrequency, baseAmount } = rule;
  const pesoValue = penaltyType === "PERCENT"
    ? (baseAmount * penaltyAmount / 100).toFixed(2)
    : Number(penaltyAmount).toFixed(2);
  const freqLabel: Record<string, string> = {
    ONCE: "one-time", DAILY: "every day", WEEKLY: "every week", MONTHLY: "every month",
  };
  return `
    <div style="background:#fff7ed;border-radius:8px;padding:14px 16px;margin:20px 0;border:1px solid #fed7aa;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.05em;">⚠ Penalty rule active</p>
      <p style="margin:0;font-size:13px;color:#9a3412;">
        After <strong>${graceDays} day${graceDays !== 1 ? "s" : ""}</strong> overdue, a penalty of
        <strong>${penaltyType === "PERCENT" ? `${penaltyAmount}% (₱${pesoValue})` : `₱${pesoValue}`}</strong>
        will be charged <strong>${freqLabel[penaltyFrequency]}</strong>.
        Please pay on time to avoid additional charges.
      </p>
    </div>`;
}

// ─── Share link block ─────────────────────────────────────────────────────────
function shareLinkBlock(shareUrl: string | null | undefined, counterparty: string): string {
  if (!shareUrl) return "";
  return `
    <div style="background:#f0fdf4;border-radius:8px;padding:14px 16px;margin:20px 0;border:1px solid #bbf7d0;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;">Transaction link for ${counterparty}</p>
      <p style="margin:0 0 10px;font-size:13px;color:#166534;">View the full transaction details anytime using this link:</p>
      <a href="${shareUrl}" style="display:inline-block;background:#16a34a;color:white;padding:7px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;word-break:break-all;">${shareUrl}</a>
    </div>`;
}

// ─── Transaction details block (used in created email) ────────────────────────
interface TransactionDetailProps {
  principalAmount: number;
  totalAmount: number;
  type: string;
  interestRate: number;
  interestType: string;
  paymentMethod: string;
  isInstallment: boolean;
  installmentMonths?: number | null;
}

function transactionDetailsBlock(p: TransactionDetailProps): string {
  const typeLabel = p.type === "LEND" ? "Lent (Money Out)" : "Borrowed (Money In)";

  const interestLabel = Number(p.interestRate) === 0
    ? "No interest"
    : p.interestType === "PERCENT"
      ? `${Number(p.interestRate)}%`
      : `₱${Number(p.interestRate).toFixed(2)} flat`;

  const methodLabel = p.isInstallment
    ? `Installment${p.installmentMonths ? ` (${p.installmentMonths} months)` : ""}`
    : "Straight (lump sum)";

  const rows: [string, string][] = [
    ["Transaction type",  typeLabel],
    ["Principal amount",  fmt(p.principalAmount)],
    ["Interest rate",     interestLabel],
    ["Payment method",    methodLabel],
    ["Total amount due",  fmt(p.totalAmount)],
  ];

  const rowsHtml = rows.map(([label, value], i) => `
    <tr>
      <td style="padding:9px 0;font-size:13px;color:#6b7280;${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">${label}</td>
      <td style="padding:9px 0;font-size:13px;font-weight:600;color:#111827;text-align:right;${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">${value}</td>
    </tr>`).join("");

  return `
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em;">Transaction Details</p>
      <table style="width:100%;border-collapse:collapse;">
        ${rowsHtml}
      </table>
    </div>`;
}

// ─── Shared params ────────────────────────────────────────────────────────────
interface BaseParams {
  to: string;
  counterpartyEmail?: string | null;
  ownerName: string;
  counterparty: string;
  amount: number;
  type: string;
  transactionId: string;
  shareUrl?: string | null;
  penaltyRule?: PenaltyRule | null;
}

interface DueDateParams extends BaseParams { dueDate: Date; }
interface OverdueParams  extends BaseParams { dueDate: Date; }
interface PenaltyParams  extends BaseParams { dueDate: Date; penaltyAmount: number; totalDue: number; }
interface PaidParams     extends BaseParams { paidAt: Date; }
interface CreatedParams  extends BaseParams {
  dueDate: Date | null;
  principalAmount: number;
  interestRate: number;
  interestType: string;
  paymentMethod: string;
  isInstallment: boolean;
  installmentMonths?: number | null;
}

// ─── 1. Transaction created ───────────────────────────────────────────────────
export async function sendTransactionCreated(params: CreatedParams) {
  const {
    to, counterpartyEmail, ownerName, counterparty, amount, type, transactionId,
    dueDate, shareUrl, penaltyRule,
    principalAmount, interestRate, interestType, paymentMethod, isInstallment, installmentMonths,
  } = params;
  const verb = type === "LEND" ? "to" : "from";

  await sendMail({
    to,
    cc: counterpartyEmail,
    subject: `Transaction recorded: ${verb} ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Transaction Recorded</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A new transaction has been recorded — <strong>${fmt(amount)}</strong> ${verb} <strong>${counterparty}</strong>${dueDate ? ` due on <strong>${dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>` : ""}.</p>
        ${transactionDetailsBlock({ principalAmount, totalAmount: amount, type, interestRate, interestType, paymentMethod, isInstallment, installmentMonths })}
        ${penaltyWarningBlock(penaltyRule)}
        ${shareLinkBlock(shareUrl, counterparty)}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`)}
        ${footer()}
      </div>`,
  });
}

// ─── 2. Upcoming due (1–3 days) ───────────────────────────────────────────────
export async function sendDueDateReminder(params: DueDateParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl, penaltyRule } = params;
  const verb = type === "LEND" ? "from" : "to";
  await sendMail({
    to,
    cc: counterpartyEmail,
    subject: `Reminder: Payment due ${dueDate.toLocaleDateString("en-PH")}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Reminder</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> is due on <strong>${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</strong>.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount due (principal + interest)</p>
        </div>
        ${penaltyWarningBlock(penaltyRule)}
        ${shareUrl ? `<p style="font-size:13px;color:#555;margin:16px 0;">Track this transaction: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`)}
        ${footer()}
      </div>`,
  });
}

// ─── 3. Due today ─────────────────────────────────────────────────────────────
export async function sendDueToday(params: DueDateParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl, penaltyRule } = params;
  const verb = type === "LEND" ? "from" : "to";
  await sendMail({
    to,
    cc: counterpartyEmail,
    subject: `Payment due today: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #f59e0b;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Due Today</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> is <strong>due today</strong> (${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}).</p>
        <div style="background:#fffbeb;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #fde68a;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#d97706;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount due today</p>
        </div>
        ${penaltyWarningBlock(penaltyRule)}
        ${shareUrl ? `<p style="font-size:13px;color:#555;margin:16px 0;">Track this transaction: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`, "#d97706")}
        ${footer()}
      </div>`,
  });
}

// ─── 4. Overdue ───────────────────────────────────────────────────────────────
export async function sendOverdueAlert(params: OverdueParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl, penaltyRule } = params;
  const verb = type === "LEND" ? "from" : "to";
  await sendMail({
    to,
    cc: counterpartyEmail,
    subject: `⚠️ Overdue Payment: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #dc2626;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Overdue</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> was due on <strong>${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</strong> and is now overdue.</p>
        <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Amount overdue (principal + interest)</p>
        </div>
        ${penaltyWarningBlock(penaltyRule)}
        ${shareUrl ? `<p style="font-size:13px;color:#555;margin:16px 0;">Track this transaction: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`, "#dc2626")}
        ${footer()}
      </div>`,
  });
}

// ─── 5. Penalty accrued ───────────────────────────────────────────────────────
export async function sendPenaltyAlert(params: PenaltyParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, penaltyAmount, totalDue, type, transactionId, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  await sendMail({
    to,
    cc: counterpartyEmail,
    subject: `🔥 Penalty applied: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #ea580c;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Penalty Applied</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>A penalty has been applied to the payment ${verb} <strong>${counterparty}</strong> (was due ${dueDate.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}).</p>
        <div style="background:#fff7ed;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #fed7aa;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:#666;">Original amount</span>
            <span style="font-size:13px;font-weight:600;">${fmt(amount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:#ea580c;">+ Penalty</span>
            <span style="font-size:13px;font-weight:600;color:#ea580c;">+${fmt(penaltyAmount)}</span>
          </div>
          <div style="border-top:1px solid #fed7aa;padding-top:8px;display:flex;justify-content:space-between;">
            <span style="font-size:14px;font-weight:700;">Total now due</span>
            <span style="font-size:18px;font-weight:700;color:#ea580c;">${fmt(totalDue)}</span>
          </div>
        </div>
        ${shareUrl ? `<p style="font-size:13px;color:#555;margin:16px 0;">Track this transaction: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`, "#ea580c")}
        ${footer()}
      </div>`,
  });
}

// ─── 6. Payment confirmed ─────────────────────────────────────────────────────
export async function sendPaymentConfirmation(params: PaidParams) {
  const { to, counterpartyEmail, ownerName, counterparty, amount, type, transactionId, paidAt, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  await sendMail({
    to,
    cc: counterpartyEmail,
    subject: `✅ Payment marked as paid: ${counterparty}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
        <div style="border-left:4px solid #16a34a;padding-left:16px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Payment Complete ✓</h2>
          <p style="margin:0;color:#666;font-size:14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>The payment ${verb} <strong>${counterparty}</strong> has been marked as <strong>fully paid</strong> on ${paidAt.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}.</p>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #bbf7d0;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">${fmt(amount)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">Total amount settled</p>
        </div>
        ${shareUrl ? `<p style="font-size:13px;color:#555;margin:16px 0;">View record: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${viewBtn(`${appUrl()}/dashboard/transactions/${transactionId}`)}
        ${footer()}
      </div>`,
  });
}