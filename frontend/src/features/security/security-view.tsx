"use client";

import Image from "next/image";
import { CheckCircle2, KeyRound, LogOut, Mail, Smartphone } from "lucide-react";

import { ModuleList } from "@/components/ui/module-list";
import { useParkingApp } from "@/context/parking-app-context";

export function SecurityView() {
  const {
    currentUser,
    twoFactorQr,
    setMode,
    logout,
    setupTwoFactor,
    verifyTwoFactor,
    disableTwoFactor,
  } = useParkingApp();

  if (!currentUser) {
    return null;
  }

  return (
    <section className="content-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Xác thực</p>
            <h2>Mật khẩu, OTP, JWT, 2FA</h2>
          </div>
          <KeyRound size={22} />
        </div>
        <div className="action-grid">
          <button onClick={() => setMode("forgot")} type="button">
            <Mail size={18} />
            Reset OTP
          </button>
          {currentUser.role === "admin" && (
            <button onClick={setupTwoFactor} type="button">
              <Smartphone size={18} />
              Tạo QR 2FA
            </button>
          )}
          <button
            onClick={async () => {
              await logout();
            }}
            type="button"
          >
            <LogOut size={18} />
            Thu hồi phiên
          </button>
        </div>
        {twoFactorQr && (
          <div className="qr-panel">
            <Image alt="QR 2FA" height={220} src={twoFactorQr} unoptimized width={220} />
            <form className="stack-form" onSubmit={verifyTwoFactor}>
              <label>
                Mã 2FA
                <input name="code" placeholder="123456" required />
              </label>
              <button className="full-button" type="submit">
                Bật 2FA
              </button>
            </form>
          </div>
        )}
        {currentUser.role === "admin" && currentUser.twoFactorEnabled && (
          <form className="stack-form" onSubmit={disableTwoFactor}>
            <label>
              Mã 2FA để tắt
              <input name="code" placeholder="123456" required />
            </label>
            <button className="full-button" type="submit">
              Tắt 2FA
            </button>
          </form>
        )}
      </div>
      <ModuleList
        icon={<CheckCircle2 size={22} />}
        kicker="Phiên"
        title="Quản lý phiên hoạt động"
        items={[
          "JWT cookie httpOnly",
          `2FA admin: ${currentUser.twoFactorEnabled ? "Đã bật" : "Chưa bật"}`,
          `Google OAuth: ${currentUser.provider === "google" || currentUser.provider === "mixed" ? "Đã liên kết" : "Sẵn sàng"}`,
        ]}
      />
    </section>
  );
}
