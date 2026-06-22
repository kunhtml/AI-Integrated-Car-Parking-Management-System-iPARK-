"use client";

import { ParkingCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";

export default function AuthPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-50 text-slate-800">
      {/* Left Column - Form */}
      <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-12 bg-white shadow-xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            Quay lại trang chủ
          </Link>
        </div>

        {/* Form Container */}
        <AuthForm />

        {/* Footer */}
        <div className="text-center text-xs text-slate-400">
          © 2026 iPARK. Bảo mật thông tin tuyệt đối.
        </div>
      </div>

      {/* Right Column - Visual Banner */}
      <div className="hidden lg:col-span-7 lg:flex flex-col justify-between p-12 bg-gradient-to-br from-blue-600 to-indigo-900 text-white relative overflow-hidden">
        {/* Background Decorative Circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full -ml-20 -mb-20 blur-3xl" />

        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 z-10">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl">
            <ParkingCircle size={24} />
          </div>
          <span className="font-extrabold text-xl tracking-tight">iPARK</span>
        </div>

        {/* Banner Content */}
        <div className="max-w-lg space-y-6 my-auto z-10">
          <h2 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight">
            Hệ thống quản lý bãi đỗ xe thông minh tích hợp AI
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            Tự động hóa quy trình kiểm soát xe vào/ra, nhận diện biển số chính xác, thanh toán không tiền mặt và tối ưu hóa doanh thu bãi đỗ xe của bạn.
          </p>
        </div>

        {/* Banner Footer */}
        <div className="flex justify-between text-xs text-blue-200/80 z-10">
          <span>Hỗ trợ kỹ thuật: support@ipark.vn</span>
          <span>Phiên bản v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
