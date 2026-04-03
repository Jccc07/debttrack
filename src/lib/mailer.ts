// src/lib/mailer.ts
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendDueDateReminder({
  to,
  name,
  counterparty,
  dueDate,
  amount,
  type,
  transactionId,
}: {
  to: string;
  name: string;
  counterparty: string;
  dueDate: Date;
  amount: number;
  type: string;
  transactionId: string;
}) {
  const verb = type === "LEND" ? "you lent to" : "you owe to";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  await transporter.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Reminder: Payment due ${dueDate.toLocaleDateString()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
        <div style="border-left: 4px solid #16a34a; padding-left: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 4px; font-size: 20px;">Payment Reminder</h2>
          <p style="margin: 0; color: #666; font-size: 14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${name}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> is due on
           <strong>${dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>.</p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #16a34a;">
            $${Number(amount).toFixed(2)}
          </p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #666;">Amount due (including interest)</p>
        </div>
        <a href="${appUrl}/transactions/${transactionId}"
           style="display: inline-block; background: #16a34a; color: white; padding: 10px 20px;
                  border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View Transaction →
        </a>
        <p style="margin-top: 32px; font-size: 12px; color: #999;">
          You're receiving this because you have an account on DebtTrack.
        </p>
      </body>
      </html>
    `,
  });
}

export async function sendOverdueAlert({
  to,
  name,
  counterparty,
  dueDate,
  amount,
  type,
  transactionId,
}: {
  to: string;
  name: string;
  counterparty: string;
  dueDate: Date;
  amount: number;
  type: string;
  transactionId: string;
}) {
  const verb = type === "LEND" ? "you lent to" : "you owe to";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  await transporter.sendMail({
    from: `"DebtTrack" <${process.env.GMAIL_USER}>`,
    to,
    subject: `⚠️ Overdue Payment: ${counterparty}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
        <div style="border-left: 4px solid #dc2626; padding-left: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 4px; font-size: 20px;">Payment Overdue</h2>
          <p style="margin: 0; color: #666; font-size: 14px;">DebtTrack</p>
        </div>
        <p>Hi <strong>${name}</strong>,</p>
        <p>A payment ${verb} <strong>${counterparty}</strong> was due on
           <strong>${dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong> and is now overdue.</p>
        <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #dc2626;">
            $${Number(amount).toFixed(2)}
          </p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #666;">Amount overdue (including interest)</p>
        </div>
        <a href="${appUrl}/transactions/${transactionId}"
           style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px;
                  border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View Transaction →
        </a>
      </body>
      </html>
    `,
  });
}