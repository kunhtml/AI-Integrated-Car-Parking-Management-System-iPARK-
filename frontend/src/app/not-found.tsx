import Link from "next/link";
import { Home, Search } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12"
    >
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
            <Search className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="mb-2 text-4xl font-bold text-slate-900">404</h1>
          <h2 className="mb-4 text-xl font-semibold text-slate-700">
            Không tìm thấy trang
          </h2>
          <p className="text-slate-600">
            Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Home size={16} />
            Về trang chủ
          </Link>
          <BackButton />
        </div>

        <div className="mt-8 text-sm text-slate-500">
          <p>
            Cần hỗ trợ?{" "}
            <Link href="/" className="text-blue-600 hover:underline">
              Liên hệ quản trị viên
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
