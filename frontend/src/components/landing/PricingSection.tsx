export default function PricingSection() {
  return (
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
              <div className="text-3xl font-black text-slate-900">Liên hệ</div>
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
  );
}
