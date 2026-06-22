"use client";

import { ParkingCircle, LogIn } from "lucide-react";
import { parkingConfig } from "@/lib/parking-config";
import Link from "next/link";

export default function Navbar() {
  return (
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
        <Link
          href="/auth"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <LogIn size={16} />
          Vào hệ thống
        </Link>
      </div>
    </nav>
  );
}
