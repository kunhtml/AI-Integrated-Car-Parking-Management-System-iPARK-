"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ParkingCircle, LogIn } from "lucide-react";
import { getDefaultPathForRole } from "@/config/nav-items";
import { useParkingApp } from "@/context/parking-app-context";
import { buildApiUrl } from "@/lib/api";
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (name: string, value: string) => {
    let err = "";
    const emailRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (isLogin) {
      if (name === "email") {
        if (!value.trim()) err = "Email không được để trống.";
        else if (!emailRegex.test(value))
          err = "Email không đúng định dạng hoặc chứa ký tự đặc biệt ở đầu.";
      } else if (name === "password") {
        if (!value) err = "Mật khẩu không được để trống.";
      }
    } else {
      if (name === "name") {
        if (!value.trim()) err = "Họ và tên không được để trống.";
        else if (value.trim().length < 2)
          err = "Họ và tên phải có ít nhất 2 ký tự.";
      } else if (name === "phone") {
        if (!value.trim()) err = "Số điện thoại không được để trống.";
        else if (!/^\d{9,11}$/.test(value.trim()))
          err = "Số điện thoại phải từ 9 đến 11 chữ số.";
      } else if (name === "email") {
        if (!value.trim()) err = "Email không được để trống.";
        else if (!emailRegex.test(value))
          err = "Email không đúng định dạng hoặc chứa ký tự đặc biệt ở đầu.";
      } else if (name === "password") {
        const passwordRegex =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!value) err = "Mật khẩu không được để trống.";
        else if (!passwordRegex.test(value)) {
          err =
            "Mật khẩu phải dài ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (@$!%*?&).";
        }
      } else if (name === "confirmPassword") {
        if (!value) err = "Vui lòng xác nhận mật khẩu.";
        else if (value !== formData.password)
          err = "Mật khẩu xác nhận không khớp.";
      }
    }
    return err;
  };

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    const err = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  }

  function handleBlur(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const err = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  }

  const handleTabChange = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setErrors({});
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    });
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach((key) => {
      if (isLogin && ["name", "phone", "confirmPassword"].includes(key)) return;
      const err = validateField(key, formData[key as keyof typeof formData]);
      if (err) {
        newErrors[key] = err;
      }
    });

    setErrors(newErrors);
    if (Object.values(newErrors).some((err) => err)) {
      return;
    }

    const user = isLogin ? await handleLogin(e) : await handleRegister(e);
    if (user) {
      router.push(getDefaultPathForRole(user.role));
    }
  }

  if (isForgotPassword) {
    return (
      <ForgotPasswordForm onBackToLogin={() => setIsForgotPassword(false)} />
    );
  }

  return (
    <div className="w-full max-w-md mx-auto my-auto py-8 space-y-6">
      {/* Logo iPARK */}
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold text-xl border border-indigo-500/30">
            P
          </div>
          <span className="text-3xl font-black tracking-tight text-white">
            iPARK
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-[#0b0f19] border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => handleTabChange(true)}
          className={`py-2.5 text-sm font-semibold rounded-lg transition-all ${
            isLogin
              ? "bg-[#1e293b] text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(false)}
          className={`py-2.5 text-sm font-semibold rounded-lg transition-all ${
            !isLogin
              ? "bg-[#1e293b] text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Đăng ký
        </button>
      </div>

      {authError && (
        <p className="form-error text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          {authError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-300">
                Họ và tên
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                placeholder="Nguyễn Văn A"
                className={`w-full px-4 py-3 bg-[#0b0f19] border ${
                  errors.name
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-800 focus:ring-blue-500"
                } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-300">
                Số điện thoại
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                placeholder="0912345678"
                className={`w-full px-4 py-3 bg-[#0b0f19] border ${
                  errors.phone
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-800 focus:ring-blue-500"
                } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
              />
              {errors.phone && (
                <p className="text-red-500 text-xs font-medium mt-1">
                  {errors.phone}
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-300">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            placeholder="admin@ipark.vn"
            className={`w-full px-4 py-3 bg-[#0b0f19] border ${
              errors.email
                ? "border-red-500 focus:ring-red-500"
                : "border-slate-800 focus:ring-blue-500"
            } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
          />
          {errors.email && (
            <p className="text-red-500 text-xs font-medium mt-1">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-300">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              placeholder="•••••"
              className={`w-full px-4 py-3 bg-[#0b0f19] border ${
                errors.password
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-800 focus:ring-blue-500"
              } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-200 text-xs font-semibold"
            >
              {showPassword ? "Ẩn" : "Hiện"}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs font-medium mt-1">
              {errors.password}
            </p>
          )}
        </div>

        {!isLogin && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-300">
              Xác nhận mật khẩu
            </label>
            <input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              placeholder="•••••"
              className={`w-full px-4 py-3 bg-[#0b0f19] border ${
                errors.confirmPassword
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-800 focus:ring-blue-500"
              } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          <LogIn size={18} />
          {isLogin ? "Đăng nhập" : "Đăng ký tài khoản"}
        </button>
      </form>

      {/* HOẶC */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-slate-800"></div>
        <span className="flex-shrink mx-4 text-xs font-bold text-slate-500 tracking-wider">
          HOẶC
        </span>
        <div className="flex-grow border-t border-slate-800"></div>
      </div>

      {/* Đăng nhập với Google */}
      <button
        type="button"
        onClick={() => {
          window.location.href = buildApiUrl("/auth/google");
        }}
        className="w-full py-3 bg-[#0b0f19] border border-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.09 14.974 0 12 0 7.354 0 3.307 2.67 1.242 6.56l4.024 3.205z"
          />
          <path
            fill="#4285F4"
            d="M23.49 12.275c0-.818-.073-1.609-.21-2.373H12v4.582h6.455c-.278 1.464-1.102 2.705-2.343 3.541l3.65 2.832c2.136-1.973 3.728-4.873 3.728-8.582z"
          />
          <path
            fill="#FBBC05"
            d="M5.266 14.235L1.242 17.44A11.966 11.966 0 0 0 12 24c2.93 0 5.67-.97 7.762-2.62l-3.65-2.832A7.12 7.12 0 0 1 12 19.091c-3.04 0-5.642-2.055-6.734-4.856z"
          />
          <path
            fill="#34A853"
            d="M1.242 6.56C.45 8.17 0 9.97 0 11.885c0 1.915.45 3.715 1.242 5.325l4.024-3.205a7.037 7.037 0 0 1 0-4.24L1.242 6.56z"
          />
        </svg>
        <span>Đăng nhập với Google</span>
      </button>

      {/* Quên mật khẩu */}
      {isLogin && (
        <div className="text-center">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsForgotPassword(true);
            }}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Quên mật khẩu?
          </a>
        </div>
      )}
    </div>
  );
}
