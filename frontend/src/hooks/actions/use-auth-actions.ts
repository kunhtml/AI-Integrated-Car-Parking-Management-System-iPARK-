import { FormEvent } from "react";

import { apiFetch } from "@/lib/client-api";
import { showError, showInfo, showSuccess } from "@/lib/toast";
import type { AuthMode, DemoUser } from "@/types";

type AuthActionsParams = {
  setMode: (mode: AuthMode) => void;
  setCurrentUser: (user: DemoUser | null) => void;
  setAuthError: (error: string) => void;
  setActionLog: (log: string) => void;
};

export function createAuthActions({
  setMode,
  setCurrentUser,
  setAuthError,
  setActionLog,
}: AuthActionsParams) {
  type LoginResult =
    | { kind: "ok"; user: DemoUser }
    | { kind: "two-factor"; pendingTwoFactorId: string; email?: string }
    | { kind: "email-verification"; email?: string }
    | null;
  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ): Promise<LoginResult> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.status === 202 && data.requiresTwoFactor) {
        showInfo(data.message || "Vui lòng nhập mã 2FA đã gửi về email.");
        setAuthError("");
        return {
          kind: "two-factor",
          pendingTwoFactorId: data.pendingTwoFactorId as string,
          email: (data.email as string) || email,
        };
      }
      if (response.status === 403 && data.requiresEmailVerification) {
        showInfo(
          data.message || "Email chưa được xác minh. Vui lòng nhập mã OTP.",
        );
        setAuthError(data.message || "Email chưa được xác minh.");
        return { kind: "email-verification", email: data.email || email };
      }
      if (!response.ok) {
        showError(data.message || "Không đăng nhập được.");
        setAuthError(data.message || "Không đăng nhập được.");
        return null;
      }

      setAuthError("");
      setCurrentUser(data.user);
      showSuccess("Đăng nhập thành công!");
      return { kind: "ok", user: data.user };
    } catch {
      showError("Không kết nối được server. Kiểm tra backend.");
      setAuthError("Không kết nối được server.");
      return null;
    }
  }

  async function handleVerifyLoginTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const pendingTwoFactorId = String(
      form.get("pendingTwoFactorId") ?? "",
    ).trim();
    const code = String(form.get("code") ?? "").trim();
    if (!pendingTwoFactorId) {
      showError("Thiếu mã phiên 2FA. Vui lòng đăng nhập lại.");
      return null;
    }
    try {
      const response = await apiFetch("/auth/2fa/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingTwoFactorId, code }),
      });
      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Mã 2FA không đúng hoặc đã hết hạn.");
        setAuthError(data.message || "Mã 2FA không đúng hoặc đã hết hạn.");
        return null;
      }
      setAuthError("");
      setCurrentUser(data.user);
      showSuccess("Đăng nhập thành công!");
      formEl.reset();
      return data.user;
    } catch {
      showError("Không kết nối được server.");
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
    const confirmPassword = String(form.get("confirmPassword") ?? "");

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
    if (password !== confirmPassword) {
      showError("Mật khẩu nhập lại không khớp.");
      setAuthError("Mật khẩu nhập lại không khớp.");
      return null;
    }

    try {
      const response = await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Không đăng ký được.");
        setAuthError(data.message || "Không đăng ký được.");
        return null;
      }

      setAuthError("");
      showSuccess(
        data.message || "Đã gửi mã OTP xác nhận đến email. Vui lòng kiểm tra.",
      );
      return { requiresOtp: true, email };
    } catch {
      showError("Không kết nối được server.");
      setAuthError("Không kết nối được server.");
      return null;
    }
  }

  /**
   * Bước 2 đăng ký: xác minh OTP vừa gửi tới email, tạo tài khoản và tự động đăng nhập.
   */
  async function handleVerifyRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const otp = String(form.get("otp") ?? "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Email không hợp lệ.");
      setAuthError("Email không hợp lệ.");
      return null;
    }
    if (!/^\d{6}$/.test(otp)) {
      showError("Mã OTP phải gồm 6 chữ số.");
      setAuthError("Mã OTP phải gồm 6 chữ số.");
      return null;
    }

    try {
      const response = await apiFetch("/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Mã OTP không đúng hoặc đã hết hạn.");
        setAuthError(data.message || "Mã OTP không đúng hoặc đã hết hạn.");
        return null;
      }

      setAuthError("");
      setCurrentUser(data.user);
      showSuccess(data.message || "Đăng ký thành công! Chào mừng bạn.");
      return data.user;
    } catch {
      showError("Không kết nối được server.");
      setAuthError("Không kết nối được server.");
      return null;
    }
  }

  /**
   * Khi user đã có tài khoản (login thường bị chặn vì chưa verify) — gửi mã OTP mới để kích hoạt.
   */
  async function handleResendVerificationOtp(email: string) {
    if (!email) return;
    try {
      const response = await apiFetch("/auth/resend-verification-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Không gửi lại được OTP.");
        setAuthError(data.message || "Không gửi lại được OTP.");
        return;
      }
      showSuccess(
        data.message || "Đã gửi lại mã OTP. Vui lòng kiểm tra email.",
      );
    } catch {
      showError("Không kết nối được server.");
      setAuthError("Không kết nối được server.");
    }
  }

  async function handleRequestForgotOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Email không hợp lệ.");
      setAuthError("Email không hợp lệ.");
      return;
    }

    try {
      const response = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        showError(data.message || "Lỗi gửi OTP.");
        setAuthError(data.message || "Lỗi gửi OTP.");
        return;
      }

      showSuccess(data.message || "Đã gửi OTP đến email.");
      setAuthError("Kiểm tra email để lấy mã OTP.");
    } catch {
      showError("Không kết nối được server.");
      setAuthError("Không kết nối được server.");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const otp = String(form.get("otp") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!otp || otp.length !== 6) {
      showError("Vui lòng nhập mã OTP 6 số.");
      setAuthError("Vui lòng nhập mã OTP 6 số.");
      return;
    }
    if (!password || password.length < 6) {
      showError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      setAuthError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    try {
      const response = await apiFetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        showError(data.message || "OTP không đúng hoặc đã hết hạn.");
        setAuthError(data.message || "OTP không đúng hoặc đã hết hạn.");
        return;
      }

      showSuccess("Đặt lại mật khẩu thành công! Hãy đăng nhập.");
      setAuthError("");
      setMode("login");
    } catch {
      showError("Không kết nối được server.");
      setAuthError("Không kết nối được server.");
    }
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setCurrentUser(null);
    showInfo("Đã đăng xuất.");
  }

  async function setupTwoFactor() {
    const response = await apiFetch("/auth/2fa/setup", { method: "POST" });
    const data = await response.json();
    if (response.ok) {
      setActionLog(
        data.message ||
          "Đã gửi mã xác thực về email. Vui lòng kiểm tra hộp thư.",
      );
    } else {
      setActionLog(data.message || "Không gửi được mã 2FA.");
    }
    return data as {
      setupTwoFactorId?: string;
      email?: string;
      message?: string;
    };
  }

  async function resendTwoFactorOtp(setupTwoFactorId?: string) {
    const response = await apiFetch("/auth/2fa/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(setupTwoFactorId ? { setupTwoFactorId } : {}),
    });
    const data = await response.json();
    if (response.ok) {
      setActionLog(data.message || "Đã gửi lại mã 2FA mới.");
    } else {
      setActionLog(data.message || "Không gửi lại được mã.");
    }
    return data;
  }

  async function verifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const setupTwoFactorId = String(form.get("setupTwoFactorId") || "").trim();
    const response = await apiFetch("/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setupTwoFactorId,
        code: String(form.get("code") || ""),
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setCurrentUser(data.user);
      setActionLog("Đã bật 2FA.");
      formEl.reset();
    } else {
      setActionLog(data.message || "Không xác minh được 2FA.");
    }
  }

  async function requestDisableTwoFactor() {
    const response = await apiFetch("/auth/2fa/request-disable", {
      method: "POST",
    });
    const data = await response.json();
    if (response.ok) {
      setActionLog(data.message || "Đã gửi mã xác nhận tắt 2FA về email.");
    } else {
      setActionLog(data.message || "Không gửi được mã tắt 2FA.");
    }
    return data;
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
    handleVerifyRegister,
    handleResendVerificationOtp,
    handleRequestForgotOtp,
    handleResetPassword,
    handleVerifyLoginTwoFactor,
    logout,
    setupTwoFactor,
    resendTwoFactorOtp,
    verifyTwoFactor,
    requestDisableTwoFactor,
    disableTwoFactor,
  };
}
