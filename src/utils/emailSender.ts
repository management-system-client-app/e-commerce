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

export const sendOrderConfirmationEmail = async (input: {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
  currency: string;
  invoicePdf?: Buffer;
}): Promise<void> => {
  const total = money(input.total, input.currency);
  const customerName = escapeHtml(input.customerName);
  const orderNumber = escapeHtml(input.orderNumber);
  const text = [
    `Hi ${input.customerName},`,
    "",
    `Your order ${input.orderNumber} is confirmed.`,
    `Total: ${total}`,
    "",
    "We will email you again when it ships.",
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: `Order ${input.orderNumber} confirmed`,
    text,
    html: `<p>Hi ${customerName},</p><p>Your order <strong>${orderNumber}</strong> is confirmed.</p><p>Total: <strong>${escapeHtml(total)}</strong></p><p>We will email you again when it ships.</p>`,
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

export const sendPasswordResetEmail = async (input: {
  to: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<void> => {
  const minutes = input.expiresInMinutes ?? 30;
  const text = [
    "We received a request to reset your password.",
    "",
    `Reset it here: ${input.resetUrl}`,
    "",
    `This link expires in ${minutes} minutes. If you did not ask for this, you can ignore this email.`,
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject: "Reset your password",
    text,
    html: `<p>We received a request to reset your password.</p><p><a href="${escapeHtml(input.resetUrl)}">Reset your password</a></p><p>This link expires in ${minutes} minutes. If you did not ask for this, you can ignore this email.</p>`,
  });
};
