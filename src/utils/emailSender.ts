import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { AppError } from "../app/errors/AppError";
import { env } from "../app/config/env";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

const isConfigured = Boolean(env.SMTP_HOST && env.SMTP_FROM);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    })
  : null;

const assertConfigured = (): Mail => {
  if (!transporter || !env.SMTP_FROM) {
    throw new AppError("Email is not configured", 503);
  }

  return transporter;
};

export const sendEmail = async (message: EmailMessage): Promise<void> => {
  const mailer = assertConfigured();

  await mailer.sendMail({
    from: env.SMTP_FROM,
    envelope: env.SMTP_USER ? { from: env.SMTP_USER, to: message.to } : undefined,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });
};

const money = (amount: number, currency: string): string =>
  `${currency} ${amount.toFixed(2)}`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const emailLayout = (input: { title: string; preheader: string; body: string }): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f0ea;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ea;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#1c1917;padding:28px 32px;">
                <p style="margin:0;font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:#d6c4a8;">CLOTHING</p>
                <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:28px;line-height:1.3;font-weight:normal;color:#ffffff;">${escapeHtml(input.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#292524;">
                ${input.body}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-family:Georgia,serif;font-size:12px;color:#a8a29e;">This message was sent by your clothing store.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const sendOrderConfirmationEmail = async (input: {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
  currency: string;
  items?: { name: string; quantity: number; lineTotal: number }[];
  paymentNote?: string;
  invoicePdf?: Buffer;
}): Promise<void> => {
  const total = money(input.total, input.currency);
  const customerName = escapeHtml(input.customerName);
  const orderNumber = escapeHtml(input.orderNumber);
  const lines = input.items ?? [];
  const text = [
    `Hi ${input.customerName},`,
    "",
    `Your order ${input.orderNumber} is placed.`,
    ...lines.map((item) => `${item.name} x ${item.quantity} — ${money(item.lineTotal, input.currency)}`),
    `Total: ${total}`,
    input.paymentNote ?? "",
    "",
    "We will email you again when it ships.",
  ].filter((line) => line !== undefined).join("\n");

  await sendEmail({
    to: input.to,
    subject: `Order ${input.orderNumber} confirmed`,
    text,
    html: emailLayout({
      title: "Order confirmed",
      preheader: `Order ${input.orderNumber} is confirmed. Total ${total}.`,
      body: `
        <p style="margin:0 0 16px;">Hi ${customerName},</p>
        <p style="margin:0 0 24px;">Your order is placed. We will email you again when it ships.</p>
        ${lines.map((item) => `<p style="margin:0 0 8px;">${escapeHtml(item.name)} × ${item.quantity} — ${escapeHtml(money(item.lineTotal, input.currency))}</p>`).join("")}
        ${input.paymentNote ? `<p style="margin:16px 0;">${escapeHtml(input.paymentNote)}</p>` : ""}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#78716c;">ORDER</p>
              <p style="margin:6px 0 0;font-size:20px;color:#1c1917;">${orderNumber}</p>
            </td>
            <td align="right" style="padding:20px 24px;">
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#78716c;">TOTAL</p>
              <p style="margin:6px 0 0;font-size:20px;color:#1c1917;">${escapeHtml(total)}</p>
            </td>
          </tr>
        </table>`,
    }),
    attachments: input.invoicePdf
      ? [
          {
            filename: `invoice-${input.orderNumber}.pdf`,
            content: input.invoicePdf,
            contentType: "application/pdf",
          },
        ]
      : undefined,
  });
};

export const sendManualPaymentEmail = async (input: {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
  currency: string;
  provider: "BKASH" | "NAGAD";
  walletNumber: string;
}): Promise<void> => {
  const total = money(input.total, input.currency);
  const provider = input.provider === "BKASH" ? "bKash" : "Nagad";
  const text = [
    `Hi ${input.customerName},`,
    "",
    `Order ${input.orderNumber} is waiting for payment.`,
    `Send ${total} to ${provider} ${input.walletNumber}.`,
    "Then submit the transaction id in the app. The order is confirmed after an admin approves it.",
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: `Pay for order ${input.orderNumber}`,
    text,
    html: emailLayout({
      title: `Pay with ${provider}`,
      preheader: `Send ${total} to ${provider} ${input.walletNumber} for order ${input.orderNumber}.`,
      body: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(input.customerName)},</p>
        <p style="margin:0 0 24px;">Send the order total, then submit the transaction id. An admin will confirm the order after checking it.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#78716c;">ORDER</p>
              <p style="margin:6px 0 0;font-size:20px;color:#1c1917;">${escapeHtml(input.orderNumber)}</p>
            </td>
            <td align="right" style="padding:20px 24px;">
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#78716c;">SEND</p>
              <p style="margin:6px 0 0;font-size:20px;color:#1c1917;">${escapeHtml(total)}</p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0 24px 20px;">
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#78716c;">${provider.toUpperCase()} NUMBER</p>
              <p style="margin:6px 0 0;font-size:20px;color:#1c1917;">${escapeHtml(input.walletNumber)}</p>
            </td>
          </tr>
        </table>`,
    }),
  });
};

export const sendPaymentRejectedEmail = async (input: {
  to: string;
  customerName: string;
  orderNumber: string;
  reason: string;
}): Promise<void> => {
  const text = [
    `Hi ${input.customerName},`,
    "",
    `The payment for order ${input.orderNumber} was not approved.`,
    input.reason,
    "",
    "You can submit a new transaction id.",
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: `Payment not approved for ${input.orderNumber}`,
    text,
    html: emailLayout({
      title: "Payment not approved",
      preheader: `The payment for order ${input.orderNumber} was not approved.`,
      body: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(input.customerName)},</p>
        <p style="margin:0 0 16px;">The payment for order ${escapeHtml(input.orderNumber)} was not approved.</p>
        <p style="margin:0 0 16px;">${escapeHtml(input.reason)}</p>
        <p style="margin:0;">You can submit a new transaction id.</p>`,
    }),
  });
};

export const sendOrderShippedEmail = async (input: {
  to: string;
  customerName: string;
  orderNumber: string;
}): Promise<void> => {
  const text = [
    `Hi ${input.customerName},`,
    "",
    `Order ${input.orderNumber} has shipped.`,
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: `Order ${input.orderNumber} shipped`,
    text,
    html: emailLayout({
      title: "Order shipped",
      preheader: `Order ${input.orderNumber} has shipped.`,
      body: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(input.customerName)},</p>
        <p style="margin:0;">Order ${escapeHtml(input.orderNumber)} has shipped.</p>`,
    }),
  });
};

export const sendPasswordResetEmail = async (input: {
  to: string;
  code: string;
  expiresInMinutes?: number;
}): Promise<void> => {
  const minutes = input.expiresInMinutes ?? 30;
  const code = escapeHtml(input.code);
  const text = [
    "We received a request to reset your password.",
    "",
    `Your reset code is ${input.code}`,
    "",
    `This code expires in ${minutes} minutes. If you did not ask for this, you can ignore this email.`,
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: "Your password reset code",
    text,
    html: emailLayout({
      title: "Your reset code",
      preheader: `Your password reset code is ${input.code}. It expires in ${minutes} minutes.`,
      body: `
        <p style="margin:0 0 24px;">We received a request to reset your password. Enter this code in the app. It expires in ${minutes} minutes.</p>
        <p style="margin:0;padding:18px 0;font-size:36px;letter-spacing:10px;text-align:center;color:#1c1917;background:#faf7f2;border-radius:12px;">${code}</p>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#78716c;">If you did not ask for this, you can ignore this email.</p>`,
    }),
  });
};
