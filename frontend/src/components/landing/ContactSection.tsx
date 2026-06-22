"use client";

import { useState, type FormEvent } from "react";
import { Phone, Mail, MapPin, ShieldCheck } from "lucide-react";
import { parkingConfig } from "@/lib/parking-config";

export default function ContactSection() {
  const [contactSubmitted, setContactSubmitted] = useState(false);

  function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactSubmitted(true);
  }

  return (
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
              <span>Hotline: {parkingConfig.hotline}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="text-blue-500" size={20} />
              <span>Email: {parkingConfig.contactEmail}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="text-blue-500" size={20} />
              <span>Địa chỉ: {parkingConfig.address}</span>
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
  );
}
