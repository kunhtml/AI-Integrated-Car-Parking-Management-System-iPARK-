"use client";

import { useEffect, useState } from "react";
import { useParkingApp } from "@/context/parking-app-context";
import { User } from "@/types/parking";

export function MandatoryProfileModal() {
  const { currentUser, updateProfile, isBackendOnline } = useParkingApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    
    // Only apply to customer role
    if (currentUser.role !== "customer") return;

    const isNameMissing = !currentUser.name || currentUser.name.trim() === "" || currentUser.name.startsWith("Khách hàng ");
    const isPhoneMissing = !currentUser.phone || currentUser.phone.trim() === "";
    const isAddressMissing = !currentUser.address || currentUser.address.trim() === "";

    if (isNameMissing || isPhoneMissing || isAddressMissing) {
      setName(currentUser.name && !currentUser.name.startsWith("Khách hàng ") ? currentUser.name : "");
      setPhone(currentUser.phone || "");
      setAddress(currentUser.address || "");
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [currentUser]);

  if (!open || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Vui lòng nhập Họ và Tên chính xác.");
      return;
    }

    const phoneRegex = /^[0-9+\-\s()]{6,20}$/;
    if (!phone.trim() || !phoneRegex.test(phone.trim())) {
      setError("Vui lòng nhập Số Điện Thoại hợp lệ (từ 6-20 chữ số).");
      return;
    }

    if (!address.trim() || address.trim().length < 3) {
      setError("Vui lòng nhập Địa Chỉ chi tiết (ít nhất 3 ký tự).");
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      setOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Cập nhật thông tin thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl border border-border space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Cập nhật thông tin cá nhân</h2>
          <p className="text-xs text-muted-foreground">
            Để đảm bảo an toàn và quyền lợi khi quản lý phương tiện / thẻ gửi xe, vui lòng hoàn thiện đầy đủ Họ Tên, Số Điện Thoại và Địa Chỉ của bạn.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Họ và Tên <span className="text-destructive">*</span></label>
            <input
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Số Điện Thoại <span className="text-destructive">*</span></label>
            <input
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Địa Chỉ <span className="text-destructive">*</span></label>
            <textarea
              required
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Số 123 Đường ABC, Quận XYZ, TP. Hà Nội"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Đang lưu..." : "Xác nhận & Hoàn tất"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}