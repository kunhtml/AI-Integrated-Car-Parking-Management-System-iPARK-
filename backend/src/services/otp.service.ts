import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { OtpModel } from "../models/otp.model.js";
import { UserModel } from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtpEmail } from "./mail.service.js";
import { signResetToken } from "./token.service.js";

const FORGOT_PASSWORD = "forgot_password" as const;

export async function sendForgotPasswordOtp(email: string, isResend = false) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await UserModel.findOne({ email: normalizedEmail });

  if (!user) {
    throw new AppError("Email không tồn tại trong hệ thống", 404);
  }

  if (isResend) {
    const latestOtp = await OtpModel.findOne({
      email: normalizedEmail,
      purpose: FORGOT_PASSWORD,
    }).sort({ createdAt: -1 });

    if (latestOtp) {
      const secondsFromLastOtp = Math.floor(
        (Date.now() - latestOtp.createdAt.getTime()) / 1000
      );

      if (secondsFromLastOtp < env.otpResendCooldownSeconds) {
        throw new AppError(
          `Vui lòng chờ ${env.otpResendCooldownSeconds - secondsFromLastOtp}s để gửi lại OTP`,
          429
        );
      }
    }
  }

  await OtpModel.updateMany(
    { email: normalizedEmail, purpose: FORGOT_PASSWORD, used: false },
    { used: true }
  );

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, env.bcryptSaltRounds);
  const expiresAt = new Date(Date.now() + env.otpExpiresInMinutes * 60 * 1000);

  await OtpModel.create({
    email: normalizedEmail,
    otpHash,
    purpose: FORGOT_PASSWORD,
    expiresAt,
  });

  await sendOtpEmail(normalizedEmail, otp);

  return {
    email: normalizedEmail,
    expiresInMinutes: env.otpExpiresInMinutes,
    resendAfterSeconds: env.otpResendCooldownSeconds,
  };
}

export async function verifyForgotPasswordOtp(email: string, otp: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const otpRecord = await OtpModel.findOne({
    email: normalizedEmail,
    purpose: FORGOT_PASSWORD,
    used: false,
  })
    .select("+otpHash")
    .sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError("OTP không hợp lệ hoặc đã được sử dụng", 400);
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    otpRecord.used = true;
    await otpRecord.save();
    throw new AppError("OTP đã hết hạn", 400);
  }

  const isValidOtp = await bcrypt.compare(otp, otpRecord.otpHash);

  if (!isValidOtp) {
    throw new AppError("OTP không chính xác", 400);
  }

  otpRecord.verifiedAt = new Date();
  await otpRecord.save();

  const resetToken = await signResetToken({
    email: normalizedEmail,
    purpose: "reset_password",
  });

  return { resetToken };
}

export async function markForgotPasswordOtpsAsUsed(email: string) {
  await OtpModel.updateMany(
    { email: email.toLowerCase().trim(), purpose: FORGOT_PASSWORD, used: false },
    { used: true }
  );
}
