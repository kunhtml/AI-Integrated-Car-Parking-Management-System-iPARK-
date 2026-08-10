import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { env } from "../config/env.js";
import { OtpToken } from "../models/OtpToken.js";
import { User } from "../models/User.js";
import { sendMail, smtpConfigured } from "../services/mail.service.js";
import { decryptSecret, encryptSecret } from "../services/secret.service.js";
import { signSession } from "../services/token.service.js";
import { serializeUser } from "../utils/serializers.js";

const cookieName = "parking_session";

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
  return Boolean(env.googleClientId && env.googleClientSecret && env.googleCallbackUrl);
}

export async function register(request: Request, response: Response) {
  const body = z
    .object({
      name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
      email: z.email({ message: "Email không hợp lệ" }),
      password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
      phone: z.string().min(10, "Số điện thoại không hợp lệ").optional(),
      acceptTerms: z.boolean().refine((val) => val === true, {
        message: "Bạn phải đồng ý với điều khoản sử dụng",
      }),
    })
    .parse(request.body);

  const email = body.email.toLowerCase();
  const existed = await User.findOne({ email });
  if (existed) {
    response.status(409).json({ message: "Email đã tồn tại." });
    return;
  }

  // Check phone uniqueness if provided
  if (body.phone) {
    const phoneExisted = await User.findOne({ phone: body.phone });
    if (phoneExisted) {
      response.status(409).json({ message: "Số điện thoại đã được sử dụng." });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await User.create({
    name: body.name,
    email,
    passwordHash,
    role: "customer",
    phone: body.phone,
    isVerified: false,
  });

  const serialized = serializeUser(user);
  const token = await signSession(serialized);
  await recordActiveSession(request, user._id);

  // CU-22: Notify on registration
  const { notifyRegistration } = await import("../services/notificationTriggers.service.js");
  await notifyRegistration(user._id.toString(), user.name);

  response.cookie(cookieName, token, cookieOptions()).status(201).json({ user: serialized });
}

export async function login(request: Request, response: Response) {
  const body = z
    .object({
      email: z.email(),
      password: z.string().min(1),
      twoFactorCode: z.string().optional(),
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

  if (user.twoFactorEnabled) {
    if (!body.twoFactorCode || !user.twoFactorSecret) {
      response.status(202).json({ requiresTwoFactor: true, message: "Vui lòng nhập mã 2FA." });
      return;
    }

    const secret = decryptSecret(user.twoFactorSecret);
    const validCode = verifySync({ token: body.twoFactorCode, secret }).valid;
    if (!validCode) {
      response.status(401).json({ message: "Mã 2FA không đúng." });
      return;
    }
  }

  const serialized = serializeUser(user);
  const token = await signSession(serialized);
  await recordActiveSession(request, user._id);
  // Cập nhật lastLoginAt (ghi vào DB; nếu chỉ set trong serializeUser thì không persist)
  user.lastLoginAt = new Date();
  await user.save();

  response.cookie(cookieName, token, cookieOptions()).json({ user: serialized });
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
    .cookie("google_oauth_state", state, { ...cookieOptions(), maxAge: 10 * 60 * 1000 })
    .redirect(`https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`);
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
    response.status(400).json({ message: "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn." });
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
  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };

  if (!tokenResponse.ok || !tokenData.access_token) {
    response.status(502).json({ message: "Không lấy được token Google." });
    return;
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profileResponse.ok || !profile.sub || !profile.email || !profile.email_verified) {
    response.status(502).json({ message: "Không lấy được email Google đã xác minh." });
    return;
  }

  const email = profile.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] });

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

export async function setupTwoFactor(request: Request, response: Response) {
  const user = await User.findById(request.user?.id);
  if (!user || user.role !== "admin") {
    response.status(403).json({ message: "Chỉ admin được bật 2FA." });
    return;
  }

  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: env.totpIssuer, label: user.email, secret });
  user.twoFactorPendingSecret = encryptSecret(secret);
  await user.save();

  response.json({
    otpauthUrl,
    qrDataUrl: await QRCode.toDataURL(otpauthUrl),
    message: "Quét QR bằng app xác thực, sau đó nhập mã để xác minh.",
  });
}

export async function verifyTwoFactor(request: Request, response: Response) {
  const body = z.object({ code: z.string().min(6).max(6) }).parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user || user.role !== "admin" || !user.twoFactorPendingSecret) {
    response.status(400).json({ message: "Chưa có phiên thiết lập 2FA." });
    return;
  }

  const secret = decryptSecret(user.twoFactorPendingSecret);
  if (!verifySync({ token: body.code, secret }).valid) {
    response.status(400).json({ message: "Mã 2FA không đúng." });
    return;
  }

  user.twoFactorSecret = user.twoFactorPendingSecret;
  user.twoFactorPendingSecret = undefined;
  user.twoFactorEnabled = true;
  await user.save();

  response.json({ user: serializeUser(user), message: "Đã bật 2FA." });
}

export async function disableTwoFactor(request: Request, response: Response) {
  const body = z.object({ code: z.string().optional() }).parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user || user.role !== "admin") {
    response.status(403).json({ message: "Chỉ admin được tắt 2FA." });
    return;
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!body.code || !verifySync({ token: body.code, secret: decryptSecret(user.twoFactorSecret) }).valid) {
      response.status(400).json({ message: "Mã 2FA không đúng." });
      return;
    }
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.twoFactorPendingSecret = undefined;
  await user.save();

  response.json({ user: serializeUser(user), message: "Đã tắt 2FA." });
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
    response.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
    return;
  }

  user.passwordHash = await bcrypt.hash(body.newPassword, 12);
  await user.save();
  response.json({ ok: true, message: "Đã thay đổi mật khẩu." });
}

const profileUpdateSchema = z
  .object({
    name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự").max(100).optional(),
    email: z.email({ message: "Email không hợp lệ" }).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{6,20}$/, "Số điện thoại không hợp lệ")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    avatarUrl: z.string().url("URL ảnh không hợp lệ").max(2_000_000).optional(),
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
    response.status(400).json({ message: issue?.message ?? "Dữ liệu không hợp lệ." });
    return;
  }
  const body = parsed.data;

  const user = await User.findById(userId);
  if (!user) {
    response.status(404).json({ message: "Không tìm thấy tài khoản." });
    return;
  }

  // Email uniqueness check
  if (body.email && body.email.toLowerCase() !== user.email) {
    const existed = await User.findOne({ email: body.email.toLowerCase(), _id: { $ne: user._id } });
    if (existed) {
      response.status(409).json({ message: "Email đã được sử dụng." });
      return;
    }
    user.email = body.email.toLowerCase();
  }

  // Phone uniqueness check
  if (body.phone && body.phone !== user.phone) {
    const existed = await User.findOne({ phone: body.phone, _id: { $ne: user._id } });
    if (existed) {
      response.status(409).json({ message: "Số điện thoại đã được sử dụng." });
      return;
    }
    user.phone = body.phone;
  }

  if (typeof body.name === "string") user.name = body.name.trim();
  if (typeof body.avatarUrl === "string" && body.avatarUrl) user.avatarUrl = body.avatarUrl;

  await user.save();

  const serialized = serializeUser(user);
  // Cập nhật cookie session nếu email/role đổi
  const token = await signSession(serialized);
  response.cookie(cookieName, token, cookieOptions()).json({ user: serialized, message: "Đã cập nhật hồ sơ." });
}

export async function resendOtp(request: Request, response: Response) {
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
      "Mã OTP đặt lại mật khẩu iPARK (gửi lại)",
      `Mã OTP mới của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
    );
  }

  response.json({
    ok: true,
    message: smtpConfigured()
      ? "Đã gửi lại OTP."
      : "SMTP chưa cấu hình, OTP demo trong phản hồi.",
    ...(smtpConfigured() || !user ? {} : { devOtp: otp }),
  });
}

// --- Active Sessions Management (AU-14) ---
import { ActiveSession } from "../models/ActiveSession.js";

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
  response.json({ ok: true, message: "Đã thu hồi tất cả phiên đăng nhập." });
}
