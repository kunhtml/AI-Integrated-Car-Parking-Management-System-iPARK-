import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { OtpToken } from "../models/OtpToken.js";
import { sendMail, smtpConfigured } from "../services/mail.service.js";

const cookieName = "parking_session";

export async function forgotPassword(request: Request, response: Response) {
  const body = z.object({ email: z.email() }).parse(request.body);
  const email = body.email.toLowerCase();
  const user = await User.findOne({ email });
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  if (user) {
    const otpHash = await bcrypt.hash(otp, 12);
    await OtpToken.create({
      email,
      otpHash,
      purpose: "reset-password",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendMail(
      email,
      "Mã OTP đặt lại mật khẩu iPARK",
      `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
    );
  }

  response.json({
    ok: true,
    message: smtpConfigured()
      ? "Nếu email tồn tại, hệ thống đã gửi OTP đặt lại mật khẩu."
      : "SMTP chưa cấu hình, OTP demo được trả trong phản hồi.",
    ...(smtpConfigured() || !user ? {} : { devOtp: otp }),
  });
}

export async function resetPassword(request: Request, response: Response) {
  const body = z
    .object({
      email: z.email(),
      otp: z.string().min(6).max(6),
      password: z.string().min(6),
    })
    .parse(request.body);

  const email = body.email.toLowerCase();
  const token = await OtpToken.findOne({
    email,
    purpose: "reset-password",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!token || !(await bcrypt.compare(body.otp, token.otpHash))) {
    response.status(400).json({ message: "OTP không đúng hoặc đã hết hạn." });
    return;
  }

  const user = await User.findOne({ email });
  if (!user) {
    response.status(404).json({ message: "Không tìm thấy tài khoản." });
    return;
  }

  user.passwordHash = await bcrypt.hash(body.password, 12);
  user.provider = user.provider === "google" ? "mixed" : user.provider;
  token.usedAt = new Date();
  await Promise.all([user.save(), token.save()]);

  response.json({ ok: true, message: "Đã đặt lại mật khẩu." });
}

export function logout(_request: Request, response: Response) {
  response.clearCookie(cookieName, { path: "/" }).json({ ok: true });
}