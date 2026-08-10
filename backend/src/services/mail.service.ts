import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export function smtpConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  html?: string,
) {
  if (!smtpConfigured()) {
    console.warn("[Mail] SMTP not configured, skipping email to:", to);
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  console.log(`[Mail] Sent email to ${to}: ${subject}`);
  return { sent: true };
}
