"use client";

import React, { useState } from "react";
import {
  ParkingCircle,
  LogIn,
  Car,
  ShieldCheck,
  Cpu,
  CreditCard,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { parkingConfig } from "../lib/parking-config";

export default function PageHomepage() {
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const stats = {
    active: 1,
    available: 29,
    capacity: parkingConfig.totalCapacity,
  };

  function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactSubmitted(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 text-white p-2 rounded-xl">
            <ParkingCircle size={24} />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            {parkingConfig.brandName}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            Tính năng
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            Bảng giá
          </a>
          <a
            href="#contact"
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            Liên hệ
          </a>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
            type="button"
          >
            <LogIn size={16} />
            Vào hệ thống
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 max-w-7xl w-full mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold tracking-wide uppercase">
            Hệ thống quản lý bãi đỗ xe thông minh
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
            Giải pháp đỗ xe <span className="text-blue-600">iPARK</span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
            Theo dõi {stats.capacity} chỗ đỗ ô tô khu A/B/C, ghi nhận xe vào/ra
            bằng ảnh, tính phí tự động sau {parkingConfig.freeMinutes} phút miễn
            phí và phân quyền vận hành thông minh.
          </p>

          {/* Stats Strip */}
          <div className="grid grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm max-w-lg">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 block">
                Đang gửi
              </span>
              <strong className="text-2xl font-bold text-slate-900">
                {stats.active} xe
              </strong>
            </div>
            <div className="space-y-1 border-l border-slate-200 pl-4">
              <span className="text-xs font-medium text-slate-500 block">
                Còn trống
              </span>
              <strong className="text-2xl font-bold text-emerald-600">
                {stats.available} chỗ
              </strong>
            </div>
            <div className="space-y-1 border-l border-slate-200 pl-4">
              <span className="text-xs font-medium text-slate-500 block">
                Camera AI
              </span>
              <strong className="text-2xl font-bold text-blue-600">
                2 cổng
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <a
              href="#contact"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Đăng ký tư vấn
            </a>
            <a
              href="#features"
              className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all shadow-sm"
            >
              Tìm hiểu thêm
            </a>
          </div>
        </div>

        {/* Hero Image / Visual Mockup */}
        <div className="lg:col-span-5 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-900">
              Trạng thái bãi xe thực tế
            </h3>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Car size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">30H-678.90</p>
                  <p className="text-xs text-slate-500">
                    Vào lúc 08:15 - Khu A-12
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Đang gửi
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Car size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">30E-345.67</p>
                  <p className="text-xs text-slate-500">
                    Ra lúc 10:20 - Khu B-04
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Đã thanh toán
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="bg-white py-20 border-y border-slate-200"
      >
        <div className="max-w-7xl w-full mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl font-black text-slate-900">
              Tính năng nổi bật của iPARK
            </h2>
            <p className="text-slate-600">
              Hệ thống tích hợp công nghệ hiện đại giúp tối ưu hóa quy trình vận
              hành bãi đỗ xe.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Cpu size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Nhận dạng biển số AI
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Tự động nhận dạng biển số xe vào/ra với độ chính xác trên 95%,
                giảm thiểu thời gian chờ đợi tại cổng kiểm soát.
              </p>
            </div>
            <div className="p-8 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Thanh toán không tiền mặt
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Hỗ trợ thanh toán qua ví điện tử nội bộ, quét mã QR nhanh chóng
                và minh bạch hóa doanh thu bãi xe.
              </p>
            </div>
            <div className="p-8 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Giám sát & Cảnh báo sự cố
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Hệ thống tự động phát hiện và cảnh báo các sự cố như camera
                offline, xe blacklist hoặc lỗi nhận dạng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl w-full mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl font-black text-slate-900">
              Bảng giá dịch vụ
            </h2>
            <p className="text-slate-600">
              Linh hoạt và phù hợp với mọi nhu cầu gửi xe của khách hàng.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Gói lượt */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Gói lượt</h3>
                <div className="text-3xl font-black text-slate-900">
                  5.000đ{" "}
                  <span className="text-sm font-normal text-slate-500">
                    / giờ
                  </span>
                </div>
                <p className="text-slate-600 text-sm">
                  Phù hợp cho khách vãng lai gửi xe trong ngày.
                </p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 border-t border-slate-100 pt-6">
                <li className="flex items-center gap-2">
                  ✓ Miễn phí 20 phút đầu
                </li>
                <li className="flex items-center gap-2">
                  ✓ Nhận dạng biển số tự động
                </li>
                <li className="flex items-center gap-2">
                  ✓ Thanh toán QR nhanh
                </li>
              </ul>
            </div>
            {/* Gói tháng */}
            <div className="bg-white p-8 rounded-2xl border-2 border-blue-600 shadow-md space-y-6 flex flex-col justify-between relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Phổ biến nhất
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Gói tháng</h3>
                <div className="text-3xl font-black text-slate-900">
                  1.200.000đ{" "}
                  <span className="text-sm font-normal text-slate-500">
                    / tháng
                  </span>
                </div>
                <p className="text-slate-600 text-sm">
                  Dành cho cư dân hoặc nhân viên văn phòng gửi cố định.
                </p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 border-t border-slate-100 pt-6">
                <li className="flex items-center gap-2">
                  ✓ Không giới hạn lượt vào/ra
                </li>
                <li className="flex items-center gap-2">
                  ✓ Cố định vị trí đỗ ưu tiên
                </li>
                <li className="flex items-center gap-2">
                  ✓ Quản lý qua tài khoản riêng
                </li>
              </ul>
            </div>
            {/* Gói doanh nghiệp */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Doanh nghiệp
                </h3>
                <div className="text-3xl font-black text-slate-900">
                  Liên hệ
                </div>
                <p className="text-slate-600 text-sm">
                  Giải pháp tùy chỉnh cho các tòa nhà, trung tâm thương mại.
                </p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 border-t border-slate-100 pt-6">
                <li className="flex items-center gap-2">
                  ✓ Tích hợp camera RTSP riêng
                </li>
                <li className="flex items-center gap-2">
                  ✓ Báo cáo doanh thu nâng cao
                </li>
                <li className="flex items-center gap-2">
                  ✓ Hỗ trợ kỹ thuật 24/7
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <h2 className="text-3xl font-black">Liên hệ với chúng tôi</h2>
            <p className="text-slate-400 leading-relaxed">
              Bạn muốn triển khai hệ thống iPARK cho bãi xe của mình? Hãy để lại
              thông tin, đội ngũ kỹ thuật của chúng tôi sẽ liên hệ tư vấn trong
              vòng 24 giờ.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="text-blue-500" size={20} />
                <span>Hotline: Chưa cung cấp</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="text-blue-500" size={20} />
                <span>Email: support@ipark.vn</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="text-blue-500" size={20} />
                <span>Địa chỉ: Hòa Lạc, Thạch Thất, Hà Nội</span>
              </div>
            </div>
          </div>

          <div className="bg-white text-slate-800 p-8 rounded-2xl shadow-xl">
            {contactSubmitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Gửi thông tin thành công!
                </h3>
                <p className="text-slate-600 text-sm">
                  Cảm ơn bạn đã quan tâm. Chúng tôi sẽ liên hệ lại sớm nhất.
                </p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleContactSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Họ và tên
                    </label>
                    <input
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Nguyễn Văn A"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Số điện thoại
                    </label>
                    <input
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="0912345678"
                      required
                      type="tel"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Email liên hệ
                  </label>
                  <input
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="name@company.com"
                    required
                    type="email"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Lời nhắn
                  </label>
                  <textarea
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[100px] resize-y"
                    placeholder="Tôi muốn tư vấn lắp đặt hệ thống cho bãi xe 100 chỗ..."
                    required
                  />
                </div>
                <button
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md"
                  type="submit"
                >
                  Gửi yêu cầu tư vấn
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-xs py-8 border-t border-slate-900 text-center">
        <p>
          © 2026 iPARK. All rights reserved. Phát triển bởi nhóm dự án iPARK.
        </p>
      </footer>
    </div>
  );
}

{
  activeView === "feedback" && (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Phản hồi</p>
            <h2>Gửi phản hồi</h2>
          </div>
          <Bell size={22} />
        </div>
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            simulateAction("Đã ghi nhận phản hồi khách hàng trên giao diện. Cần API lưu phản hồi để hoàn chỉnh.");
            event.currentTarget.reset();
          }}
        >
          <label>
            Chủ đề
            <input name="subject" placeholder="Ví dụ: nhầm phí gửi xe" required />
          </label>
          <label>
            Nội dung
            <input name="content" placeholder="Nhập nội dung phản hồi" required />
          </label>
          <button className="full-button" type="submit">
            Gửi phản hồi
          </button>
        </form>
      </div>
      <ModuleList
        icon={<ReceiptText size={22} />}
        kicker="Lịch sử"
        title="Phản hồi đã gửi"
        items={["Yêu cầu miễn phạt PX-1024 - Đang xử lý", "Góp ý khu B thiếu biển chỉ dẫn - Đã tiếp nhận"]}
      />
    </section>
  )
}
