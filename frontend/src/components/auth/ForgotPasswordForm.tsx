"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ParkingCircle } from "lucide-react";

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

type Step = "email" | "otp" | "reset";

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      return;
    }

    setIsSendingOtp(true);
    setTimeout(() => {
      setIsSendingOtp(false);
      setStep("otp");
      setCountdown(30);
      alert(`Mã OTP đã được gửi tới email: ${email} (Mockup)`);
    }, 1000);
  }

  function handleResendOtp() {
    if (countdown > 0) {
      return;
    }

    setIsSendingOtp(true);
    setTimeout(() => {
      setIsSendingOtp(false);
      setCountdown(30);
      alert(`Mã OTP mới đã được gửi lại tới email: ${email} (Mockup)`);
    }, 1000);
  }

  function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!otp) {
      return;
    }

    setStep("reset");
  }

  function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Mật khẩu xác nhận không khớp!");
      return;
    }

    alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
    onBackToLogin();
  }

  return (
    <div className="w-full max-w-md mx-auto my-auto py-12 space-y-8">
      <div className="space-y-3 text-center lg:text-left">
        <div className="inline-flex bg-blue-600 text-white p-2.5 rounded-2xl mb-2">
          <ParkingCircle size={28} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          {step === "email" && "Quên mật khẩu"}
          {step === "otp" && "Xác thực OTP"}
          {step === "reset" && "Đặt lại mật khẩu"}
        </h1>
        <p className="text-sm text-slate-500">
          {step === "email" && "Nhập email của bạn để nhận mã xác thực OTP."}
          {step === "otp" && `Nhập mã OTP gồm 6 chữ số đã được gửi tới ${email}.`}
          {step === "reset" && "Tạo mật khẩu mới cho tài khoản của bạn."}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Địa chỉ Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSendingOtp}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:bg-blue-400"
          >
            {isSendingOtp ? "Đang gửi OTP..." : "Gửi mã OTP"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mã xác thực OTP</label>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              required
              placeholder="123456"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all tracking-[0.25em] font-mono text-center"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            Xác nhận mã OTP
          </button>

          <div className="text-center text-sm text-slate-500">
            {countdown > 0 ? (
              <span>
                Gửi lại mã sau <strong className="text-blue-600">{countdown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isSendingOtp}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                {isSendingOtp ? "Đang gửi..." : "Gửi lại mã OTP"}
              </button>
            )}
          </div>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            Đặt lại mật khẩu
          </button>
        </form>
      )}

      <div className="text-center">
        <button
          onClick={onBackToLogin}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <span aria-hidden="true">←</span>
          Quay lại đăng nhập
        </button>
      </div>
    </div>
  );
}
