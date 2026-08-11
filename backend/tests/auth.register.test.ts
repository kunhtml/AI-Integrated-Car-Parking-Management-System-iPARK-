/// <reference types="jest" />
/**
 * Unit Tests: Register with Password & Register with Google (googleCallback)
 *
 * Chiến lược mock:
 *  - Mock toàn bộ module User, OtpToken, bcryptjs, token.service, mail.service, secret.service
 *  - Tạo req/res giả (mockRequest / mockResponse) để kiểm tra response trả về
 */

import { Request, Response } from "express";

// ─── Mock các module phụ thuộc ────────────────────────────────────────────────

jest.mock("../src/models/User.js", () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
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
  decryptSecret: jest.fn().mockReturnValue("decrypted"),
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

// Mock node:crypto để state luôn cố định
jest.mock("node:crypto", () => ({
  randomUUID: jest.fn().mockReturnValue("fixed-uuid-1234"),
}));

// ─── Import sau khi mock ───────────────────────────────────────────────────────

import { register, googleCallback } from "../src/controllers/auth.controller.js";
import { User } from "../src/models/User.js";
import bcrypt from "bcryptjs";
import { signSession } from "../src/services/token.service.js";

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

function mockResponse(): Response & {
  _status: number;
  _json: any;
  _cookie: Record<string, any>;
  _redirectUrl: string;
} {
  const res: any = {};
  res._status = 200;
  res._json = null;
  res._cookie = {};
  res._redirectUrl = "";

  res.status = jest.fn().mockImplementation((code: number) => {
    res._status = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((data: any) => {
    res._json = data;
    return res;
  });
  res.cookie = jest
    .fn()
    .mockImplementation((_name: string, _val: string, _opts: any) => {
      res._cookie[_name] = _val;
      return res;
    });
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockImplementation((url: string) => {
    res._redirectUrl = url;
    return res;
  });

  return res;
}

// ─── REGISTER WITH PASSWORD ────────────────────────────────────────────────────

describe("register (password)", () => {
  const validBody = {
    name: "Nguyen Van A",
    email: "test@example.com",
    password: "Password123!",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("TC-REG-01: Đăng ký thành công → trả 201 + cookie + user", async () => {
    const fakeUser = {
      _id: { toString: () => "user_id_1" },
      name: validBody.name,
      email: validBody.email,
      role: "customer",
    };

    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockResolvedValue(fakeUser);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await register(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(bcrypt.hash).toHaveBeenCalledWith("Password123!", 12);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: validBody.name,
        email: "test@example.com",
        role: "customer",
      }),
    );
    expect(signSession).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      "parking_session",
      "mock_jwt_token",
      expect.any(Object),
    );
    expect(res._status).toBe(201);
    expect(res._json).toMatchObject({
      user: expect.objectContaining({ email: "test@example.com" }),
    });
  });

  it("TC-REG-02: Email đã tồn tại → trả 409", async () => {
    (User.findOne as jest.Mock).mockResolvedValue({ email: validBody.email });

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await register(req, res);

    expect(res._status).toBe(409);
    expect(res._json).toMatchObject({ message: "Email đã tồn tại." });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("TC-REG-03: Thiếu trường name → ném ZodError (không gọi DB)", async () => {
    const req = mockRequest({
      body: { email: "test@example.com", password: "Password123!" },
    });
    const res = mockResponse();

    await expect(register(req, res)).rejects.toThrow();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("TC-REG-04: Email không hợp lệ → ném ZodError", async () => {
    const req = mockRequest({
      body: { name: "Test", email: "not-an-email", password: "Password123!" },
    });
    const res = mockResponse();

    await expect(register(req, res)).rejects.toThrow();
  });

  it("TC-REG-05: Password quá ngắn (< 6 ký tự) → ném ZodError", async () => {
    const req = mockRequest({
      body: { name: "Test", email: "test@example.com", password: "123" },
    });
    const res = mockResponse();

    await expect(register(req, res)).rejects.toThrow();
  });

  it("TC-REG-06: Email được lowercase trước khi lưu", async () => {
    const fakeUser = {
      _id: { toString: () => "user_id_2" },
      name: "Test",
      email: "test@example.com",
      role: "customer",
    };

    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockResolvedValue(fakeUser);

    const req = mockRequest({
      body: { name: "Test", email: "TEST@EXAMPLE.COM", password: "Password123!" },
    });
    const res = mockResponse();

    await register(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("TC-REG-07: Password được hash với bcrypt trước khi lưu", async () => {
    const fakeUser = {
      _id: { toString: () => "user_id_3" },
      name: "Test",
      email: "test@example.com",
      role: "customer",
    };

    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockResolvedValue(fakeUser);

    const req = mockRequest({
      body: { name: "Test", email: "test@example.com", password: "Password123!" },
    });
    const res = mockResponse();

    await register(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("Password123!", 12);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "hashed_password" }),
    );
  });

  it("TC-REG-08: Role mặc định là customer", async () => {
    const fakeUser = {
      _id: { toString: () => "user_id_4" },
      name: "Test",
      email: "test@example.com",
      role: "customer",
    };

    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockResolvedValue(fakeUser);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await register(req, res);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: "customer" }),
    );
  });
});

// ─── REGISTER WITH GOOGLE (googleCallback) ────────────────────────────────────

describe("googleCallback (Register/Login with Google)", () => {
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

    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterAll(() => {
    // Restore fetch
    (global as any).fetch = undefined;
  });

  function setupFetchMocks(
    tokenOk = true,
    profileOk = true,
    profileData = validGoogleProfile,
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

  it("TC-GOOGLE-01: Đăng ký mới qua Google thành công → tạo user + redirect", async () => {
    setupFetchMocks();
    (User.findOne as jest.Mock).mockResolvedValue(null);

    const newUser = {
      _id: { toString: () => "new_google_user" },
      name: validGoogleProfile.name,
      email: validGoogleProfile.email,
      role: "customer",
      provider: "google",
      googleId: validGoogleProfile.sub,
      avatarUrl: validGoogleProfile.picture,
    };
    (User.create as jest.Mock).mockResolvedValue(newUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: validGoogleProfile.email,
        provider: "google",
        googleId: validGoogleProfile.sub,
      }),
    );
    expect(signSession).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      "parking_session",
      "mock_jwt_token",
      expect.any(Object),
    );
    expect(res._redirectUrl).toBe("http://localhost:3000");
  });

  it("TC-GOOGLE-02: User đã tồn tại → cập nhật googleId + redirect (không tạo mới)", async () => {
    setupFetchMocks();

    const existingUser = {
      _id: { toString: () => "existing_user" },
      name: "Existing User",
      email: validGoogleProfile.email,
      role: "customer",
      provider: "credentials",
      googleId: undefined,
      avatarUrl: undefined,
      status: "Đang hoạt động",
      save: jest.fn().mockResolvedValue(undefined),
    };
    (User.findOne as jest.Mock).mockResolvedValue(existingUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(User.create).not.toHaveBeenCalled();
    expect(existingUser.save).toHaveBeenCalled();
    expect(existingUser.googleId).toBe(validGoogleProfile.sub);
    expect(existingUser.provider).toBe("mixed");
    expect(res._redirectUrl).toBe("http://localhost:3000");
  });

  it("TC-GOOGLE-03: State không khớp → trả 400", async () => {
    const req = mockRequest({
      query: { code: "auth_code", state: "wrong-state" },
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

  it("TC-GOOGLE-04: Thiếu code → trả 400", async () => {
    const req = mockRequest({
      query: { state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(400);
  });

  it("TC-GOOGLE-05: Google token API lỗi → trả 502", async () => {
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

  it("TC-GOOGLE-06: Google profile API lỗi → trả 502", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "google_access_token" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

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

  it("TC-GOOGLE-07: Email Google chưa xác minh → trả 502", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "google_access_token" }),
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

  it("TC-GOOGLE-08: Tài khoản bị khóa → trả 403", async () => {
    setupFetchMocks();

    const lockedUser = {
      _id: { toString: () => "locked_user" },
      email: validGoogleProfile.email,
      status: "Đã khóa",
    };
    (User.findOne as jest.Mock).mockResolvedValue(lockedUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    expect(res._status).toBe(403);
    expect(res._json).toMatchObject({ message: "Tài khoản đã bị khóa." });
  });

  it("TC-GOOGLE-09: User mới → password hash ngẫu nhiên (không dùng password thật)", async () => {
    setupFetchMocks();
    (User.findOne as jest.Mock).mockResolvedValue(null);

    const newUser = {
      _id: { toString: () => "new_user" },
      name: validGoogleProfile.name,
      email: validGoogleProfile.email,
      role: "customer",
      provider: "google",
      googleId: validGoogleProfile.sub,
    };
    (User.create as jest.Mock).mockResolvedValue(newUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    // bcrypt.hash được gọi với randomUUID() làm "password" giả
    expect(bcrypt.hash).toHaveBeenCalledWith("fixed-uuid-1234", 12);
  });

  it("TC-GOOGLE-10: User đã có provider=google → provider giữ nguyên là google", async () => {
    setupFetchMocks();

    const existingGoogleUser = {
      _id: { toString: () => "google_user" },
      email: validGoogleProfile.email,
      status: "Đang hoạt động",
      provider: "google",
      googleId: validGoogleProfile.sub,
      avatarUrl: validGoogleProfile.picture,
      save: jest.fn().mockResolvedValue(undefined),
    };
    (User.findOne as jest.Mock).mockResolvedValue(existingGoogleUser);

    const req = mockRequest({
      query: { code: "auth_code", state: validState },
      cookies: { google_oauth_state: validState },
    });
    const res = mockResponse();

    await googleCallback(req, res);

    // provider không phải "credentials" nên không đổi thành "mixed"
    expect(existingGoogleUser.provider).toBe("google");
    expect(res._redirectUrl).toBe("http://localhost:3000");
  });
});
