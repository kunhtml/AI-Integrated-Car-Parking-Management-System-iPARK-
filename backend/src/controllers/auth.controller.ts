import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { OtpToken } from "../models/OtpToken.js";
import { User } from "../models/User.js";
import { sendMail, smtpConfigured } from "../services/mail.service.js";
import { signSession } from "../services/token.service.js";
import { serializeUser } from "../utils/serializers.js";

const cookieName = "parking_session";
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function rejectInvalidOtp(
  token: { _id: mongoose.Types.ObjectId },
  response: Response,
  status: number,
) {
  const updated = await OtpToken.findOneAndUpdate(
    {
      _id: token._id,
      usedAt: { $exists: false },
      attempts: { $lt: OTP_MAX_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { new: true },
  );
  if (!updated || updated.attempts >= OTP_MAX_ATTEMPTS) {
    await OtpToken.deleteOne({ _id: token._id });
    response
      .status(status)
      .json({
        message:
          "M├ú OTP ─æ├ú bß╗ï v├┤ hiß╗çu h├│a do nhß║¡p sai qu├í nhiß╗üu lß║ºn.",
      });
    return;
  }
  response
    .status(status)
    .json({ message: "M├ú OTP kh├┤ng ─æ├║ng hoß║╖c ─æ├ú hß║┐t hß║ín." });
}

async function enforceOtpCooldown(email: string, response: Response) {
  const latest = await OtpToken.findOne({ email, purpose: "two-factor" }).sort({
    createdAt: -1,
  });
  if (!latest) return false;
  const retryAfter = Math.ceil(
    (latest.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000,
  );
  if (retryAfter <= 0) return false;
  response
    .status(429)
    .json({
      message:
        "Vui l├▓ng chß╗¥ " +
        retryAfter +
        " gi├óy tr╞░ß╗¢c khi gß╗¡i lß║íi OTP.",
      retryAfter,
    });
  return true;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8 * 1000,
    path: "/",
  };
}

function googleOAuthConfigured() {
  return Boolean(
    env.googleClientId && env.googleClientSecret && env.googleCallbackUrl,
  );
}

const pendingUserSchema = z
  .object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(6),
  })
  .strict();

/**
 * Bước 1 đăng ký: validate, hash mật khẩu, lưu payload vào OtpToken (purpose=verify-email)
 * và gửi OTP qua email. KHÔNG tạo user ở bước này.
 */
export async function register(request: Request, response: Response) {
  const body = pendingUserSchema.parse(request.body);

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chưa được cấu hình. Vui lòng liên hệ quản trị viên để hoàn tất đăng ký.",
    });
    return;
  }

  const email = body.email.toLowerCase();
  const existed = await User.findOne({ email });
  if (existed) {
    response.status(409).json({ message: "Email đã tồn tại." });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);

  // Xoá OTP verify-email cu (neu co) truoc khi tao moi
  await OtpToken.deleteMany({ email, purpose: "verify-email" });

  await OtpToken.create({
    email,
    otpHash,
    purpose: "verify-email",
    pendingUser: {
      name: body.name,
      passwordHash,
    },
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendMail(
    email,
    "Mã OTP xác nhận đăng ký tài khoản iPARK",
    `Mã OTP xác nhận đăng ký tài khoản iPARK của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.`,
  );

  response.status(202).json({
    requiresOtp: true,
    message:
      "Đã gửi mã OTP xác nhận đến email. Vui lòng kiểm tra hộp thư và nhập mã để hoàn tất đăng ký.",
  });
}

/**
 * Bước 2 đăng ký: xác minh OTP, tạo user, đánh dấu verified và tự động đăng nhập.
 */
export async function verifyEmailOtp(request: Request, response: Response) {
  const body = z
    .object({
      email: z.email(),
      otp: z.string().min(6).max(6),
    })
    .parse(request.body);

  const email = body.email.toLowerCase();
  const token = await OtpToken.findOne({
    email,
    purpose: "verify-email",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!token || !(await bcrypt.compare(body.otp, token.otpHash))) {
    response
      .status(400)
      .json({ message: "OTP không đúng hoặc đã hết hạn." });
    return;
  }

  if (!token.pendingUser) {
    response.status(400).json({
      message:
        "Không tìm thấy thông tin đăng ký. Vui lòng đăng ký lại.",
    });
    return;
  }

  // Tranh user tao cung luc
  const existed = await User.findOne({ email });
  if (existed) {
    response.status(409).json({ message: "Email đã tồn tại." });
    return;
  }

  const pending = token.pendingUser as {
    name: string;
    passwordHash: string;
    phone?: string;
  };

  const user = await User.create({
    name: pending.name,
    email,
    passwordHash: pending.passwordHash,
    role: "customer",
    phone: pending.phone,
    isVerified: true,
    provider: "credentials",
  });

  token.usedAt = new Date();
  await token.save();

  const serialized = serializeUser(user);
  const sessionToken = await signSession(serialized);
  await recordActiveSession(request, user._id);

  const { notifyRegistration } =
    await import("../services/notificationTriggers.service.js");
  await notifyRegistration(user._id.toString(), user.name);

  response.cookie(cookieName, sessionToken, cookieOptions()).status(201).json({
    user: serialized,
    message: "Đăng ký thành công. Tài khoản đã được xác minh.",
  });
}

/**
 * Gửi lại OTP xác nhận email (purpose=verify-email). Chỉ dùng khi chưa có user.
 */
export async function resendVerificationOtp(
  request: Request,
  response: Response,
) {
  const body = z.object({ email: z.email() }).parse(request.body);
  const email = body.email.toLowerCase();

  if (!smtpConfigured()) {
    response.status(503).json({
      message: "SMTP chưa được cấu hình. Không thể gửi lại OTP.",
    });
    return;
  }

  const existing = await OtpToken.findOne({
    email,
    purpose: "verify-email",
    usedAt: { $exists: false },
  }).sort({ createdAt: -1 });

  if (!existing) {
    response.status(404).json({
      message:
        "Không có yêu cầu đăng ký nào đang chờ. Vui lòng đăng ký lại.",
    });
    return;
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    response.status(409).json({ message: "Email đã được đăng ký." });
    return;
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);

  // Tao OTP moi va vo hieu hoa OTP cu
  await OtpToken.updateMany(
    { email, purpose: "verify-email", usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
  );
  await OtpToken.create({
    email,
    otpHash,
    purpose: "verify-email",
    pendingUser: existing.pendingUser,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendMail(
    email,
    "Mã OTP xác nhận đăng ký tài khoản iPARK (gửi lại)",
    `Mã OTP mới của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
  );

  response.json({
    ok: true,
    message: "Đã gửi lại mã OTP xác nhận đến email.",
  });
}

export async function login(request: Request, response: Response) {
  const body = z
    .object({
      email: z.email(),
      password: z.string().min(1),
    })
    .parse(request.body);

  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user || user.status === "Đã khóa") {
    response.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
    return;
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    response.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
    return;
  }

  // Chan dang nhap neu email chua xac minh (chi ap dung voi tai khoan credentials)
  if (!user.isVerified && user.provider === "credentials") {
    response.status(403).json({
      requiresEmailVerification: true,
      email: user.email,
      message:
        "Email chưa được xác minh. Vui lòng nhập mã OTP đã gửi đến email để kích hoạt tài khoản.",
    });
    return;
  }

  if (user.twoFactorEnabled) {
    if (!smtpConfigured()) {
      response.status(503).json({
        message:
          "SMTP chưa được cấu hình. Không thể gửi mã 2FA qua email.",
      });
      return;
    }

    // Sinh OTP 6 số, lưu OtpToken(purpose=two-factor) và gửi về email
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 12);
    const token = await OtpToken.create({
      email: user.email,
      otpHash,
      purpose: "two-factor",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendMail(
      user.email,
      "Mã xác thực 2 lớp (2FA) iPARK",
      `Mã xác thực 2 lớp iPARK của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.`,
    );

    response.status(202).json({
      requiresTwoFactor: true,
      pendingTwoFactorId: token._id.toString(),
      email: user.email,
      message:
        "Mật khẩu đúng. Vui lòng nhập mã 6 số đã được gửi đến email để hoàn tất đăng nhập.",
    });
    return;
  }

  const serialized = serializeUser(user);
  const token = await signSession(serialized);
  await recordActiveSession(request, user._id);
  // Cập nhật lastLoginAt (ghi vào DB; nếu chỉ set trong serializeUser thì không persist)
  user.lastLoginAt = new Date();
  await user.save();

  response
    .cookie(cookieName, token, cookieOptions())
    .json({ user: serialized });
}

export function googleLogin(_request: Request, response: Response) {
  if (!googleOAuthConfigured()) {
    response.status(503).json({
      message:
        "Chưa cấu hình Google OAuth. Vui lòng bổ sung GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và GOOGLE_CALLBACK_URL trong backend/.env.",
    });
    return;
  }

  const state = randomUUID();
  const searchParams = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleCallbackUrl,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });

  response
    .cookie("google_oauth_state", state, {
      ...cookieOptions(),
      maxAge: 10 * 60 * 1000,
    })
    .redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`,
    );
}

export async function googleCallback(request: Request, response: Response) {
  if (!googleOAuthConfigured()) {
    response.status(503).json({
      message:
        "Chưa cấu hình Google OAuth. Vui lòng bổ sung GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và GOOGLE_CALLBACK_URL trong backend/.env.",
    });
    return;
  }

  const code = String(request.query.code || "");
  const state = String(request.query.state || "");
  const expectedState = request.cookies?.google_oauth_state;

  if (!code || !state || !expectedState || state !== expectedState) {
    response.status(400).json({
      message:
        "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.",
    });
    return;
  }

  response.clearCookie("google_oauth_state", { path: "/" });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleCallbackUrl,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenResponse.ok || !tokenData.access_token) {
    response
      .status(502)
      .json({ message: "Không lấy được token Google." });
    return;
  }

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (
    !profileResponse.ok ||
    !profile.sub ||
    !profile.email ||
    !profile.email_verified
  ) {
    response
      .status(502)
      .json({ message: "Không lấy được email Google đã xác minh." });
    return;
  }

  const email = profile.email.toLowerCase();
  let user = await User.findOne({
    $or: [{ googleId: profile.sub }, { email }],
  });

  if (user?.status === "Đã khóa") {
    response.status(403).json({ message: "Tài khoản đã bị khóa." });
    return;
  }

  if (user) {
    user.googleId = profile.sub;
    user.avatarUrl = profile.picture || user.avatarUrl;
    user.provider = user.provider === "credentials" ? "mixed" : user.provider;
    await user.save();
  } else {
    const passwordHash = await bcrypt.hash(randomUUID(), 12);
    user = await User.create({
      name: profile.name || email,
      email,
      passwordHash,
      role: "customer",
      provider: "google",
      googleId: profile.sub,
      avatarUrl: profile.picture,
    });
  }

  const serialized = serializeUser(user);
  const token = await signSession(serialized);
  await recordActiveSession(request, user._id);
  user.lastLoginAt = new Date();
  await user.save();
  response.cookie(cookieName, token, cookieOptions()).redirect(env.frontendUrl);
}

/**
 * Tạo ActiveSession record mỗi lần login thành công.
 * TTL index trên expiresAt sẽ tự xoá khi quá hạn.
 */
async function recordActiveSession(
  request: Request,
  userId: mongoose.Types.ObjectId,
): Promise<void> {
  const expiresAt = new Date(Date.now() + cookieOptions().maxAge);
  const uaHeader = request.headers["user-agent"];
  const userAgent = (Array.isArray(uaHeader) ? uaHeader[0] : uaHeader) ?? null;
  await ActiveSession.create({
    userId,
    userAgent,
    ipAddress: request.ip ?? null,
    expiresAt,
    isRevoked: false,
  });
}

export async function forgotPassword(request: Request, response: Response) {
  const body = z.object({ email: z.email() }).parse(request.body);
  const email = body.email.toLowerCase();
  const user = await User.findOne({ email });

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chưa được cấu hình. Không thể gửi OTP đặt lại mật khẩu.",
    });
    return;
  }

  if (user) {
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 12);
    await OtpToken.create({
      email,
      otpHash,
      purpose: "reset-password",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendMail(
      email,
      "Mã OTP đặt lại mật khẩu iPARK",
      `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
    );
  }

  response.json({
    ok: true,
    message:
      "Nếu email tồn tại, hệ thống đã gửi OTP đặt lại mật khẩu.",
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
    response
      .status(400)
      .json({ message: "OTP không đúng hoặc đã hết hạn." });
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

export async function setupTwoFactor(request: Request, response: Response) {
  const user = await User.findById(request.user?.id);
  if (!user) {
    response
      .status(401)
      .json({ message: "Bạn cần đăng nhập để bật 2FA." });
    return;
  }

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chưa được cấu hình. Không thể gửi mã 2FA qua email.",
    });
    return;
  }

  // Sinh OTP 6 số, lưu OtpToken(purpose=two-factor) và gửi về email để xác nhận bật
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const token = await OtpToken.create({
    email: user.email,
    otpHash,
    purpose: "two-factor",
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendMail(
    user.email,
    "Mã xác nhận bật xác thực 2 lớp (2FA) iPARK",
    `Mã xác nhận bật 2FA iPARK của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.`,
  );

  response.json({
    setupTwoFactorId: token._id.toString(),
    email: user.email,
    message:
      "Đã gửi mã xác nhận 6 số về email. Vui lòng nhập mã để hoàn tất bật 2FA.",
  });
}

export async function verifyTwoFactor(request: Request, response: Response) {
  const body = z
    .object({
      setupTwoFactorId: z.string().min(1),
      code: z.string().min(6).max(6),
    })
    .parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user) {
    response
      .status(401)
      .json({ message: "Bạn cần đăng nhập để bật 2FA." });
    return;
  }

  const token = await OtpToken.findOne({
    _id: body.setupTwoFactorId,
    email: user.email,
    purpose: "two-factor",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!token || !(await bcrypt.compare(body.code, token.otpHash))) {
    response
      .status(400)
      .json({ message: "Mã 2FA không đúng hoặc đã hết hạn." });
    return;
  }

  token.usedAt = new Date();
  user.twoFactorEnabled = true;
  await Promise.all([user.save(), token.save()]);

  response.json({ user: serializeUser(user), message: "Đã bật 2FA." });
}

export async function resendTwoFactorOtp(request: Request, response: Response) {
  const body = z
    .object({ setupTwoFactorId: z.string().optional() })
    .parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user) {
    response.status(401).json({ message: "Bạn cần đăng nhập." });
    return;
  }

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chưa được cấu hình. Không thể gửi lại mã 2FA.",
    });
    return;
  }

  // Vô hiệu hoá các OtpToken two-factor cũ cùng user
  await OtpToken.updateMany(
    { email: user.email, purpose: "two-factor", usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
  );

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const token = await OtpToken.create({
    email: user.email,
    otpHash,
    purpose: "two-factor",
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendMail(
    user.email,
    "Mã xác thực 2 lớp (2FA) iPARK (gửi lại)",
    `Mã 2FA mới của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
  );

  response.json({
    setupTwoFactorId: token._id.toString(),
    message: "Đã gửi lại mã 2FA. Vui lòng kiểm tra email.",
  });
}

export async function disableTwoFactor(request: Request, response: Response) {
  const body = z.object({ code: z.string().min(6).max(6) }).parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user) {
    response
      .status(401)
      .json({ message: "Bạn cần đăng nhập để tắt 2FA." });
    return;
  }

  if (!user.twoFactorEnabled) {
    response.status(400).json({ message: "2FA chưa được bật." });
    return;
  }

  // Lấy OTP mới nhất (chưa dùng, còn hạn) thuộc user này
  const token = await OtpToken.findOne({
    email: user.email,
    purpose: "two-factor",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!token) {
    response.status(400).json({
      message:
        "Chưa có mã 2FA nào được gửi. Vui lòng bấm 'Gửi mã' trước.",
    });
    return;
  }

  if (!(await bcrypt.compare(body.code, token.otpHash))) {
    response.status(400).json({ message: "Mã 2FA không đúng." });
    return;
  }

  token.usedAt = new Date();
  user.twoFactorEnabled = false;
  await Promise.all([user.save(), token.save()]);

  response.json({ user: serializeUser(user), message: "Đã tắt 2FA." });
}

export async function requestDisableTwoFactor(
  request: Request,
  response: Response,
) {
  const user = await User.findById(request.user?.id);
  if (!user) {
    response
      .status(401)
      .json({ message: "Bạn cần đăng nhập để tắt 2FA." });
    return;
  }

  if (!user.twoFactorEnabled) {
    response.status(400).json({ message: "2FA chưa được bật." });
    return;
  }

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chưa được cấu hình. Không thể gửi mã 2FA qua email.",
    });
    return;
  }

  await OtpToken.updateMany(
    { email: user.email, purpose: "two-factor", usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
  );

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const token = await OtpToken.create({
    email: user.email,
    otpHash,
    purpose: "two-factor",
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendMail(
    user.email,
    "Mã xác nhận tắt xác thực 2 lớp (2FA) iPARK",
    `Mã xác nhận tắt 2FA iPARK của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.`,
  );

  response.json({
    disableTwoFactorId: token._id.toString(),
    message:
      "Đã gửi mã xác nhận 6 số về email. Vui lòng nhập mã để hoàn tất tắt 2FA.",
  });
}

/**
 * Bước 2 của login flow: xác minh OTP 2FA và cấp session cookie.
 * Client gửi pendingTwoFactorId (lấy từ response 202 của /auth/login) + code 6 số.
 */
export async function verifyLoginTwoFactor(
  request: Request,
  response: Response,
) {
  const body = z
    .object({
      pendingTwoFactorId: z.string().min(1),
      code: z.string().min(6).max(6),
    })
    .parse(request.body);

  const otpToken = await OtpToken.findOne({
    _id: body.pendingTwoFactorId,
    purpose: "two-factor",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!otpToken || !(await bcrypt.compare(body.code, otpToken.otpHash))) {
    response
      .status(401)
      .json({ message: "Mã 2FA không đúng hoặc đã hết hạn." });
    return;
  }

  const user = await User.findOne({ email: otpToken.email });
  if (!user || user.status === "Đã khóa") {
    response
      .status(401)
      .json({
        message: "Tài khoản không tồn tại hoặc đã bị khóa.",
      });
    return;
  }

  otpToken.usedAt = new Date();
  user.lastLoginAt = new Date();
  await Promise.all([otpToken.save(), user.save()]);

  const serialized = serializeUser(user);
  const sessionToken = await signSession(serialized);
  await recordActiveSession(request, user._id);

  response.cookie(cookieName, sessionToken, cookieOptions()).json({
    user: serialized,
    message: "ĐĒng nhập thành công.",
  });
}

export function logout(_request: Request, response: Response) {
  response.clearCookie(cookieName, { path: "/" }).json({ ok: true });
}

export async function me(request: Request, response: Response) {
  if (!request.user?.id) {
    response.json({ user: null });
    return;
  }
  // Đọc từ DB để có dữ liệu mới nhất (vd: cập nhật status sau khi đăng nhập).
  const user = await User.findById(request.user.id);
  response.json({ user: user ? serializeUser(user) : request.user });
}

export async function changePassword(request: Request, response: Response) {
  const body = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    })
    .parse(request.body);

  const user = await User.findById(request.user?.id);
  if (!user) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!valid) {
    response
      .status(400)
      .json({ message: "Mật khẩu hiện tại không đúng." });
    return;
  }

  user.passwordHash = await bcrypt.hash(body.newPassword, 12);
  await user.save();
  response.json({ ok: true, message: "Đã thay đổi mật khẩu." });
}

const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .min(2, "Họ tên phải có ít nhất 2 ký tự")
      .max(100)
      .optional(),
    // Email KHÔNG được đổi qua endpoint này nữa — dùng /request-change-email + /verify-change-email
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{6,20}$/, "Số điện thoại không hợp lệ")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    avatarUrl: z
      .string()
      .url("URL ảnh không hợp lệ")
      .max(2_000_000)
      .optional(),
  })
  .strict();

export async function updateProfile(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  const parsed = profileUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    response
      .status(400)
      .json({ message: issue?.message ?? "Dữ liệu không hợp lệ." });
    return;
  }
  const body = parsed.data;

  const user = await User.findById(userId);
  if (!user) {
    response.status(404).json({ message: "Không tìm thấy tài khoản." });
    return;
  }

  // Phone uniqueness check
  if (body.phone && body.phone !== user.phone) {
    const existed = await User.findOne({
      phone: body.phone,
      _id: { $ne: user._id },
    });
    if (existed) {
      response
        .status(409)
        .json({ message: "Số điện thoại đã được sử dụng." });
      return;
    }
    user.phone = body.phone;
  }

  if (typeof body.name === "string") user.name = body.name.trim();
  if (typeof body.avatarUrl === "string" && body.avatarUrl)
    user.avatarUrl = body.avatarUrl;

  await user.save();

  const serialized = serializeUser(user);
  const token = await signSession(serialized);
  response
    .cookie(cookieName, token, cookieOptions())
    .json({ user: serialized, message: "Đã cập nhật hồ sơ." });
}

export async function resendOtp(request: Request, response: Response) {
  const body = z.object({ email: z.email() }).parse(request.body);
  const email = body.email.toLowerCase();
  const user = await User.findOne({ email });

  if (!smtpConfigured()) {
    response.status(503).json({
      message: "SMTP chưa được cấu hình. Không thể gửi lại OTP.",
    });
    return;
  }

  if (user) {
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 12);
    await OtpToken.create({
      email,
      otpHash,
      purpose: "reset-password",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendMail(
      email,
      "Mã OTP đặt lại mật khẩu iPARK (gửi lại)",
      `Mã OTP mới của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
    );
  }

  response.json({ ok: true, message: "Đã gửi lại OTP." });
}

// --- Active Sessions Management (AU-14) ---
import { ActiveSession } from "../models/ActiveSession.js";

/**
 * Bước 1 đổi email: user đang đăng nhập gửi email mới → backend kiểm tra tính hợp lệ,
 * gửi OTP 6 số đến EMAIL MỚI để xác minh.
 */
export async function requestChangeEmail(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  const body = z
    .object({ newEmail: z.email({ message: "Email không hợp lệ." }) })
    .parse(request.body);
  const newEmail = body.newEmail.toLowerCase();

  if (!smtpConfigured()) {
    response
      .status(503)
      .json({
        message:
          "SMTP chưa được cấu hình. Không thể gửi OTP xác minh email.",
      });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    response.status(404).json({ message: "Không tìm thấy tài khoản." });
    return;
  }

  // Không đổi nếu email mới giống email hiện tại
  if (newEmail === user.email) {
    response
      .status(400)
      .json({ message: "Email mới phải khác email hiện tại." });
    return;
  }

  // Kiểm tra email mới có bị trùng không
  const existed = await User.findOne({
    email: newEmail,
    _id: { $ne: user._id },
  });
  if (existed) {
    response
      .status(409)
      .json({
        message:
          "Email này đã được sử dụng bởi tài khoản khác.",
      });
    return;
  }

  // Xoá các OTP change-email cũ chưa dùng của user này
  await OtpToken.updateMany(
    { email: user.email, purpose: "change-email", usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
  );

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const token = await OtpToken.create({
    email: user.email, // lưu email hiện tại để tìm lại token
    newEmail, // email mới cần xác minh
    otpHash,
    purpose: "change-email",
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendMail(
    newEmail,
    "Mã OTP xác nhận đổi email iPARK",
    `Mã OTP xác nhận đổi email iPARK của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.`,
  );

  response.json({
    changeEmailTokenId: token._id.toString(),
    message:
      "Đã gửi mã OTP 6 số đến email mới. Vui lòng kiểm tra hộp thư và nhập mã để xác nhận.",
  });
}

/**
 * Bước 2 đổi email: xác minh OTP gửi đến email mới → cập nhật email trong DB.
 */
export async function verifyChangeEmail(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  const body = z
    .object({
      changeEmailTokenId: z.string().min(1),
      otp: z.string().min(6).max(6),
    })
    .parse(request.body);

  const user = await User.findById(userId);
  if (!user) {
    response.status(404).json({ message: "Không tìm thấy tài khoản." });
    return;
  }

  const token = await OtpToken.findOne({
    _id: body.changeEmailTokenId,
    email: user.email,
    purpose: "change-email",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!token || !(await bcrypt.compare(body.otp, token.otpHash))) {
    response
      .status(400)
      .json({ message: "OTP không đúng hoặc đã hết hạn." });
    return;
  }

  const newEmail = token.newEmail!;

  // Kiểm tra lại email mới vẫn chưa bị dùng (race condition)
  const existed = await User.findOne({
    email: newEmail,
    _id: { $ne: user._id },
  });
  if (existed) {
    response
      .status(409)
      .json({
        message:
          "Email này đã được sử dụng bởi tài khoản khác.",
      });
    return;
  }

  user.email = newEmail;
  token.usedAt = new Date();
  await Promise.all([user.save(), token.save()]);

  const serialized = serializeUser(user);
  // Cập nhật cookie session với email mới
  const sessionToken = await signSession(serialized);
  response
    .cookie(cookieName, sessionToken, cookieOptions())
    .json({
      user: serialized,
      message: "Đã cập nhật email thành công.",
    });
}

export async function listActiveSessions(request: Request, response: Response) {
  const sessions = await ActiveSession.find({
    userId: request.user?.id,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).sort({ lastActiveAt: -1 });

  response.json({
    sessions: sessions.map((s) => ({
      id: s._id.toString(),
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      loginAt: s.loginAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    })),
  });
}

export async function revokeSession(request: Request, response: Response) {
  const sessionId = String(request.params.id);
  const session = await ActiveSession.findOne({
    _id: sessionId,
    userId: request.user?.id,
  });
  if (!session) {
    response.status(404).json({ message: "Phiên không tồn tại." });
    return;
  }
  session.isRevoked = true;
  await session.save();
  response.json({ ok: true, message: "Đã thu hồi phiên đăng nhập." });
}

export async function revokeAllSessions(request: Request, response: Response) {
  await ActiveSession.updateMany(
    { userId: request.user?.id, isRevoked: false },
    { $set: { isRevoked: true } },
  );
  response.json({
    ok: true,
    message: "Đã thu hồi tất cả phiên đăng nhập.",
  });
}
