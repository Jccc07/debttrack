// src/lib/mailer.ts
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error(`Gmail credentials missing. GMAIL_USER=${!!user} GMAIL_APP_PASSWORD=${!!pass}`);
  const options: SMTPTransport.Options = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
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
  await createTransporter().sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    to: options.to,
    ...(options.cc ? { cc: options.cc } : {}),
    subject: options.subject,
    html: options.html,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://debttrack-chi.vercel.app";

function fmt(amount: number) {
  return "₱" + Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:32px auto;padding:0 16px 32px;">
    ${body}
    <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:24px;">
      Sent by <a href="${appUrl()}" style="color:#6b7280;text-decoration:none;">DebtTrack</a> · You received this because you are a party in this transaction.
    </p>
  </div>
</body></html>`;
}

function header(title: string, subtitle: string, color: string): string {
  return `
    <div style="background:${color};border-radius:12px 12px 0 0;padding:24px 28px 20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.08em;">DebtTrack</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${title}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${subtitle}</p>
    </div>`;
}

function card(content: string, bg = "#ffffff"): string {
  return `<div style="background:${bg};border-radius:0 0 12px 12px;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;">${content}</div>`;
}

function amountBadge(amount: number, label: string, color: string): string {
  return `
    <div style="background:${color};border-radius:10px;padding:18px 20px;margin:20px 0;text-align:center;">
      <p style="margin:0;font-size:32px;font-weight:800;color:#111827;letter-spacing:-0.5px;">${fmt(amount)}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;font-weight:500;">${label}</p>
    </div>`;
}

function infoRow(label: string, value: string, last = false): string {
  return `
    <tr>
      <td style="padding:10px 0;font-size:13px;color:#6b7280;${last ? "" : "border-bottom:1px solid #f3f4f6;"}">${label}</td>
      <td style="padding:10px 0;font-size:13px;font-weight:600;color:#111827;text-align:right;${last ? "" : "border-bottom:1px solid #f3f4f6;"}">${value}</td>
    </tr>`;
}

function infoTable(rows: [string, string][]): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${rows.map((r, i) => infoRow(r[0], r[1], i === rows.length - 1)).join("")}
    </table>`;
}

function ctaButton(href: string, label: string, color: string): string {
  return `
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${href}" style="display:inline-block;background:${color};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">${label}</a>
    </div>`;
}

function shareBlock(shareUrl: string | null | undefined, counterparty: string): string {
  if (!shareUrl) return "";
  return `
    <div style="background:#f0fdf4;border-radius:8px;padding:14px 16px;margin:16px 0;border:1px solid #bbf7d0;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.06em;">🔗 Transaction link for ${counterparty}</p>
      <a href="${shareUrl}" style="font-size:12px;color:#16a34a;word-break:break-all;">${shareUrl}</a>
    </div>`;
}

function penaltyBlock(rule: PenaltyRule | null | undefined): string {
  if (!rule) return "";
  const { graceDays, penaltyType, penaltyAmount, penaltyFrequency, baseAmount } = rule;
  const pesoValue = penaltyType === "PERCENT"
    ? fmt(baseAmount * penaltyAmount / 100)
    : fmt(penaltyAmount);
  const freqMap: Record<string, string> = {
    ONCE: "once (one-time)", DAILY: "every day", WEEKLY: "every week", MONTHLY: "every month",
  };
  return `
    <div style="background:#fff7ed;border-radius:8px;padding:14px 16px;margin:16px 0;border:1px solid #fed7aa;">
      <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.06em;">⚠️ Penalty Rule Active</p>
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.5;">
        If payment is not made within <strong>${graceDays} day${graceDays !== 1 ? "s" : ""}</strong> of the due date,
        a penalty of <strong>${penaltyType === "PERCENT" ? `${penaltyAmount}% = ${pesoValue}` : pesoValue}</strong>
        will be charged <strong>${freqMap[penaltyFrequency]}</strong>.
        Pay on time to avoid additional charges.
      </p>
    </div>`;
}

function greeting(name: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hi <strong>${name}</strong>,</p>`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PenaltyRule {
  graceDays: number;
  penaltyType: "PERCENT" | "FLAT";
  penaltyAmount: number;
  penaltyFrequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  baseAmount: number;
}

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
export interface CreatedParams extends BaseParams {
  dueDate: Date | null;
  principalAmount: number;
  interestRate: number;
  interestType: string;
  paymentMethod: string;
  isInstallment: boolean;
  installmentMonths?: number | null;
}

// ─── 1. Transaction Created ───────────────────────────────────────────────────
export async function sendTransactionCreated(params: CreatedParams) {
  const {
    to, counterpartyEmail, ownerName, counterparty, amount, type, transactionId,
    dueDate, shareUrl, penaltyRule,
    principalAmount, interestRate, interestType, isInstallment, installmentMonths,
  } = params;

  const verb = type === "LEND" ? "to" : "from";
  const typeLabel = type === "LEND" ? "Lent (Money Out)" : "Borrowed (Money In)";

  // ── Installment: show principal, interest rate, months ──
  // ── Normal: show total amount (principal + interest) and due date ──
  let detailsHtml: string;

  if (isInstallment) {
    const interestLabel = Number(interestRate) === 0
      ? "No interest"
      : interestType === "PERCENT"
        ? `${Number(interestRate)}% per month`
        : `₱${Number(interestRate).toFixed(2)} flat`;

    detailsHtml = `
      ${amountBadge(principalAmount, "Principal Amount", "#f9fafb")}
      ${infoTable([
        ["Transaction type", typeLabel],
        ["Interest rate",    interestLabel],
        ["Payment duration", `${installmentMonths} month${Number(installmentMonths) !== 1 ? "s" : ""}`],
      ])}`;
  } else {
    const dueDateStr = dueDate
      ? dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "No due date";

    detailsHtml = `
      ${amountBadge(amount, "Total Amount Due (Principal + Interest)", "#f0fdf4")}
      ${infoTable([
        ["Transaction type", typeLabel],
        ["Due date",         dueDateStr],
      ])}`;
  }

  await sendMail({
    to, cc: counterpartyEmail,
    subject: `Transaction recorded: ${verb} ${counterparty}`,
    html: wrap(`
      ${header("Transaction Recorded", `A new transaction has been recorded ${verb} ${counterparty}`, "#16a34a")}
      ${card(`
        ${greeting(ownerName)}
        <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
          ${isInstallment
            ? `A new installment transaction has been recorded ${verb} <strong>${counterparty}</strong>.`
            : `A new transaction has been recorded — <strong>${fmt(amount)}</strong> ${verb} <strong>${counterparty}</strong>.`
          }
        </p>
        ${detailsHtml}
        ${penaltyBlock(penaltyRule)}
        ${shareBlock(shareUrl, counterparty)}
        ${ctaButton(`${appUrl()}/dashboard/transactions/${transactionId}`, "View Transaction →", "#16a34a")}
      `)}
    `),
  });
}

// ─── 2. Upcoming Due (1–3 days) ───────────────────────────────────────────────
export async function sendDueDateReminder(params: DueDateParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl, penaltyRule } = params;
  const verb = type === "LEND" ? "from" : "to";
  const dueDateStr = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await sendMail({
    to, cc: counterpartyEmail,
    subject: `Reminder: Payment due ${dueDate.toLocaleDateString("en-PH")}`,
    html: wrap(`
      ${header("Payment Reminder", `Due on ${dueDateStr}`, "#2563eb")}
      ${card(`
        ${greeting(ownerName)}
        <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
          A payment ${verb} <strong>${counterparty}</strong> is coming up soon.
        </p>
        ${amountBadge(amount, `Amount due on ${dueDateStr}`, "#eff6ff")}
        ${infoTable([
          ["Counterparty", counterparty],
          ["Due date",     dueDateStr],
        ])}
        ${penaltyBlock(penaltyRule)}
        ${shareUrl ? `<p style="font-size:13px;color:#6b7280;margin:12px 0;">Track this transaction: <a href="${shareUrl}" style="color:#2563eb;">${shareUrl}</a></p>` : ""}
        ${ctaButton(`${appUrl()}/dashboard/transactions/${transactionId}`, "View Transaction →", "#2563eb")}
      `)}
    `),
  });
}

// ─── 3. Due Today ─────────────────────────────────────────────────────────────
export async function sendDueToday(params: DueDateParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl, penaltyRule } = params;
  const verb = type === "LEND" ? "from" : "to";
  const dueDateStr = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await sendMail({
    to, cc: counterpartyEmail,
    subject: `Due today: Payment ${verb} ${counterparty}`,
    html: wrap(`
      ${header("Due Today", `Payment is due today, ${dueDateStr}`, "#d97706")}
      ${card(`
        ${greeting(ownerName)}
        <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
          A payment ${verb} <strong>${counterparty}</strong> is <strong>due today</strong>.
        </p>
        ${amountBadge(amount, "Amount due today", "#fffbeb")}
        ${infoTable([
          ["Counterparty", counterparty],
          ["Due date",     dueDateStr],
        ])}
        ${penaltyBlock(penaltyRule)}
        ${shareUrl ? `<p style="font-size:13px;color:#6b7280;margin:12px 0;">Track this transaction: <a href="${shareUrl}" style="color:#d97706;">${shareUrl}</a></p>` : ""}
        ${ctaButton(`${appUrl()}/dashboard/transactions/${transactionId}`, "View Transaction →", "#d97706")}
      `)}
    `),
  });
}

// ─── 4. Overdue ───────────────────────────────────────────────────────────────
export async function sendOverdueAlert(params: OverdueParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, type, transactionId, shareUrl, penaltyRule } = params;
  const verb = type === "LEND" ? "from" : "to";
  const dueDateStr = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await sendMail({
    to, cc: counterpartyEmail,
    subject: `⚠️ Overdue: Payment ${verb} ${counterparty}`,
    html: wrap(`
      ${header("Payment Overdue", `Was due on ${dueDateStr}`, "#dc2626")}
      ${card(`
        ${greeting(ownerName)}
        <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
          A payment ${verb} <strong>${counterparty}</strong> was due on <strong>${dueDateStr}</strong> and has not been settled.
        </p>
        ${amountBadge(amount, "Overdue amount (principal + interest)", "#fef2f2")}
        ${infoTable([
          ["Counterparty", counterparty],
          ["Was due on",   dueDateStr],
        ])}
        ${penaltyBlock(penaltyRule)}
        ${shareUrl ? `<p style="font-size:13px;color:#6b7280;margin:12px 0;">Track this transaction: <a href="${shareUrl}" style="color:#dc2626;">${shareUrl}</a></p>` : ""}
        ${ctaButton(`${appUrl()}/dashboard/transactions/${transactionId}`, "View Transaction →", "#dc2626")}
      `)}
    `),
  });
}

// ─── 5. Penalty Applied ───────────────────────────────────────────────────────
export async function sendPenaltyAlert(params: PenaltyParams) {
  const { to, counterpartyEmail, ownerName, counterparty, dueDate, amount, penaltyAmount, totalDue, type, transactionId, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  const dueDateStr = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await sendMail({
    to, cc: counterpartyEmail,
    subject: `🔥 Penalty applied: ${counterparty}`,
    html: wrap(`
      ${header("Penalty Applied", `Payment ${verb} ${counterparty} has incurred a penalty`, "#ea580c")}
      ${card(`
        ${greeting(ownerName)}
        <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
          A penalty has been applied to the payment ${verb} <strong>${counterparty}</strong> (was due ${dueDateStr}).
        </p>
        ${amountBadge(totalDue, "Total now due (including penalty)", "#fff7ed")}
        ${infoTable([
          ["Original amount", fmt(amount)],
          ["Penalty added",   `+${fmt(penaltyAmount)}`],
          ["Total now due",   fmt(totalDue)],
        ])}
        ${shareUrl ? `<p style="font-size:13px;color:#6b7280;margin:12px 0;">Track this transaction: <a href="${shareUrl}" style="color:#ea580c;">${shareUrl}</a></p>` : ""}
        ${ctaButton(`${appUrl()}/dashboard/transactions/${transactionId}`, "View Transaction →", "#ea580c")}
      `)}
    `),
  });
}

// ─── 6. Payment Confirmed ─────────────────────────────────────────────────────
export async function sendPaymentConfirmation(params: PaidParams) {
  const { to, counterpartyEmail, ownerName, counterparty, amount, type, transactionId, paidAt, shareUrl } = params;
  const verb = type === "LEND" ? "from" : "to";
  const paidAtStr = paidAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await sendMail({
    to, cc: counterpartyEmail,
    subject: `✅ Paid: Transaction ${verb} ${counterparty}`,
    html: wrap(`
      ${header("Payment Complete ✓", `Transaction ${verb} ${counterparty} has been settled`, "#16a34a")}
      ${card(`
        ${greeting(ownerName)}
        <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
          The payment ${verb} <strong>${counterparty}</strong> has been marked as <strong>fully paid</strong>.
        </p>
        ${amountBadge(amount, "Total amount settled", "#f0fdf4")}
        ${infoTable([
          ["Counterparty", counterparty],
          ["Paid on",      paidAtStr],
        ])}
        ${shareUrl ? `<p style="font-size:13px;color:#6b7280;margin:12px 0;">View record: <a href="${shareUrl}" style="color:#16a34a;">${shareUrl}</a></p>` : ""}
        ${ctaButton(`${appUrl()}/dashboard/transactions/${transactionId}`, "View Transaction →", "#16a34a")}
      `)}
    `),
  });
}