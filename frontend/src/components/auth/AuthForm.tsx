"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ParkingCircle, Eye, EyeOff, Lock, Mail, User, Phone } from "lucide-react";
import { getDefaultPathForRole } from "@/config/nav-items";
import { useParkingApp } from "@/context/parking-app-context";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function AuthForm() {
  const router = useRouter();
  const { handleLogin, handleRegister, authError } = useParkingApp();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const user = isLogin ? await handleLogin(e) : await handleRegister(e);
    if (user) {
      router.push(getDefaultPathForRole(user.role));
    }
  }

  if (isForgotPassword) {
    return <ForgotPasswordForm onBackToLogin={() => setIsForgotPassword(false)} />;
  }

  return (
    <div className="w-full max-w-md mx-auto my-auto py-12 space-y-8">
      <div className="space-y-3 text-center lg:text-left">
        <div className="inline-flex bg-blue-600 text-white p-2.5 rounded-2xl mb-2">
          <ParkingCircle size={28} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
        </h1>
        <p className="text-sm text-slate-500">
          {isLogin
            ? "Vui lòng đăng nhập để quản lý bãi đỗ xe của bạn."
            : "Đăng ký để trải nghiệm hệ thống quản lý bãi đỗ xe thông minh."}
        </p>
      </div>

      {authError && <p className="form-error">{authError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Họ và tên
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Nguyễn Văn A"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Số điện thoại
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Phone size={18} />
                </span>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="0912345678"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Địa chỉ Email
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Mail size={18} />
            </span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="name@company.com"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mật khẩu
            </label>
            {isLogin && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsForgotPassword(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Quên mật khẩu?
              </a>
            )}
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Lock size={18} />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {!isLogin && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
        >
          {isLogin ? "Đăng nhập" : "Đăng ký tài khoản"}
        </button>
      </form>

      <div className="text-center text-sm text-slate-500">
        {isLogin ? (
          <>
            Chưa có tài khoản?{" "}
            <button
              onClick={() => setIsLogin(false)}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Đăng ký ngay
            </button>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <button
              onClick={() => setIsLogin(true)}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Đăng nhập ngay
            </button>
          </>
        )}
      </div>
    </div>
  );
}
