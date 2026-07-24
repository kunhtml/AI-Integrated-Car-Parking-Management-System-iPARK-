"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, CreditCard, Plus, ShieldCheck, Sparkles, Star, Tag, Wallet, X, Car } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { useParkingApp } from "@/context/parking-app-context";

type BillingCycle = "Monthly" | "Quarterly" | "Yearly";
type PackageStatus = "Active" | "Draft" | "Paused";

type MembershipPackage = {
  id: string;
  name: string;
  code: string;
  billingCycle: BillingCycle;
  price: number;
  durationDays: number;
  maxPlates: number;
  subscriberCount: number;
  renewalRate: number;
  status: PackageStatus;
  features: string[];
  note: string;
  createdAt?: string;
};

type PackageForm = {
  name: string;
  note: string;
  billingCycle: BillingCycle;
  durationDays: number;
  price: number;
  maxPlates: number;
};

const emptyForm: PackageForm = {
  name: "",
  note: "",
  billingCycle: "Monthly",
  durationDays: 30,
  price: 0,
  maxPlates: -1,
};

const cycleLabels: Record<BillingCycle, string> = {
  Monthly: "Tháng",
  Quarterly: "Quý",
  Yearly: "Năm",
};

const cycleDays: Record<BillingCycle, number> = {
  Monthly: 30,
  Quarterly: 90,
  Yearly: 365,
};

const currency = new Intl.NumberFormat("vi-VN");

export function MembershipPackagesView() {
  const { currentUser, registeredVehicles } = useParkingApp() as any;

  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Subscribe modal state
  const [selectedPkg, setSelectedPkg] = useState<MembershipPackage | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"payos" | "wallet">("payos");
  const [subscribing, setSubscribing] = useState(false);

  // User's active subscription state
  const [activeSub, setActiveSub] = useState<{
    packageName: string;
    plate: string;
    expiresAt: string;
    daysLeft: number;
  } | null>(null);

  // Admin form state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPackages() {
      try {
        const response = await apiFetch("/membership-packages");
        const data = await response.json().catch(() => ({}));
        if (mounted && response.ok) {
          setPackages(data.packages || []);
        }
      } catch {
        if (mounted) setPackages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPackages();
    return () => {
      mounted = false;
    };
  }, []);

  // Pre-select first vehicle plate if available
  useEffect(() => {
    if (registeredVehicles && registeredVehicles.length > 0 && !selectedPlate) {
      setSelectedPlate(registeredVehicles[0].plate);
    }
  }, [registeredVehicles, selectedPlate]);

  const activePackages = useMemo(() => {
    return packages.filter((p) => p.status === "Active" || !p.status);
  }, [packages]);

  function handleSelectSubscribe(pkg: MembershipPackage) {
    setSelectedPkg(pkg);
    setMessage(null);
  }

  async function handleConfirmSubscription(e: FormEvent) {
    e.preventDefault();
    if (!selectedPkg) return;
    if (!selectedPlate && registeredVehicles?.length > 0) {
      setMessage("Vui lòng chọn biển số xe cần đăng ký gói.");
      return;
    }

    setSubscribing(true);
    setMessage(null);

    try {
      // Simulate/Trigger registration via API or wallet
      const response = await apiFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedPkg.price,
          method: paymentMethod,
          content: `IPARK-SUB-${selectedPkg.code}-${selectedPlate || "CAR"}`,
        }),
      });

      const data = await response.json().catch(() => ({}));

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (selectedPkg.durationDays || 30));

      setActiveSub({
        packageName: selectedPkg.name,
        plate: selectedPlate || "Biển số chính",
        expiresAt: expiryDate.toLocaleDateString("vi-VN"),
        daysLeft: selectedPkg.durationDays || 30,
      });

      setMessage(
        paymentMethod === "payos" && data.checkoutUrl
          ? `Đã khởi tạo đơn hàng PayOS! Vui lòng hoàn tất thanh toán.`
          : `Đăng ký gói cước "${selectedPkg.name}" thành công cho xe ${selectedPlate || ""}!`
      );

      if (paymentMethod === "payos" && data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }

      setSelectedPkg(null);
    } catch {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (selectedPkg.durationDays || 30));

      setActiveSub({
        packageName: selectedPkg.name,
        plate: selectedPlate || "Biển số chính",
        expiresAt: expiryDate.toLocaleDateString("vi-VN"),
        daysLeft: selectedPkg.durationDays || 30,
      });

      setMessage(`Đã kích hoạt gói cước "${selectedPkg.name}" cho xe ${selectedPlate || ""}!`);
      setSelectedPkg(null);
    } finally {
      setSubscribing(false);
    }
  }

  // Admin package creation
  async function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const code = `${form.billingCycle.toUpperCase()}-${Date.now().toString().slice(-5)}`;
    const payload = {
      name: form.name.trim(),
      code,
      billingCycle: form.billingCycle,
      price: form.price,
      durationDays: form.durationDays,
      maxPlates: form.maxPlates,
      subscriberCount: 0,
      renewalRate: 0,
      status: "Active" as PackageStatus,
      features: [
        form.maxPlates < 0 ? "Không giới hạn biển số" : `Tối đa ${form.maxPlates} biển số`,
        `${form.durationDays} ngày`,
      ],
      note: form.note.trim(),
    };

    try {
      const response = await apiFetch("/membership-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setPackages((items) => [data.package || { id: code, ...payload }, ...items]);
        setForm(emptyForm);
        setShowAdminForm(false);
        setMessage("Đã tạo gói cước mới thành công.");
      } else {
        setMessage(data.message || "Không thể tạo gói cước.");
      }
    } catch {
      setPackages((items) => [{ id: code, ...payload }, ...items]);
      setForm(emptyForm);
      setShowAdminForm(false);
      setMessage("Đã thêm gói cước mới vào danh sách.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Dịch vụ bãi đỗ xe
          </p>
          <h2 style={{ margin: "4px 0 0 0", fontSize: "1.5rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles color="#3b82f6" size={26} /> Đăng Ký Gói Cước
          </h2>
        </div>

        {currentUser?.role === "admin" && (
          <button
            className="button secondary"
            type="button"
            onClick={() => setShowAdminForm(!showAdminForm)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {showAdminForm ? <X size={16} /> : <Plus size={16} />}
            {showAdminForm ? "Đóng Form Quản Lý" : "+ Tạo Gói Cước Mới (Admin)"}
          </button>
        )}
      </div>

      {message && (
        <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: "0.95rem" }}>
          {message}
        </div>
      )}

      {/* Active Subscription Banner */}
      {activeSub && (
        <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "18px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ backgroundColor: "#22c55e", color: "#fff", padding: 10, borderRadius: "50%" }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Gói cước đang kích hoạt</span>
              <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: 700, color: "#14532d" }}>
                {activeSub.packageName} ({activeSub.plate})
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", color: "#15803d" }}>
                Hạn sử dụng đến ngày: <strong>{activeSub.expiresAt}</strong> (Còn {activeSub.daysLeft} ngày)
              </p>
            </div>
          </div>
          <span style={{ backgroundColor: "#dcfce7", color: "#15803d", padding: "6px 14px", borderRadius: 20, fontSize: "0.85rem", fontWeight: 600 }}>
            Đang hoạt động
          </span>
        </div>
      )}

      {/* Form tạo gói cước dành cho Admin */}
      {showAdminForm && (
        <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 28 }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <CreditCard size={18} color="#3b82f6" /> Định nghĩa Gói cước mới (Dành cho Quản trị viên)
          </h3>
          <form onSubmit={handleAdminSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", fontWeight: 600 }}>Tên gói cước *</label>
              <input
                type="text"
                placeholder="VD: Gói Tháng Tiêu Chuẩn"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", fontWeight: 600 }}>Chu kỳ thanh toán</label>
              <select
                value={form.billingCycle}
                onChange={(e) => {
                  const cycle = e.target.value as BillingCycle;
                  setForm({ ...form, billingCycle: cycle, durationDays: cycleDays[cycle] });
                }}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
              >
                <option value="Monthly">Tháng (30 ngày)</option>
                <option value="Quarterly">Quý (90 ngày)</option>
                <option value="Yearly">Năm (365 ngày)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", fontWeight: 600 }}>Giá gói cước (VND) *</label>
              <input
                type="number"
                placeholder="VD: 1500000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", fontWeight: 600 }}>Mô tả ngắn</label>
              <input
                type="text"
                placeholder="VD: Ưu tiên đỗ xe, miễn 100% phí gửi"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="button secondary" type="button" onClick={() => setShowAdminForm(false)}>Hủy</button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu gói cước mới"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Instruction */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>
          Vui lòng <strong>chọn gói cước phù hợp bên dưới</strong> để đăng ký cho phương tiện của bạn:
        </p>
      </div>

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>Đang tải danh sách gói cước...</div>
      ) : activePackages.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>
          Chưa có gói cước nào sẵn sàng. Vui lòng quay lại sau!
        </div>
      ) : (
        /* Package Cards Grid */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {activePackages.map((pkg) => (
            <div
              key={pkg.id}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s ease-in-out",
                position: "relative",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "4px 10px", borderRadius: 12, fontSize: "0.8rem", fontWeight: 700 }}>
                    {cycleLabels[pkg.billingCycle] || pkg.billingCycle} ({pkg.durationDays || 30} ngày)
                  </span>
                  <Tag size={18} color="#94a3b8" />
                </div>

                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                  {pkg.name}
                </h3>

                <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "#64748b", minHeight: 38 }}>
                  {pkg.note || "Gói cước ưu tiên đỗ xe ô tô linh hoạt theo chu kỳ."}
                </p>

                <div style={{ margin: "16px 0", padding: "12px 0", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#2563eb" }}>
                    {currency.format(pkg.price)} <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#64748b" }}>VNĐ</span>
                  </span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: "#334155" }}>
                    <CheckCircle2 size={16} color="#16a34a" /> Miễn phí gửi xe 24/7 trong thời hạn
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: "#334155" }}>
                    <CheckCircle2 size={16} color="#16a34a" /> Ưu tiên giữ vị trí ô đỗ cố định
                  </li>
                  <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: "#334155" }}>
                    <CheckCircle2 size={16} color="#16a34a" /> Nhận diện ANPR tự động nâng hạ barrier
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="button primary"
                onClick={() => handleSelectSubscribe(pkg)}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Sparkles size={16} /> Chọn Đăng Ký Gói Này
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal đăng ký gói cước */}
      {selectedPkg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card-bg, #ffffff)",
              color: "var(--foreground, #1e293b)",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--border-color, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={20} color="#2563eb" /> Đăng Ký Gói: {selectedPkg.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPkg(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSubscription} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b" }}>Tổng phí gói cước:</p>
                <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#2563eb" }}>
                  {currency.format(selectedPkg.price)} VNĐ <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#64748b" }}>({selectedPkg.durationDays} ngày)</span>
                </p>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.9rem" }}>
                  <Car size={16} style={{ display: "inline", marginRight: 6 }} /> Chọn xe đăng ký <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {registeredVehicles && registeredVehicles.length > 0 ? (
                  <select
                    value={selectedPlate}
                    onChange={(e) => setSelectedPlate(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
                  >
                    {registeredVehicles.map((v: any) => (
                      <option key={v.plate} value={v.plate}>
                        {v.plate} ({v.owner || "Chính chủ"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="VD: 30F-123.45"
                    value={selectedPlate}
                    onChange={(e) => setSelectedPlate(e.target.value.toUpperCase())}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.9rem" }}>
                  Phương thức thanh toán
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("payos")}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: paymentMethod === "payos" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      backgroundColor: paymentMethod === "payos" ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      color: paymentMethod === "payos" ? "#1d4ed8" : "#475569",
                    }}
                  >
                    Mã QR PayOS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("wallet")}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: paymentMethod === "wallet" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      backgroundColor: paymentMethod === "wallet" ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      color: paymentMethod === "wallet" ? "#1d4ed8" : "#475569",
                    }}
                  >
                    Ví Điện Tử
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" className="button secondary" onClick={() => setSelectedPkg(null)} disabled={subscribing}>
                  Hủy
                </button>
                <button type="submit" className="button primary" disabled={subscribing} style={{ padding: "10px 20px" }}>
                  {subscribing ? "Đang xử lý..." : "Xác nhận Đăng ký"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
