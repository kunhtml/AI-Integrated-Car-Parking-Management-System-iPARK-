import { parkingConfig } from "@/lib/parking-config";
import { Car } from "lucide-react";

export default function HeroSection() {
  const stats = {
    active: 1,
    available: 29,
    capacity: parkingConfig.totalCapacity,
  };

  return (
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
  );
}
