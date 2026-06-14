import nodemailer from "nodemailer";
import { env } from "./env.js";

export const mailTransporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth:
    env.smtp.user && env.smtp.pass
      ? {
          user: env.smtp.user,
          pass: env.smtp.pass,
        }
      : undefined,
});
