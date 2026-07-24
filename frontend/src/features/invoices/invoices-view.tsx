"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, PlusCircle, Search } from "lucide-react";

import { apiFetch } from "@/lib/client-api";
import type { InvoiceItem } from "@/types";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "Draft", label: "Nháp" },
  { value: "Issued", label: "Đã phát hành" },
  { value: "Paid", label: "Đã thanh toán" },
  { value: "Cancelled", label: "Đã hủy" },
];

function statusBadge(status: string) {
  switch (status) {
    case "Draft":
      return <span className="badge">Nháp</span>;
    case "Issued":
      return <span className="badge" style={{ background: "#1d4ed8", color: "#fff" }}>Đã phát hành</span>;
    case "Paid":
      return <span className="badge success">Đã thanh toán</span>;
    case "Cancelled":
      return <span className="badge danger">Đã hủy</span>;
    default:
      return <span className="badge">{status}</span>;
  }
}

export function InvoicesView() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [sessionId, setSessionId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  async function loadInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      const qs = params.toString();
      const res = await apiFetch(`/invoices${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : data.invoices || []);
      } else {
        setMsg("Không thể tải danh sách hóa đơn.");
      }
    } catch {
      setMsg("Lỗi kết nối khi tải hóa đơn.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerName.trim()) {
      setMsg("Vui lòng nhập tên khách hàng.");
      return;
    }
    setCreating(true);
    setMsg("");
    try {
      const res = await apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Tạo hóa đơn thành công.");
        setSessionId("");
        setCustomerName("");
        setCustomerEmail("");
        setShowCreate(false);
        loadInvoices();
      } else {
        setMsg(data.message || "Không thể tạo hóa đơn.");
      }
    } catch {
      setMsg("Lỗi kết nối khi tạo hóa đơn.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hóa đơn</p>
            <h2>Hóa đơn điện tử</h2>
          </div>
          <FileText size={22} />
        </div>

        {msg && <p className="muted-cell" style={{ marginBottom: 12 }}>{msg}</p>}

        {/* Filters & create button */}
        <div className="filter-row" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={16} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ minWidth: 160 }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="small-button"
            onClick={() => setShowCreate(!showCreate)}
            type="button"
          >
            <PlusCircle size={14} /> Tạo hóa đơn
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form className="stack-form" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
            <div className="panel-heading">
              <div>
                <p>Mới</p>
                <h2>Tạo hóa đơn</h2>
              </div>
              <PlusCircle size={20} />
            </div>
            <div className="filter-row" style={{ gap: 12, flexWrap: "wrap" }}>
              <input
                name="sessionId"
                placeholder="Mã phiên gửi xe (tùy chọn)"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              <input
                name="customerName"
                placeholder="Tên khách hàng *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                style={{ flex: 1, minWidth: 180 }}
              />
              <input
                name="customerEmail"
                placeholder="Email khách hàng (tùy chọn)"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              <button className="small-button" type="submit" disabled={creating}>
                {creating ? <Loader2 className="spin" size={14} /> : <PlusCircle size={14} />}
                {creating ? "Đang tạo..." : "Tạo"}
              </button>
            </div>
          </form>
        )}

        {/* Invoice table */}
        {loading ? (
          <p className="muted-cell" style={{ textAlign: "center", padding: 24 }}>
            <Loader2 className="spin" size={18} /> Đang tải...
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Số hóa đơn</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>
                      {inv.customerName}
                      {inv.customerEmail && (
                        <span className="muted-cell" style={{ display: "block", fontSize: 12 }}>
                          {inv.customerEmail}
                        </span>
                      )}
                    </td>
                    <td>{inv.total?.toLocaleString("vi-VN")} đ</td>
                    <td>{statusBadge(inv.status)}</td>
                    <td>{new Date(inv.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td>
                      <div className="inline-actions">
                        {inv.status === "Draft" && (
                          <button
                            className="small-button"
                            onClick={async () => {
                              const res = await apiFetch(`/invoices/${inv.id}/issue`, { method: "PATCH" });
                              if (res.ok) {
                                setMsg("Đã phát hành hóa đơn.");
                                loadInvoices();
                              } else {
                                setMsg("Lỗi phát hành hóa đơn.");
                              }
                            }}
                            type="button"
                          >
                            Phát hành
                          </button>
                        )}
                        {inv.status === "Issued" && (
                          <button
                            className="small-button success"
                            onClick={async () => {
                              const res = await apiFetch(`/invoices/${inv.id}/pay`, { method: "PATCH" });
                              if (res.ok) {
                                setMsg("Đã đánh dấu thanh toán.");
                                loadInvoices();
                              } else {
                                setMsg("Lỗi cập nhật thanh toán.");
                              }
                            }}
                            type="button"
                          >
                            Đã thanh toán
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td className="muted-cell" colSpan={6} style={{ textAlign: "center" }}>
                      Chưa có hóa đơn nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
