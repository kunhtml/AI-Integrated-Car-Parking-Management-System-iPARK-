/// <reference types="jest" />
/**
 * Unit Tests: Login with Password & Login with Google (googleLogin + googleCallback)
 *
 * Chiến lược mock:
 *  - Mock toàn bộ module User, bcryptjs, token.service, secret.service, env
 *  - Tạo req/res giả để kiểm tra response trả về
 */

import { Request, Response } from "express";

// ─── Mock các module phụ thuộc ────────────────────────────────────────────────

jest.mock("../src/models/User.js", () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("../src/models/OtpToken.js", () => ({
  OtpToken: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn(),
}));

jest.mock("../src/services/token.service.js", () => ({
  signSession: jest.fn().mockResolvedValue("mock_jwt_token"),
}));

jest.mock("../src/services/mail.service.js", () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
  smtpConfigured: jest.fn().mockReturnValue(false),
}));

jest.mock("../src/services/secret.service.js", () => ({
  encryptSecret: jest.fn().mockReturnValue("encrypted"),
  decryptSecret: jest.fn().mockReturnValue("TOTP_SECRET"),
}));

jest.mock("../src/config/env.js", () => ({
  env: {
    jwtSecret: "test_secret",
    jwtExpiresIn: "8h",
    frontendUrl: "http://localhost:3000",
    googleClientId: "google_client_id",
    googleClientSecret: "google_client_secret",
    googleCallbackUrl: "http://localhost:4000/api/auth/google/callback",
    bcryptSaltRounds: 12,
    encryptionKey: "test_encryption_key",
    nodeEnv: "test",
  },
}));

jest.mock("../src/utils/serializers.js", () => ({
  serializeUser: jest.fn((user: any) => ({
    id: user._id?.toString() ?? "user_id",
    name: user.name,
    email: user.email,
    role: user.role,
  })),
}));

jest.mock("node:crypto", () => ({
  randomUUID: jest.fn().mockReturnValue("fixed-uuid-1234"),
}));

// Mock mongoose để dbReady() trả về true
jest.mock("mongoose", () => ({
  connection: { readyState: 1 },
  models: {},
  model: jest.fn(),
  Schema: jest.fn().mockImplementation(() => ({})),
  Types: { ObjectId: jest.fn() },
}));

// ─── Import sau khi mock ───────────────────────────────────────────────────────

import {
  login,
  googleLogin,
  googleCallback,
} from "../src/controllers/auth.controller.js";
import { User } from "../src/models/User.js";
import bcrypt from "bcryptjs";
import { signSession } from "../src/services/token.service.js";
import { decryptSecret } from "../src/services/secret.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    cookies: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockResponse() {
  const res: any = {};
  res._status = 200;
  res._json = null;
  res._cookie = {} as Record<string, string>;
  res._redirectUrl = "";

  res.status = jest.fn().mockImplementation((code: number) => {
    res._status = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((data: any) => {
    res._json = data;
    return res;
  });
  res.cookie = jest.fn().mockImplementation((_name: string, _val: string) => {
    res._cookie[_name] = _val;
    return res;
  });
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockImplementation((url: string) => {
    res._redirectUrl = url;
    return res;
  });

  return res as Response & {
    _status: number;
    _json: any;
    _cookie: Record<string, string>;
    _redirectUrl: string;
  };
}

// ─── Fake user factory ────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, any> = {}): any {
  return {
    _id: { toString: () => "user_id_1" },
    name: "Nguyen Van A",
    email: "test@example.com",
    passwordHash: "hashed_password",
    role: "customer",
    status: "Đang hoạt động",
    twoFactorEnabled: false,
    twoFactorSecret: undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── LOGIN WITH PASSWORD ───────────────────────────────────────────────────────

describe("login (password)", () => {
  const validBody = {
    email: "test@example.com",
    password: "password123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("TC-LOGIN-01: Đăng nhập thành công → trả 200 + cookie + user", async () => {
    const fakeUser = makeUser();
    (User.findOne as jest.Mock).mockResolvedValue(fakeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "password123",
      "hashed_password",
    );
    expect(signSession).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      "parking_session",
      "mock_jwt_token",
      expect.any(Object),
    );
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      user: expect.objectContaining({ email: "test@example.com" }),
    });
  });

  it("TC-LOGIN-02: Email không tồn tại → trả 401", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await login(req, res);

    expect(res._status).toBe(401);
    expect(res._json).toMatchObject({
      message: "Email hoặc mật khẩu không đúng.",
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("TC-LOGIN-03: Tài khoản bị khóa → trả 401", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(
      makeUser({ status: "Đã khóa" }),
    );

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await login(req, res);

    expect(res._status).toBe(401);
    expect(res._json).toMatchObject({
      message: "Email hoặc mật khẩu không đúng.",
    });
  });

  it("TC-LOGIN-04: Sai mật khẩu → trả 401", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(makeUser());
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await login(req, res);

    expect(res._status).toBe(401);
    expect(res._json).toMatchObject({
      message: "Email hoặc mật khẩu không đúng.",
    });
    expect(signSession).not.toHaveBeenCalled();
  });

  it("TC-LOGIN-05: Thiếu email → ném ZodError", async () => {
    const req = mockRequest({ body: { password: "pass123" } });
    const res = mockResponse();

    await expect(login(req, res)).rejects.toThrow();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("TC-LOGIN-06: Thiếu password → ném ZodError", async () => {
    const req = mockRequest({ body: { email: "test@example.com" } });
    const res = mockResponse();

    await expect(login(req, res)).rejects.toThrow();
  });

  it("TC-LOGIN-07: Email không hợp lệ → ném ZodError", async () => {
    const req = mockRequest({
      body: { email: "not-an-email", password: "pass123" },
    });
    const res = mockResponse();

    await expect(login(req, res)).rejects.toThrow();
  });

  it("TC-LOGIN-08: Email được lowercase trước khi tìm kiếm", async () => {
    const fakeUser = makeUser();
    (User.findOne as jest.Mock).mockResolvedValue(fakeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const req = mockRequest({
      body: { email: "TEST@EXAMPLE.COM", password: "password123" },
    });
    const res = mockResponse();

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
  });

  it("TC-LOGIN-09: 2FA bật nhưng không gửi twoFactorCode → trả 202 yêu cầu nhập mã", async () => {
    const fakeUser = makeUser({
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted_secret",
    });
    (User.findOne as jest.Mock).mockResolvedValue(fakeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await login(req, res);

    expect(res._status).toBe(202);
    expect(res._json).toMatchObject({ requiresTwoFactor: true });
    expect(signSession).not.toHaveBeenCalled();
  });

  it("TC-LOGIN-10: 2FA bật + mã đúng → đăng nhập thành công", async () => {
    const fakeUser = makeUser({
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted_secret",
    });
    (User.findOne as jest.Mock).mockResolvedValue(fakeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // verifySync đã được mock qua moduleNameMapper (otplib.js) → mặc định trả { valid: true }
    const req = mockRequest({
      body: { ...validBody, twoFactorCode: "123456" },
    });
    const res = mockResponse();

    await login(req, res);

    expect(decryptSecret).toHaveBeenCalledWith("encrypted_secret");
    expect(signSession).toHaveBeenCalled();
    expect(res._json).toMatchObject({
      user: expect.objectContaining({ email: "test@example.com" }),
    });
  });

  it("TC-LOGIN-11: 2FA bật + mã sai → trả 401", async () => {
    const fakeUser = makeUser({
      twoFactorEnabled: true,
      twoFactorSecret: "encrypted_secret",
    });
    (User.findOne as jest.Mock).mockResolvedValue(fakeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // Override mock verifySync trả về valid = false cho test này
    const otplib = require("otplib");
    otplib.verifySync.mockReturnValueOnce({ valid: false });

    const req = mockRequest({
      body: { ...validBody, twoFactorCode: "000000" },
    });
    const res = mockResponse();

    await login(req, res);

    expect(res._status).toBe(401);
    expect(res._json).toMatchObject({ message: "Mã 2FA không đúng." });
    expect(signSession).not.toHaveBeenCalled();
  });
});

// ─── LOGIN WITH GOOGLE (googleLogin + googleCallback) ─────────────────────────

describe("googleLogin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("TC-GLOGIN-01: Google OAuth chưa cấu hình → trả 503", () => {
    // Tạm thời xóa googleClientId để googleOAuthConfigured() trả false
    const envModule = require("../src/config/env.js");
    const originalClientId = envModule.env.googleClientId;
    const originalClientSecret = envModule.env.googleClientSecret;
    const originalCallbackUrl = envModule.env.googleCallbackUrl;
    envModule.env.googleClientId = "";
    envModule.env.googleClientSecret = "";
    envModule.env.googleCallbackUrl = "";

    const req = mockRequest();
    const res = mockResponse();

    googleLogin(req, res);

    expect(res._status).toBe(503);
    expect(res._json).toMatchObject({
      message: expect.stringContaining("Chưa cấu hình Google OAuth"),
    });

    // Restore
    envModule.env.googleClientId = originalClientId;
    envModule.env.googleClientSecret = originalClientSecret;
    envModule.env.googleCallbackUrl = originalCallbackUrl;
  });

  it("TC-GLOGIN-02: Google OAuth đã cấu hình → set cookie state + redirect đến Google", () => {
    const req = mockRequest();
    const res = mockResponse();

    googleLogin(req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      "google_oauth_state",
      "fixed-uuid-1234",
      expect.any(Object),
    );
    expect(res._redirectUrl).toContain(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(res._redirectUrl).toContain("client_id=google_client_id");
    expect(res._redirectUrl).toContain("state=fixed-uuid-1234");
  });

  it("TC-GLOGIN-03: URL redirect chứa đúng scope và prompt", () => {
    const req = mockRequest();
    const res = mockResponse();

    googleLogin(req, res);

    expect(res._redirectUrl).toContain("scope=openid+email+profile");
    expect(res._redirectUrl).toContain("prompt=select_account");
    expect(res._redirectUrl).toContain("response_type=code");
  });
});

describe("googleCallback (Login with Google)", () => {
  const validState = "valid-state-uuid";

  const validGoogleProfile = {
    sub: "google_sub_123",
    email: "google@example.com",
    email_verified: true,
    name: "Google User",
    picture: "https://example.com/avatar.jpg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    (global as any).fetch = undefined;
  });

  function setupFetchMocks(
    tokenOk = true,
    profileOk = true,
    profileData: object = validGoogleProfile,
  ) {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: tokenOk,
        json: async () =>
          tokenOk
            ? { access_token: "google_access_token" }
            : { error: "invalid_grant" },
      })
      .mockResolvedValueOnce({
        ok: profileOk,
        json: async () => profileData,
      });
  }

  it("TC-GCALLBACK-01: Đăng nhập user đã có tài khoản Google → cập nhật + redirect", async () => {
    setupFetchMocks();

    const existingUser = makeUser({
      email: validGoogleProfile.email,
      provider: "google",
      googleId: validGoogleProfile.sub,
      avatarUrl: validGoogleProfile.picture,
    });
    (User.findOne as jest.Mock).mockResolvedValue(existingUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(User.create).not.toHaveBeenCalled();
    expect(existingUser.save).toHaveBeenCalled();
    expect(signSession).toHaveBeenCalled();
    expect(res._redirectUrl).toBe("http://localhost:3000");
  });

  it("TC-GCALLBACK-02: Đăng nhập user credentials đã có email → link Google + provider=mixed", async () => {
    setupFetchMocks();

    const credUser = makeUser({
      email: validGoogleProfile.email,
      provider: "credentials",
      googleId: undefined,
    });
    (User.findOne as jest.Mock).mockResolvedValue(credUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(credUser.googleId).toBe(validGoogleProfile.sub);
    expect(credUser.provider).toBe("mixed");
    expect(credUser.save).toHaveBeenCalled();
    expect(res._redirectUrl).toBe("http://localhost:3000");
  });

  it("TC-GCALLBACK-03: Tài khoản bị khóa → trả 403", async () => {
    setupFetchMocks();

    (User.findOne as jest.Mock).mockResolvedValue(
      makeUser({ email: validGoogleProfile.email, status: "Đã khóa" }),
    );

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(403);
    expect(res._json).toMatchObject({ message: "Tài khoản đã bị khóa." });
    expect(signSession).not.toHaveBeenCalled();
  });

  it("TC-GCALLBACK-04: State không khớp → trả 400, không gọi Google API", async () => {
    const req = mockRequest({
      query: { code: "auth_code", state: "tampered-state" },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({
      message: expect.stringContaining("không hợp lệ"),
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("TC-GCALLBACK-05: Thiếu code → trả 400", async () => {
    const req = mockRequest({
      query: { state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(400);
  });

  it("TC-GCALLBACK-06: Thiếu cookie state → trả 400", async () => {
    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: {},
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(400);
  });

  it("TC-GCALLBACK-07: Google token API thất bại → trả 502", async () => {
    setupFetchMocks(false, false);

    const req = mockRequest({
      query: { code: "bad_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(502);
    expect(res._json).toMatchObject({
      message: "Không lấy được token Google.",
    });
  });

  it("TC-GCALLBACK-08: Google profile API thất bại → trả 502", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "token" }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(502);
    expect(res._json).toMatchObject({
      message: "Không lấy được email Google đã xác minh.",
    });
  });

  it("TC-GCALLBACK-09: Email Google chưa xác minh → trả 502", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...validGoogleProfile, email_verified: false }),
      });

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(502);
  });

  it("TC-GCALLBACK-10: Sau khi xác thực thành công → xóa cookie google_oauth_state", async () => {
    setupFetchMocks();

    const existingUser = makeUser({
      email: validGoogleProfile.email,
      provider: "google",
    });
    (User.findOne as jest.Mock).mockResolvedValue(existingUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith("google_oauth_state", {
      path: "/",
    });
  });

  it("TC-GCALLBACK-11: Avatar được cập nhật từ Google profile", async () => {
    setupFetchMocks();

    const existingUser = makeUser({
      email: validGoogleProfile.email,
      provider: "google",
      googleId: validGoogleProfile.sub,
      avatarUrl: "https://old-avatar.com/pic.jpg",
    });
    (User.findOne as jest.Mock).mockResolvedValue(existingUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(existingUser.avatarUrl).toBe(validGoogleProfile.picture);
  });
});
