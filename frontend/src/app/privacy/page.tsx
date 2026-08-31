import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description: "Chính sách bảo mật và bảo vệ dữ liệu người dùng của iPARK.",
};

export default function PrivacyPolicyPage() {
  return (
    <main id="main-content" className="public-shell">
      <article className="mx-auto w-full max-w-4xl px-6 py-12">
        <header className="mb-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
            iPARK
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Chính sách bảo mật</h1>
          <p className="mt-3 text-sm text-slate-600">
            Cập nhật lần cuối: 27/08/2026
          </p>
        </header>

        <div className="space-y-8 text-slate-700">
          <section aria-labelledby="scope">
            <h2 id="scope" className="mb-3 text-xl font-semibold text-slate-900">
              1. Phạm vi áp dụng
            </h2>
            <p>
              Chính sách này giải thích cách iPARK thu thập, sử dụng, lưu trữ và bảo vệ
              thông tin khi bạn sử dụng nền tảng quản lý bãi đỗ xe và các dịch vụ liên quan.
            </p>
          </section>

          <section aria-labelledby="data">
            <h2 id="data" className="mb-3 text-xl font-semibold text-slate-900">
              2. Thông tin được thu thập
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Thông tin tài khoản như họ tên, email, số điện thoại và vai trò.</li>
              <li>Thông tin phương tiện, biển số, thẻ RFID và phiên gửi xe.</li>
              <li>Thông tin giao dịch, thanh toán và lịch sử sử dụng dịch vụ.</li>
              <li>Dữ liệu kỹ thuật cần thiết để bảo mật, vận hành và cải thiện hệ thống.</li>
            </ul>
          </section>

          <section aria-labelledby="purpose">
            <h2 id="purpose" className="mb-3 text-xl font-semibold text-slate-900">
              3. Mục đích sử dụng
            </h2>
            <p>
              Dữ liệu được sử dụng để xác thực tài khoản, quản lý ra vào bãi xe, xử lý thanh toán,
              cung cấp hỗ trợ, phát hiện gian lận và đáp ứng nghĩa vụ pháp lý. iPARK không bán
              thông tin cá nhân cho bên thứ ba.
            </p>
          </section>

          <section aria-labelledby="security">
            <h2 id="security" className="mb-3 text-xl font-semibold text-slate-900">
              4. Bảo mật và lưu giữ dữ liệu
            </h2>
            <p>
              iPARK áp dụng kiểm soát truy cập, mã hóa khi truyền dữ liệu, nhật ký kiểm toán và
              các biện pháp kỹ thuật phù hợp để giảm rủi ro truy cập hoặc sử dụng trái phép. Dữ liệu
              được lưu giữ trong thời gian cần thiết cho mục đích cung cấp dịch vụ và tuân thủ pháp luật.
            </p>
          </section>

          <section aria-labelledby="rights">
            <h2 id="rights" className="mb-3 text-xl font-semibold text-slate-900">
              5. Quyền của bạn
            </h2>
            <p>
              Tùy theo quy định pháp luật áp dụng, bạn có thể yêu cầu truy cập, chỉnh sửa, xuất hoặc
              xóa dữ liệu cá nhân. Người dùng đã đăng nhập có thể thực hiện các thao tác này tại mục
              quản lý quyền riêng tư hoặc liên hệ bộ phận hỗ trợ của iPARK.
            </p>
          </section>

          <section aria-labelledby="contact">
            <h2 id="contact" className="mb-3 text-xl font-semibold text-slate-900">
              6. Liên hệ
            </h2>
            <p>
              Nếu có câu hỏi về chính sách hoặc yêu cầu liên quan đến dữ liệu cá nhân, vui lòng liên
              hệ quản trị viên hoặc bộ phận hỗ trợ iPARK thông qua kênh liên hệ được cung cấp trong hệ thống.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
