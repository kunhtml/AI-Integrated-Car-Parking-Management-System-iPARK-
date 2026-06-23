import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export function smtpConfigured() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
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
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  console.log(`[Mail] Sent email to ${to}: ${subject}`);
  return { sent: true };
}

export async function sendOtpEmail(to: string, otp: string) {
  await sendMail(to, "Mã OTP iPARK", `Mã OTP của bạn là ${otp}`);
}
