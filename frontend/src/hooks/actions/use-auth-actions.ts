import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import { showError, showInfo, showSuccess } from "@/lib/toast";
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
        showInfo(data.message || "Vui lòng nhập mã 2FA.");
        setAuthError(data.message || "Vui lòng nhập mã 2FA.");
        return;
      }
      if (!response.ok) {
        showError(data.message || "Không đăng nhập được.");
        setAuthError(data.message || "Không đăng nhập được.");
        return;
      }

      setAuthError("");
      setCurrentUser(data.user);
      showSuccess("Đăng nhập thành công!");
      return data.user;
    } catch {
      showError("Không kết nối được server. Kiểm tra backend.");
      setAuthError("Không kết nối được server.");
      return null;
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const phone = String(form.get("phone") ?? "").trim() || undefined;
    const gender = String(form.get("gender") ?? "") || undefined;
    const birthDate = String(form.get("birthDate") ?? "") || undefined;
    const address = String(form.get("address") ?? "").trim() || undefined;
    const city = String(form.get("city") ?? "").trim() || undefined;
    const district = String(form.get("district") ?? "").trim() || undefined;
    const company = String(form.get("company") ?? "").trim() || undefined;
    const taxCode = String(form.get("taxCode") ?? "").trim() || undefined;
    const acceptTerms = form.get("acceptTerms") === "on";

    // Validation
    if (!name || name.length < 2) {
      showError("Họ tên phải có ít nhất 2 ký tự.");
      setAuthError("Họ tên phải có ít nhất 2 ký tự.");
      return null;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Email không hợp lệ.");
      setAuthError("Email không hợp lệ.");
      return null;
    }
    if (!password || password.length < 6) {
      showError("Mật khẩu phải có ít nhất 6 ký tự.");
      setAuthError("Mật khẩu phải có ít nhất 6 ký tự.");
      return null;
    }
    if (!acceptTerms) {
      showError("Bạn phải đồng ý với điều khoản sử dụng.");
      setAuthError("Bạn phải đồng ý với điều khoản sử dụng.");
      return null;
    }

    try {
      const response = await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          gender,
          birthDate,
          address,
          city,
          district,
          company,
          taxCode,
          acceptTerms,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Không đăng ký được.");
        setAuthError(data.message || "Không đăng ký được.");
        return null;
      }

      setAuthError("");
      setCurrentUser(data.user);
      showSuccess("Đăng ký thành công! Chào mừng bạn.");
      return data.user;
    } catch {
      showError("Không kết nối được server.");
      setAuthError("Không kết nối được server.");
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

      if (!response.ok) {
        showError(data.message || "Lỗi xử lý OTP.");
        setAuthError(data.message || "Lỗi.");
        return;
      }

      if (otp && password) {
        showSuccess("Đặt lại mật khẩu thành công! Hãy đăng nhập.");
        setAuthError("");
        setMode("login");
      } else {
        showSuccess(data.message || "Đã gửi OTP đến email.");
        setAuthError(data.devOtp ? `OTP: ${data.devOtp}` : "Kiểm tra email để lấy mã OTP.");
      }
    } catch {
      showError("Không kết nối được server.");
      setAuthError("Không kết nối được server.");
    }
  }

  async function logout() {
    window.localStorage.removeItem("ipark_current_user");
    setCurrentUser(null);
    showInfo("Đã đăng xuất.");
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
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
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
      formEl.reset();
    } else {
      setActionLog(data.message || "Không xác minh được 2FA.");
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const response = await apiFetch("/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: String(form.get("code") || "") }),
    });
    const data = await response.json();
    if (response.ok) {
      setCurrentUser(data.user);
      setActionLog("Đã tắt 2FA.");
      formEl.reset();
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
