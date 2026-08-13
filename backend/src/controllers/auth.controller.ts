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
 * BÆ°á»›c 1 Ä‘Äƒng kÃ½: validate, hash máº­t kháº©u, lÆ°u payload vÃ o OtpToken (purpose=verify-email)
 * vÃ  gá»­i OTP qua email. KHÃ”NG táº¡o user á»Ÿ bÆ°á»›c nÃ y.
 */
export async function register(request: Request, response: Response) {
  const body = pendingUserSchema.parse(request.body);

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. Vui lÃ²ng liÃªn há»‡ quáº£n trá»‹ viÃªn Ä‘á»ƒ hoÃ n táº¥t Ä‘Äƒng kÃ½.",
    });
    return;
  }

  const email = body.email.toLowerCase();
  const existed = await User.findOne({ email });
  if (existed) {
    response.status(409).json({ message: "Email Ä‘Ã£ tá»“n táº¡i." });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);

  // XoÃ¡ OTP verify-email cu (neu co) truoc khi tao moi
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
    "MÃ£ OTP xÃ¡c nháº­n Ä‘Äƒng kÃ½ tÃ i khoáº£n iPARK",
    `MÃ£ OTP xÃ¡c nháº­n Ä‘Äƒng kÃ½ tÃ i khoáº£n iPARK cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt. Náº¿u báº¡n khÃ´ng thá»±c hiá»‡n yÃªu cáº§u nÃ y, vui lÃ²ng bá» qua email.`,
  );

  response.status(202).json({
    requiresOtp: true,
    message:
      "ÄÃ£ gá»­i mÃ£ OTP xÃ¡c nháº­n Ä‘áº¿n email. Vui lÃ²ng kiá»ƒm tra há»™p thÆ° vÃ  nháº­p mÃ£ Ä‘á»ƒ hoÃ n táº¥t Ä‘Äƒng kÃ½.",
  });
}

/**
 * BÆ°á»›c 2 Ä‘Äƒng kÃ½: xÃ¡c minh OTP, táº¡o user, Ä‘Ã¡nh dáº¥u verified vÃ  tá»± Ä‘á»™ng Ä‘Äƒng nháº­p.
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
        "KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin Ä‘Äƒng kÃ½. Vui lÃ²ng Ä‘Äƒng kÃ½ láº¡i.",
    });
    return;
  }

  // Tranh user tao cung luc
  const existed = await User.findOne({ email });
  if (existed) {
    response.status(409).json({ message: "Email Ä‘Ã£ tá»“n táº¡i." });
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
    message: "ÄÄƒng kÃ½ thÃ nh cÃ´ng. TÃ i khoáº£n Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c minh.",
  });
}

/**
 * Gá»­i láº¡i OTP xÃ¡c nháº­n email (purpose=verify-email). Chá»‰ dÃ¹ng khi chÆ°a cÃ³ user.
 */
export async function resendVerificationOtp(
  request: Request,
  response: Response,
) {
  const body = z.object({ email: z.email() }).parse(request.body);
  const email = body.email.toLowerCase();

  if (!smtpConfigured()) {
    response.status(503).json({
      message: "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. KhÃ´ng thá»ƒ gá»­i láº¡i OTP.",
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
        "KhÃ´ng cÃ³ yÃªu cáº§u Ä‘Äƒng kÃ½ nÃ o Ä‘ang chá». Vui lÃ²ng Ä‘Äƒng kÃ½ láº¡i.",
    });
    return;
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    response.status(409).json({ message: "Email Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½." });
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
    "MÃ£ OTP xÃ¡c nháº­n Ä‘Äƒng kÃ½ tÃ i khoáº£n iPARK (gá»­i láº¡i)",
    `MÃ£ OTP má»›i cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt.`,
  );

  response.json({
    ok: true,
    message: "ÄÃ£ gá»­i láº¡i mÃ£ OTP xÃ¡c nháº­n Ä‘áº¿n email.",
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
        "Email chÆ°a Ä‘Æ°á»£c xÃ¡c minh. Vui lÃ²ng nháº­p mÃ£ OTP Ä‘Ã£ gá»­i Ä‘áº¿n email Ä‘á»ƒ kÃ­ch hoáº¡t tÃ i khoáº£n.",
    });
    return;
  }

  if (user.twoFactorEnabled) {
    if (!smtpConfigured()) {
      response.status(503).json({
        message:
          "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. KhÃ´ng thá»ƒ gá»­i mÃ£ 2FA qua email.",
      });
      return;
    }

    // Sinh OTP 6 sá»‘, lÆ°u OtpToken(purpose=two-factor) vÃ  gá»­i vá» email
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
      "MÃ£ xÃ¡c thá»±c 2 lá»›p (2FA) iPARK",
      `MÃ£ xÃ¡c thá»±c 2 lá»›p iPARK cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt. Náº¿u báº¡n khÃ´ng thá»±c hiá»‡n yÃªu cáº§u nÃ y, vui lÃ²ng bá» qua email.`,
    );

    response.status(202).json({
      requiresTwoFactor: true,
      pendingTwoFactorId: token._id.toString(),
      email: user.email,
      message:
        "Máº­t kháº©u Ä‘Ãºng. Vui lÃ²ng nháº­p mÃ£ 6 sá»‘ Ä‘Ã£ Ä‘Æ°á»£c gá»­i Ä‘áº¿n email Ä‘á»ƒ hoÃ n táº¥t Ä‘Äƒng nháº­p.",
    });
    return;
  }

  const serialized = serializeUser(user);
  const token = await signSession(serialized);
  await recordActiveSession(request, user._id);
  // Cáº­p nháº­t lastLoginAt (ghi vÃ o DB; náº¿u chá»‰ set trong serializeUser thÃ¬ khÃ´ng persist)
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
        "ChÆ°a cáº¥u hÃ¬nh Google OAuth. Vui lÃ²ng bá»• sung GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET vÃ  GOOGLE_CALLBACK_URL trong backend/.env.",
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
        "ChÆ°a cáº¥u hÃ¬nh Google OAuth. Vui lÃ²ng bá»• sung GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET vÃ  GOOGLE_CALLBACK_URL trong backend/.env.",
    });
    return;
  }

  const code = String(request.query.code || "");
  const state = String(request.query.state || "");
  const expectedState = request.cookies?.google_oauth_state;

  if (!code || !state || !expectedState || state !== expectedState) {
    response.status(400).json({
      message:
        "PhiÃªn Ä‘Äƒng nháº­p Google khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.",
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
      .json({ message: "KhÃ´ng láº¥y Ä‘Æ°á»£c token Google." });
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
      .json({ message: "KhÃ´ng láº¥y Ä‘Æ°á»£c email Google Ä‘Ã£ xÃ¡c minh." });
    return;
  }

  const email = profile.email.toLowerCase();
  let user = await User.findOne({
    $or: [{ googleId: profile.sub }, { email }],
  });

  if (user?.status === "Đã khóa") {
    response.status(403).json({ message: "TÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a." });
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
 * Táº¡o ActiveSession record má»—i láº§n login thÃ nh cÃ´ng.
 * TTL index trÃªn expiresAt sáº½ tá»± xoÃ¡ khi quÃ¡ háº¡n.
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

  response.json({ ok: true, message: "ÄÃ£ Ä‘áº·t láº¡i máº­t kháº©u." });
}

export async function setupTwoFactor(request: Request, response: Response) {
  const user = await User.findById(request.user?.id);
  if (!user) {
    response
      .status(401)
      .json({ message: "Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ báº­t 2FA." });
    return;
  }

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. KhÃ´ng thá»ƒ gá»­i mÃ£ 2FA qua email.",
    });
    return;
  }

  // Sinh OTP 6 sá»‘, lÆ°u OtpToken(purpose=two-factor) vÃ  gá»­i vá» email Ä‘á»ƒ xÃ¡c nháº­n báº­t
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
    "MÃ£ xÃ¡c nháº­n báº­t xÃ¡c thá»±c 2 lá»›p (2FA) iPARK",
    `MÃ£ xÃ¡c nháº­n báº­t 2FA iPARK cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt. Náº¿u báº¡n khÃ´ng thá»±c hiá»‡n yÃªu cáº§u nÃ y, vui lÃ²ng bá» qua email.`,
  );

  response.json({
    setupTwoFactorId: token._id.toString(),
    email: user.email,
    message:
      "ÄÃ£ gá»­i mÃ£ xÃ¡c nháº­n 6 sá»‘ vá» email. Vui lÃ²ng nháº­p mÃ£ Ä‘á»ƒ hoÃ n táº¥t báº­t 2FA.",
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
      .json({ message: "Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ báº­t 2FA." });
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
      .json({ message: "MÃ£ 2FA khÃ´ng Ä‘Ãºng hoáº·c Ä‘Ã£ háº¿t háº¡n." });
    return;
  }

  token.usedAt = new Date();
  user.twoFactorEnabled = true;
  await Promise.all([user.save(), token.save()]);

  response.json({ user: serializeUser(user), message: "ÄÃ£ báº­t 2FA." });
}

export async function resendTwoFactorOtp(request: Request, response: Response) {
  const body = z
    .object({ setupTwoFactorId: z.string().optional() })
    .parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user) {
    response.status(401).json({ message: "Báº¡n cáº§n Ä‘Äƒng nháº­p." });
    return;
  }

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. KhÃ´ng thá»ƒ gá»­i láº¡i mÃ£ 2FA.",
    });
    return;
  }

  // VÃ´ hiá»‡u hoÃ¡ cÃ¡c OtpToken two-factor cÅ© cÃ¹ng user
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
    "MÃ£ xÃ¡c thá»±c 2 lá»›p (2FA) iPARK (gá»­i láº¡i)",
    `MÃ£ 2FA má»›i cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt.`,
  );

  response.json({
    setupTwoFactorId: token._id.toString(),
    message: "ÄÃ£ gá»­i láº¡i mÃ£ 2FA. Vui lÃ²ng kiá»ƒm tra email.",
  });
}

export async function disableTwoFactor(request: Request, response: Response) {
  const body = z.object({ code: z.string().min(6).max(6) }).parse(request.body);
  const user = await User.findById(request.user?.id);
  if (!user) {
    response
      .status(401)
      .json({ message: "Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ táº¯t 2FA." });
    return;
  }

  if (!user.twoFactorEnabled) {
    response.status(400).json({ message: "2FA chÆ°a Ä‘Æ°á»£c báº­t." });
    return;
  }

  // Láº¥y OTP má»›i nháº¥t (chÆ°a dÃ¹ng, cÃ²n háº¡n) thuá»™c user nÃ y
  const token = await OtpToken.findOne({
    email: user.email,
    purpose: "two-factor",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!token) {
    response.status(400).json({
      message:
        "ChÆ°a cÃ³ mÃ£ 2FA nÃ o Ä‘Æ°á»£c gá»­i. Vui lÃ²ng báº¥m 'Gá»­i mÃ£' trÆ°á»›c.",
    });
    return;
  }

  if (!(await bcrypt.compare(body.code, token.otpHash))) {
    response.status(400).json({ message: "MÃ£ 2FA khÃ´ng Ä‘Ãºng." });
    return;
  }

  token.usedAt = new Date();
  user.twoFactorEnabled = false;
  await Promise.all([user.save(), token.save()]);

  response.json({ user: serializeUser(user), message: "ÄÃ£ táº¯t 2FA." });
}

export async function requestDisableTwoFactor(
  request: Request,
  response: Response,
) {
  const user = await User.findById(request.user?.id);
  if (!user) {
    response
      .status(401)
      .json({ message: "Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ táº¯t 2FA." });
    return;
  }

  if (!user.twoFactorEnabled) {
    response.status(400).json({ message: "2FA chÆ°a Ä‘Æ°á»£c báº­t." });
    return;
  }

  if (!smtpConfigured()) {
    response.status(503).json({
      message:
        "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. KhÃ´ng thá»ƒ gá»­i mÃ£ 2FA qua email.",
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
    "MÃ£ xÃ¡c nháº­n táº¯t xÃ¡c thá»±c 2 lá»›p (2FA) iPARK",
    `MÃ£ xÃ¡c nháº­n táº¯t 2FA iPARK cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt. Náº¿u báº¡n khÃ´ng thá»±c hiá»‡n yÃªu cáº§u nÃ y, vui lÃ²ng bá» qua email.`,
  );

  response.json({
    disableTwoFactorId: token._id.toString(),
    message:
      "ÄÃ£ gá»­i mÃ£ xÃ¡c nháº­n 6 sá»‘ vá» email. Vui lÃ²ng nháº­p mÃ£ Ä‘á»ƒ hoÃ n táº¥t táº¯t 2FA.",
  });
}

/**
 * BÆ°á»›c 2 cá»§a login flow: xÃ¡c minh OTP 2FA vÃ  cáº¥p session cookie.
 * Client gá»­i pendingTwoFactorId (láº¥y tá»« response 202 cá»§a /auth/login) + code 6 sá»‘.
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
      .json({ message: "MÃ£ 2FA khÃ´ng Ä‘Ãºng hoáº·c Ä‘Ã£ háº¿t háº¡n." });
    return;
  }

  const user = await User.findOne({ email: otpToken.email });
  if (!user || user.status === "Đã khóa") {
    response
      .status(401)
      .json({
        message: "TÃ i khoáº£n khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ khÃ³a.",
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
    message: "ÄÄƒng nháº­p thÃ nh cÃ´ng.",
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
  // Äá»c tá»« DB Ä‘á»ƒ cÃ³ dá»¯ liá»‡u má»›i nháº¥t (vd: cáº­p nháº­t status sau khi Ä‘Äƒng nháº­p).
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
    response.status(401).json({ message: "ChÆ°a Ä‘Äƒng nháº­p." });
    return;
  }

  const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!valid) {
    response
      .status(400)
      .json({ message: "Máº­t kháº©u hiá»‡n táº¡i khÃ´ng Ä‘Ãºng." });
    return;
  }

  user.passwordHash = await bcrypt.hash(body.newPassword, 12);
  await user.save();
  response.json({ ok: true, message: "ÄÃ£ thay Ä‘á»•i máº­t kháº©u." });
}

const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .min(2, "Há» tÃªn pháº£i cÃ³ Ã­t nháº¥t 2 kÃ½ tá»±")
      .max(100)
      .optional(),
    // Email KHÃ”NG Ä‘Æ°á»£c Ä‘á»•i qua endpoint nÃ y ná»¯a â€” dÃ¹ng /request-change-email + /verify-change-email
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{6,20}$/, "Sá»‘ Ä‘iá»‡n thoáº¡i khÃ´ng há»£p lá»‡")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    avatarUrl: z
      .string()
      .url("URL áº£nh khÃ´ng há»£p lá»‡")
      .max(2_000_000)
      .optional(),
  })
  .strict();

export async function updateProfile(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "ChÆ°a Ä‘Äƒng nháº­p." });
    return;
  }

  const parsed = profileUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    response
      .status(400)
      .json({ message: issue?.message ?? "Dá»¯ liá»‡u khÃ´ng há»£p lá»‡." });
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
        .json({ message: "Sá»‘ Ä‘iá»‡n thoáº¡i Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng." });
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
    .json({ user: serialized, message: "ÄÃ£ cáº­p nháº­t há»“ sÆ¡." });
}

export async function resendOtp(request: Request, response: Response) {
  const body = z.object({ email: z.email() }).parse(request.body);
  const email = body.email.toLowerCase();
  const user = await User.findOne({ email });

  if (!smtpConfigured()) {
    response.status(503).json({
      message: "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. KhÃ´ng thá»ƒ gá»­i láº¡i OTP.",
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
      "Mã OTP đặt lại mật khẩu iPARK (gá»­i láº¡i)",
      `MÃ£ OTP má»›i cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt.`,
    );
  }

  response.json({ ok: true, message: "ÄÃ£ gá»­i láº¡i OTP." });
}

// --- Active Sessions Management (AU-14) ---
import { ActiveSession } from "../models/ActiveSession.js";

/**
 * BÆ°á»›c 1 Ä‘á»•i email: user Ä‘ang Ä‘Äƒng nháº­p gá»­i email má»›i â†’ backend kiá»ƒm tra tÃ­nh há»£p lá»‡,
 * gá»­i OTP 6 sá»‘ Ä‘áº¿n EMAIL Má»šI Ä‘á»ƒ xÃ¡c minh.
 */
export async function requestChangeEmail(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "ChÆ°a Ä‘Äƒng nháº­p." });
    return;
  }

  const body = z
    .object({ newEmail: z.email({ message: "Email khÃ´ng há»£p lá»‡." }) })
    .parse(request.body);
  const newEmail = body.newEmail.toLowerCase();

  if (!smtpConfigured()) {
    response
      .status(503)
      .json({
        message:
          "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh. KhÃ´ng thá»ƒ gá»­i OTP xÃ¡c minh email.",
      });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    response.status(404).json({ message: "Không tìm thấy tài khoản." });
    return;
  }

  // KhÃ´ng Ä‘á»•i náº¿u email má»›i giá»‘ng email hiá»‡n táº¡i
  if (newEmail === user.email) {
    response
      .status(400)
      .json({ message: "Email má»›i pháº£i khÃ¡c email hiá»‡n táº¡i." });
    return;
  }

  // Kiá»ƒm tra email má»›i cÃ³ bá»‹ trÃ¹ng khÃ´ng
  const existed = await User.findOne({
    email: newEmail,
    _id: { $ne: user._id },
  });
  if (existed) {
    response
      .status(409)
      .json({
        message:
          "Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi tÃ i khoáº£n khÃ¡c.",
      });
    return;
  }

  // XoÃ¡ cÃ¡c OTP change-email cÅ© chÆ°a dÃ¹ng cá»§a user nÃ y
  await OtpToken.updateMany(
    { email: user.email, purpose: "change-email", usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
  );

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const token = await OtpToken.create({
    email: user.email, // lÆ°u email hiá»‡n táº¡i Ä‘á»ƒ tÃ¬m láº¡i token
    newEmail, // email má»›i cáº§n xÃ¡c minh
    otpHash,
    purpose: "change-email",
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendMail(
    newEmail,
    "MÃ£ OTP xÃ¡c nháº­n Ä‘á»•i email iPARK",
    `MÃ£ OTP xÃ¡c nháº­n Ä‘á»•i email iPARK cá»§a báº¡n lÃ  ${otp}. MÃ£ cÃ³ hiá»‡u lá»±c trong 5 phÃºt. Náº¿u báº¡n khÃ´ng thá»±c hiá»‡n yÃªu cáº§u nÃ y, vui lÃ²ng bá» qua email nÃ y.`,
  );

  response.json({
    changeEmailTokenId: token._id.toString(),
    message:
      "ÄÃ£ gá»­i mÃ£ OTP 6 sá»‘ Ä‘áº¿n email má»›i. Vui lÃ²ng kiá»ƒm tra há»™p thÆ° vÃ  nháº­p mÃ£ Ä‘á»ƒ xÃ¡c nháº­n.",
  });
}

/**
 * BÆ°á»›c 2 Ä‘á»•i email: xÃ¡c minh OTP gá»­i Ä‘áº¿n email má»›i â†’ cáº­p nháº­t email trong DB.
 */
export async function verifyChangeEmail(request: Request, response: Response) {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "ChÆ°a Ä‘Äƒng nháº­p." });
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

  // Kiá»ƒm tra láº¡i email má»›i váº«n chÆ°a bá»‹ dÃ¹ng (race condition)
  const existed = await User.findOne({
    email: newEmail,
    _id: { $ne: user._id },
  });
  if (existed) {
    response
      .status(409)
      .json({
        message:
          "Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi tÃ i khoáº£n khÃ¡c.",
      });
    return;
  }

  user.email = newEmail;
  token.usedAt = new Date();
  await Promise.all([user.save(), token.save()]);

  const serialized = serializeUser(user);
  // Cáº­p nháº­t cookie session vá»›i email má»›i
  const sessionToken = await signSession(serialized);
  response
    .cookie(cookieName, sessionToken, cookieOptions())
    .json({
      user: serialized,
      message: "ÄÃ£ cáº­p nháº­t email thÃ nh cÃ´ng.",
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
    response.status(404).json({ message: "PhiÃªn khÃ´ng tá»“n táº¡i." });
    return;
  }
  session.isRevoked = true;
  await session.save();
  response.json({ ok: true, message: "ÄÃ£ thu há»“i phiÃªn Ä‘Äƒng nháº­p." });
}

export async function revokeAllSessions(request: Request, response: Response) {
  await ActiveSession.updateMany(
    { userId: request.user?.id, isRevoked: false },
    { $set: { isRevoked: true } },
  );
  response.json({
    ok: true,
    message: "ÄÃ£ thu há»“i táº¥t cáº£ phiÃªn Ä‘Äƒng nháº­p.",
  });
}
