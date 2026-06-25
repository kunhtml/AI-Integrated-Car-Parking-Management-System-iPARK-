import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import type { AuthMode, DemoUser } from "@/types";

type AuthActionsParams = {
  setMode: (mode: AuthMode) => void;
  setCurrentUser: (user: DemoUser | null) => void;
  setAuthError: (error: string) => void;
  setActionLog: (log: string) => void;
  setTwoFactorQr: (qr: string) => void;
};

export function createAuthActions({
  setMode,
  setCurrentUser,
  setAuthError,
  setActionLog,
  setTwoFactorQr,
}: AuthActionsParams) {
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const twoFactorCode = String(form.get("twoFactorCode") ?? "").trim();

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(twoFactorCode ? { twoFactorCode } : {}) }),
      });
      const data = await response.json();
      if (response.status === 202 && data.requiresTwoFactor) {
        setAuthError(data.message || "Vui lòng nhập mã 2FA.");
        return;
      }
      if (!response.ok) {
        setAuthError(data.message || "Không đăng nhập được.");
        return;
      }

      setAuthError("");
      setCurrentUser(data.user);
      setActionLog("Đăng nhập thành công bằng JWT cookie.");
      return data.user;
    } catch {
      setAuthError("Không kết nối được API. Kiểm tra MongoDB local và .env.local.");
      return null;
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const response = await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.message || "Không đăng ký được.");
        return null;
      }

      setAuthError("");
      setCurrentUser(data.user);
      setActionLog("Đăng ký thành công, tài khoản đã lưu MongoDB.");
      return data.user;
    } catch {
      setAuthError("Không kết nối được API. Kiểm tra MongoDB local.");
      return null;
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const otp = String(form.get("otp") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const response = await apiFetch(otp && password ? "/auth/reset-password" : "/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(otp && password ? { email, otp, password } : { email }),
      });
      const data = await response.json();
      setAuthError(data.devOtp ? `${data.message} OTP demo: ${data.devOtp}` : data.message || "Đã xử lý OTP.");
      if (response.ok && otp && password) {
        setMode("login");
      }
    } catch {
      setAuthError("Không kết nối được API OTP.");
    }
  }

  async function logout() {
    window.localStorage.removeItem("ipark_current_user");
    setCurrentUser(null);
    setActionLog("Đã đăng xuất.");
    void apiFetch("/auth/logout", { keepalive: true, method: "POST" }).catch(() => undefined);
    window.location.href = "/";
  }

  async function setupTwoFactor() {
    const response = await apiFetch("/auth/2fa/setup", { method: "POST" });
    const data = await response.json();
    if (response.ok) {
      setTwoFactorQr(data.qrDataUrl);
      setActionLog("Quét QR rồi nhập mã để bật 2FA.");
    } else {
      setActionLog(data.message || "Không tạo được QR 2FA.");
    }
  }

  async function verifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: String(form.get("code") || "") }),
    });
    const data = await response.json();
    if (response.ok) {
      setCurrentUser(data.user);
      setTwoFactorQr("");
      setActionLog("Đã bật 2FA.");
      event.currentTarget.reset();
    } else {
      setActionLog(data.message || "Không xác minh được 2FA.");
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await apiFetch("/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: String(form.get("code") || "") }),
    });
    const data = await response.json();
    if (response.ok) {
      setCurrentUser(data.user);
      setActionLog("Đã tắt 2FA.");
      event.currentTarget.reset();
    } else {
      setActionLog(data.message || "Không tắt được 2FA.");
    }
  }

  return {
    handleLogin,
    handleRegister,
    handleForgotPassword,
    logout,
    setupTwoFactor,
    verifyTwoFactor,
    disableTwoFactor,
  };
}
