"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  Loader2,
  Shield,
  Trash2,
  X,
} from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type PrivacyDataCounts = {
  vehicles: number;
  sessions: number;
  transactions: number;
  logs: number;
};

type PrivacySettings = {
  dataExportedAt?: string;
  deletionRequestedAt?: string;
  dataCounts?: PrivacyDataCounts;
};

export function PrivacyView() {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await apiFetch("/privacy/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        setMsg("Không thể tải cài đặt quyền riêng tư.");
      }
    } catch {
      setMsg("Lỗi kết nối khi tải cài đặt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleExport() {
    setExporting(true);
    setMsg("");
    try {
      const res = await apiFetch("/privacy/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ipark-data-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMsg("Xuất dữ liệu thành công. Tệp đã được tải xuống.");
      } else {
        const data = await res.json().catch(() => null);
        setMsg(data?.message || "Không thể xuất dữ liệu.");
      }
    } catch {
      setMsg("Lỗi kết nối khi xuất dữ liệu.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmText !== "XÓA DỮ LIỆU") {
      setMsg("Vui lòng nhập chính xác 'XÓA DỮ LIỆU' để xác nhận.");
      return;
    }
    setDeleting(true);
    setMsg("");
    try {
      const res = await apiFetch("/privacy/delete", { method: "DELETE" });
      if (res.ok) {
        setMsg("Yêu cầu xóa dữ liệu đã được gửi thành công.");
        setShowDeleteConfirm(false);
        setDeleteConfirmText("");
        loadSettings();
      } else {
        const data = await res.json().catch(() => null);
        setMsg(data?.message || "Không thể xóa dữ liệu.");
      }
    } catch {
      setMsg("Lỗi kết nối khi xóa dữ liệu.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section className="content-single">
        <div className="panel">
          <p className="muted-cell" style={{ textAlign: "center", padding: 48 }}>
            <Loader2 className="spin" size={20} /> Đang tải...
          </p>
        </div>
      </section>
    );
  }

  const counts = settings?.dataCounts;

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Quyền riêng tư</p>
            <h2>Quản lý quyền riêng tư</h2>
          </div>
          <Shield size={22} />
        </div>

        {msg && <p className="muted-cell" style={{ marginBottom: 12 }}>{msg}</p>}

        {/* Section 1: Export personal data */}
        <div className="panel" style={{ marginBottom: 16, border: "1px solid #333" }}>
          <div className="panel-heading">
            <div>
              <p>Xuất dữ liệu</p>
              <h2>Xuất dữ liệu cá nhân</h2>
            </div>
            <Download size={20} />
          </div>
          <p className="muted-cell" style={{ marginBottom: 12 }}>
            Tải về toàn bộ dữ liệu cá nhân của bạn dưới dạng tệp JSON, bao gồm thông tin tài khoản,
            phương tiện, lịch sử gửi xe và giao dịch.
          </p>
          {settings?.dataExportedAt && (
            <p className="muted-cell" style={{ marginBottom: 12, fontSize: 12 }}>
              Lần xuất gần nhất: {new Date(settings.dataExportedAt).toLocaleString("vi-VN")}
            </p>
          )}
          <button
            className="small-button"
            onClick={handleExport}
            disabled={exporting}
            type="button"
          >
            {exporting ? <Loader2 className="spin" size={14} /> : <Download size={14} />}
            {exporting ? "Đang xuất..." : "Xuất dữ liệu cá nhân"}
          </button>
        </div>

        {/* Section 2: Delete personal data */}
        <div
          className="panel"
          style={{
            marginBottom: 16,
            border: "1px solid #7f1d1d",
            background: "rgba(127, 29, 29, 0.05)",
          }}
        >
          <div className="panel-heading">
            <div>
              <p style={{ color: "#ef4444" }}>Nguy hiểm</p>
              <h2>Xóa dữ liệu cá nhân</h2>
            </div>
            <Trash2 size={20} style={{ color: "#ef4444" }} />
          </div>

          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
              <strong style={{ color: "#ef4444" }}>Cảnh báo: Hành động này không thể hoàn tác</strong>
            </div>
            <ul style={{ marginLeft: 26, color: "#fca5a5", fontSize: 14, lineHeight: 1.8 }}>
              <li>Toàn bộ thông tin cá nhân sẽ bị xóa vĩnh viễn</li>
              <li>Lịch sử gửi xe và giao dịch sẽ bị ẩn danh hóa</li>
              <li>Phương tiện đã đăng ký sẽ bị xóa</li>
              <li>Bạn sẽ không thể khôi phục dữ liệu sau khi xóa</li>
              <li>Bạn có thể bị đăng xuất khỏi hệ thống</li>
            </ul>
          </div>

          {!showDeleteConfirm ? (
            <button
              className="danger-button"
              onClick={() => setShowDeleteConfirm(true)}
              type="button"
            >
              <Trash2 size={16} /> Yêu cầu xóa dữ liệu
            </button>
          ) : (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <p style={{ marginBottom: 8, fontWeight: 600 }}>
                Nhập <code style={{ background: "#333", padding: "2px 6px", borderRadius: 4 }}>XÓA DỮ LIỆU</code> để xác nhận:
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Nhập 'XÓA DỮ LIỆU'"
                  style={{ flex: 1, minWidth: 200 }}
                />
                <button
                  className="danger-button"
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== "XÓA DỮ LIỆU"}
                  type="button"
                >
                  {deleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                  {deleting ? "Đang xóa..." : "Xác nhận xóa"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  type="button"
                >
                  <X size={16} /> Hủy
                </button>
              </div>
            </div>
          )}

          {settings?.deletionRequestedAt && (
            <p className="muted-cell" style={{ marginTop: 12, fontSize: 12 }}>
              Yêu cầu xóa gần nhất: {new Date(settings.deletionRequestedAt).toLocaleString("vi-VN")}
            </p>
          )}
        </div>

        {/* Section 3: Data information */}
        <div className="panel" style={{ border: "1px solid #333" }}>
          <div className="panel-heading">
            <div>
              <p>Thông tin</p>
              <h2>Thông tin dữ liệu</h2>
            </div>
            <Check size={20} />
          </div>
          <p className="muted-cell" style={{ marginBottom: 16 }}>
            Dữ liệu cá nhân của bạn đang được lưu trữ trong hệ thống:
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Loại dữ liệu</th>
                  <th>Số lượng</th>
                  <th>Mô tả</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Phương tiện</strong></td>
                  <td>
                    <span className="badge">{counts?.vehicles ?? 0}</span>
                  </td>
                  <td className="muted-cell">Phương tiện đã đăng ký trong hệ thống</td>
                </tr>
                <tr>
                  <td><strong>Phiên gửi xe</strong></td>
                  <td>
                    <span className="badge">{counts?.sessions ?? 0}</span>
                  </td>
                  <td className="muted-cell">Lịch sử gửi và lấy xe</td>
                </tr>
                <tr>
                  <td><strong>Giao dịch</strong></td>
                  <td>
                    <span className="badge">{counts?.transactions ?? 0}</span>
                  </td>
                  <td className="muted-cell">Giao dịch thanh toán, nạp tiền</td>
                </tr>
                <tr>
                  <td><strong>Nhật ký</strong></td>
                  <td>
                    <span className="badge">{counts?.logs ?? 0}</span>
                  </td>
                  <td className="muted-cell">Nhật ký nhận diện và hoạt động</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
