import { Cpu, CreditCard, ShieldCheck } from "lucide-react";

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-20 border-y border-slate-200">
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
  );
}
