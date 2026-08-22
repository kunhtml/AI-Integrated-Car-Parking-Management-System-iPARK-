"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  Edit,
  Eraser,
  Filter,
  Keyboard,
  Loader2,
  Plus,
  Radio,
  RefreshCcw,
  ScanLine,
  Search,
  Square,
  Trash2,
  UserCheck,
  X,
  XCircle,
  Zap,
  Sparkles,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { useParkingApp } from "@/context/parking-app-context";
import { apiFetch, bridgeFetch } from "@/lib/client-api";

type RfidCardItem = {
  id: string;
  uid: string;
  ownerName: string;
  plate: string;
  userType: "resident" | "guest";
  status: string;
  notes?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
};

type Resident = {
  subscriptionId: string;
  planName: string;
  endDate: string | Date;
  vehicleId: string;
  plate: string;
  ownerName: string;
  userId: string;
  email: string;
  phone: string;
  memberCode: string | null;
};

type StatusFilter = "all" | "active" | "inactive" | "blocked";
type UserTypeFilter = "all" | "resident" | "guest";

type EditState = {
  card: RfidCardItem;
  ownerName: string;
  plate: string;
  userType: "resident" | "guest";
  notes: string;
};

function userTypeLabel(type: string) {
  if (type === "resident") return "Cư dân";
  if (type === "guest") return "Khách";
  return type;
}

function statusBadgeClass(status: string) {
  return ["active", "available", "in-use"].includes(status) ? "badge success" : "badge warning";
}

function isOperationalStatus(status: string) {
  return ["active", "available", "in-use"].includes(status);
}

function statusLabel(status: string) {
  if (isOperationalStatus(status)) return "Hoạt động";
  if (status === "inactive") return "Không hoạt động";
  if (status === "lost") return "Báo mất";
  if (status === "damaged") return "Hỏng";
  return "Đã khóa";
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("vi-VN");
}


export function RfidCardsView() {
  const { currentUser } = useParkingApp();
  const role = currentUser?.role;
  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isCustomer = role === "customer";

  // Customer view is handled by the same compact card list below.
  void isCustomer;

  // Staff chưa có quyền nếu backend từ chối → cảnh báo rõ
  if (!isAdmin && !isStaff) {
    return (
      <section className="rfid-view">
        <h1 className="rfid-view-title">Thẻ RFID</h1>
        <p style={{ color: "#dc2626", marginTop: 16 }}>
          Tài khoản hiện tại (role: <strong>{role ?? "—"}</strong>) không có quyền truy cập trang này.
          Vui lòng đăng nhập bằng tài khoản admin hoặc staff.
        </p>
      </section>
    );
  }

  const [cards, setCards] = useState<RfidCardItem[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [lockingCard, setLockingCard] = useState<RfidCardItem | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<RfidCardItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkClear, setBulkClear] = useState<{
    mode: "reset" | "delete";
    scope: "all" | "selected";
  } | null>(null);
  const [bulkConfirmText, setBulkConfirmText] = useState("");

  // Các selection hiện tại ở form Thêm/Sửa — lưu subscriptionId khi chọn cư dân.
  // Lưu riêng vì form dùng FormData / state — cần trigger re-render khi đổi.
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [editSelectedResidentId, setEditSelectedResidentId] = useState("");

  // Scan mode state
  type AddMode = "manual" | "scan";
  type ScanPhase = "idle" | "starting" | "waiting" | "success" | "duplicate" | "error" | "timeout";
  const [addMode, setAddMode] = useState<AddMode>("manual");
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanUid, setScanUid] = useState("");
  const [scanError, setScanError] = useState("");
  const scanIntervalRef = useRef<number | null>(null);
  const scanStartTimeRef = useRef<number>(0);
  const SCAN_TIMEOUT_MS = 15_000;
  const SCAN_POLL_MS = 700;

  async function loadCards() {
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch("/rfid");
      if (res.ok) {
        const data = await res.json();
        setCards(Array.isArray(data.cards) ? data.cards : []);
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data.message || "Không tải được danh sách thẻ.");
      }
    } catch (e) {
      setMsg("Lỗi kết nối tới backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function loadResidents() {
    try {
      const res = await apiFetch("/rfid/unassigned-residents");
      if (res.ok) {
        const data = await res.json();
        setResidents(Array.isArray(data.residents) ? data.residents : []);
      } else {
        setResidents([]);
      }
    } catch {
      setResidents([]);
    }
  }

  // Cleanup scan interval khi unmount
  useEffect(() => {
    return () => stopScanPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load residents mỗi khi mở modal Add
  useEffect(() => {
    if (showAddForm) {
      setSelectedResidentId("");
      void loadResidents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm]);

  // Khi mở modal Edit: load residents và preselect nếu card thuộc về 1 cư dân
  useEffect(() => {
    if (!editing) {
      setEditSelectedResidentId("");
      return;
    }
    void loadResidents().then(() => {
      // Sau khi load xong residents, tìm cư dân trùng plate với card.
      // Nếu tìm thấy → preselect. Nếu card là resident nhưng plate không có
      // trong list (vì đã gán thẻ rồi → endpoint loại trừ) → tạo 1 entry tạm
      // từ dữ liệu hiện tại của card để dropdown hiển thị đúng người đang sửa.
      const matched = residents.find(
        (r) => r.plate && editing.plate && r.plate === editing.plate
      );
      if (matched) {
        setEditSelectedResidentId(matched.subscriptionId);
      } else if (editing.userType === "resident" && editing.plate) {
        // Đã gán rồi → tạo pseudo-id để hiển thị "đang gán cho cư dân này"
        setEditSelectedResidentId(`__current__:${editing.plate}`);
      } else {
        setEditSelectedResidentId("");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, residents.length]);

  // Khi chọn cư dân (form Sửa) → nếu không phải pseudo-id hiện tại → set locked
  // và lấy biển số/loại từ cư dân. Nếu chọn "" (bỏ gán) → mở lại để sửa tay.
  useEffect(() => {
    if (!editing) return;
    if (!editSelectedResidentId) {
      // bỏ gán → không thay đổi state
      return;
    }
    if (editSelectedResidentId.startsWith("__current__")) {
      // đang hiển thị cư dân hiện tại của thẻ (đã gán rồi) → không cho đổi qua
      // option khác trừ khi user chọn 1 resident khác.
      return;
    }
    const r = residents.find((x) => x.subscriptionId === editSelectedResidentId);
    if (!r) return;
    setEditing({
      ...editing,
      ownerName: r.ownerName || editing.ownerName,
      plate: r.plate || editing.plate,
      userType: "resident",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSelectedResidentId, residents.length]);

  // Cleanup scan khi đóng modal
  useEffect(() => {
    if (!showAddForm) {
      stopScanPolling();
      setAddMode("manual");
      setScanPhase("idle");
      setScanUid("");
      setScanError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm]);

  function stopScanPolling() {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }

  async function cancelScan() {
    stopScanPolling();
    setScanPhase("idle");
    setScanError("");
    try {
      await bridgeFetch("/api/rfid/scan/cancel", { method: "POST" });
    } catch {
      /* ignore — UI vẫn reset */
    }
  }

  async function startScan() {
    setScanError("");
    setScanUid("");
    setScanPhase("starting");
    try {
      const res = await bridgeFetch("/api/rfid/scan/start", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScanPhase("error");
        setScanError(data.message || "Không bật được chế độ quét thẻ.");
        return;
      }
      scanStartTimeRef.current = Date.now();
      setScanPhase("waiting");
      stopScanPolling();
      scanIntervalRef.current = window.setInterval(pollScanStatus, SCAN_POLL_MS);
    } catch (e) {
      setScanPhase("error");
      setScanError(
        "Không kết nối được bridge service (port 5050). Chuyển sang nhập tay."
      );
    }
  }

  async function pollScanStatus() {
    if (Date.now() - scanStartTimeRef.current > SCAN_TIMEOUT_MS) {
      stopScanPolling();
      setScanPhase("timeout");
      try {
        await bridgeFetch("/api/rfid/scan/cancel", { method: "POST" });
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const res = await bridgeFetch("/api/rfid/scan/poll");
      if (!res.ok) {
        // Bridge lỗi → dừng polling
        stopScanPolling();
        setScanPhase("error");
        setScanError(`Bridge service trả ${res.status}.`);
        return;
      }
      const data = await res.json();
      if (data.status === "waiting") {
        return; // Tiếp tục đợi
      }
      if (data.status === "success") {
        stopScanPolling();
        setScanUid(data.uid || "");
        setScanPhase("success");
        return;
      }
      if (data.status === "duplicate") {
        stopScanPolling();
        setScanUid(data.uid || "");
        setScanPhase("duplicate");
        return;
      }
      if (data.status === "error") {
        stopScanPolling();
        setScanUid(data.uid || "");
        setScanPhase("error");
        setScanError("ESP32 báo lỗi khi quét thẻ.");
        return;
      }
      if (data.status === "timeout") {
        stopScanPolling();
        setScanPhase("timeout");
        return;
      }
      // status === "idle" → tiếp tục đợi kết quả scan từ bridge
    } catch (e) {
      stopScanPolling();
      setScanPhase("error");
      setScanError("Mất kết nối tới bridge service khi polling.");
    }
  }

  function acceptScannedUidAndContinue() {
    if (!scanUid) return;
    // Tự điền UID vào form, chuyển sang tab "manual" để user điền tiếp.
    // Mặc định thẻ quét thẳng từ ESP32 → không gán cho cư dân nào → type = guest.
    setAddMode("manual");
    setSelectedResidentId(""); // reset về guest
    // Sau khi re-render, các input sẽ mount lại — dùng timeout để set UID
    window.setTimeout(() => {
      const formEl = document.querySelector<HTMLFormElement>(
        'form[data-add-rfid-form]'
      );
      if (formEl) {
        const uidInput = formEl.elements.namedItem("uid") as HTMLInputElement | null;
        if (uidInput) {
          uidInput.value = scanUid;
        }
        const userTypeSelect = formEl.elements.namedItem("userType") as HTMLSelectElement | null;
        if (userTypeSelect) userTypeSelect.value = "guest";
      }
    }, 0);
  }

  function handleSelectResidentInAddForm(residentId: string) {
    setSelectedResidentId(residentId);
    const r = residents.find((x) => x.subscriptionId === residentId);
    if (!r) {
      // Không chọn → reset các field
      return;
    }
    // Sau khi React re-render select, ta set value cho input/select của form thủ công
    window.setTimeout(() => {
      const formEl = document.querySelector<HTMLFormElement>(
        'form[data-add-rfid-form]'
      );
      if (!formEl) return;
      const ownerInput = formEl.elements.namedItem("ownerName") as HTMLInputElement | null;
      if (ownerInput) ownerInput.value = r.ownerName || "";
      const plateInput = formEl.elements.namedItem("plate") as HTMLInputElement | null;
      if (plateInput) plateInput.value = r.plate || "";
      const userTypeSelect = formEl.elements.namedItem("userType") as HTMLSelectElement | null;
      if (userTypeSelect) userTypeSelect.value = "resident";
    }, 0);
  }

  function handleSelectResidentInEditForm(residentId: string) {
    setEditSelectedResidentId(residentId);
    if (!editing) return;
    const r = residents.find((x) => x.subscriptionId === residentId);
    if (!r) {
      // Không chọn → giữ nguyên giá trị đang sửa
      return;
    }
    setEditing({
      ...editing,
      ownerName: r.ownerName || editing.ownerName,
      plate: r.plate || editing.plate,
      userType: "resident",
    });
  }

  const stats = useMemo(() => {
    const total = cards.length;
    const active = cards.filter((c) => isOperationalStatus(c.status)).length;
    const inactive = cards.filter((c) => !isOperationalStatus(c.status)).length;
    const resident = cards.filter((c) => c.userType === "resident").length;
    const guest = cards.filter((c) => c.userType === "guest").length;
    return { total, active, inactive, resident, guest };
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Nếu filter rỗng → trả về toàn bộ (không filter)
    const hasFilter =
      q !== "" || statusFilter !== "all" || userTypeFilter !== "all";
    if (!hasFilter) return cards;
    return cards.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (userTypeFilter !== "all" && c.userType !== userTypeFilter) return false;
      if (!q) return true;
      return (
        c.uid.toLowerCase().includes(q) ||
        (c.ownerName || "").toLowerCase().includes(q) ||
        (c.plate || "").toLowerCase().includes(q)
      );
    });
  }, [cards, search, statusFilter, userTypeFilter]);

  const hasActiveFilter =
    search !== "" || statusFilter !== "all" || userTypeFilter !== "all";

  // Form Sửa: khóa field Biển số/Loại khi đã chọn 1 cư dân THẬT (không phải pseudo
  // "__current__" hiển thị cư dân hiện tại đang gán cho thẻ, không phải "" rỗng).
  const editIsResidentLocked =
    !!editSelectedResidentId && !editSelectedResidentId.startsWith("__current__");

  // Form Thêm: tương tự
  const addIsResidentLocked = !!selectedResidentId;

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setUserTypeFilter("all");
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = new FormData(e.currentTarget);
    const uid = String(form.get("uid") || "").trim();
    if (!uid) {
      setMsg("UID không được để trống.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        uid,
        ownerName: String(form.get("ownerName") || "").trim(),
        plate: String(form.get("plate") || "").trim().toUpperCase().replace(/[\s-]+/g, ""),
        userType: (String(form.get("userType") || "guest") as "resident" | "guest"),
        notes: String(form.get("notes") || "").trim() || undefined,
      };
      const res = await apiFetch("/rfid", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Đã thêm thẻ ${uid}`);
        setShowAddForm(false);
        await loadCards();
      } else {
        setMsg(data.message || "Không thêm được thẻ.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/rfid/${editing.card.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ownerName: editing.ownerName.trim(),
          plate: editing.plate.trim().toUpperCase().replace(/[\s-]+/g, ""),
          userType: editing.userType,
          notes: editing.notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Đã cập nhật thẻ ${editing.card.uid}`);
        setEditing(null);
        await loadCards();
      } else {
        setMsg(data.message || "Không cập nhật được thẻ.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/rfid/${confirmDelete.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Đã xóa thẻ ${confirmDelete.uid}`);
        setConfirmDelete(null);
        await loadCards();
      } else {
        setMsg(data.message || "Không xóa được thẻ.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(card: RfidCardItem, reason?: string) {
    if (submitting) return;
    const nextStatus = isOperationalStatus(card.status) ? "inactive" : "active";
    setSubmitting(true);
    try {
      const res = await apiFetch(isOperationalStatus(card.status) ? `/rfid/${card.id}/blocked` : `/rfid/${card.id}/status`, {
        method: "POST",
        body: JSON.stringify(card.status === "active" ? { reason: reason?.trim() } : { status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Đã ${nextStatus === "active" ? "mở khóa" : "khóa"} thẻ ${card.uid}`);
        await loadCards();
      } else {
        setMsg(data.message || "Không đổi được trạng thái.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allIds = filtered.map((c) => c.id);
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  }

  async function executeBulkClear() {
    if (!bulkClear || submitting) return;
    if (bulkConfirmText !== "RESET_ALL_RFID_DATA") {
      setMsg("Vui lòng nhập đúng chuỗi xác nhận.");
      return;
    }
    const payload: { mode: "reset" | "delete"; ids?: string[]; confirm: string } = {
      mode: bulkClear.mode,
      confirm: "RESET_ALL_RFID_DATA",
    };
    if (bulkClear.scope === "selected" && selectedIds.size > 0) {
      payload.ids = Array.from(selectedIds);
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/rfid/bulk-clear", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(data.message || "Đã xử lý.");
        setBulkClear(null);
        setBulkConfirmText("");
        setSelectedIds(new Set());
        await loadCards();
      } else {
        setMsg(data.message || "Không thực hiện được.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>RFID</p>
            <h2>Quản lý thẻ RFID</h2>
          </div>
          <div className="panel-heading-right">
            <span className="muted-cell">
              {filtered.length} / {cards.length} thẻ
            </span>
            <CreditCard size={22} />
          </div>
        </div>

        {/* Stats */}
        <div className="rfid-stats">
          <StatCard color="slate" label="Tổng thẻ" value={stats.total} />
          <StatCard color="green" label="Đang hoạt động" value={stats.active} />
          <StatCard color="amber" label="Đã khóa" value={stats.inactive} />
          <StatCard color="blue" label="Cư dân" value={stats.resident} />
          <StatCard color="purple" label="Khách" value={stats.guest} />
        </div>

        {/* Toolbar */}
        <div className="rfid-toolbar">
          <div className="rfid-toolbar-left">
            <div className="rfid-segmented">
              <span className="rfid-segmented-label">
                <Filter size={13} /> Trạng thái
              </span>
              <div className="rfid-segmented-group">
                <SegBtn
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                >
                  Tất cả
                </SegBtn>
                <SegBtn
                  active={statusFilter === "active"}
                  onClick={() => setStatusFilter("active")}
                  tone="green"
                >
                  Hoạt động
                </SegBtn>
                <SegBtn
                  active={statusFilter === "inactive" || statusFilter === "blocked"}
                  onClick={() => setStatusFilter("blocked")}
                  tone="amber"
                >
                  Đã khóa
                </SegBtn>
              </div>
            </div>

            <div className="rfid-segmented">
              <span className="rfid-segmented-label">Loại</span>
              <div className="rfid-segmented-group">
                <SegBtn
                  active={userTypeFilter === "all"}
                  onClick={() => setUserTypeFilter("all")}
                >
                  Tất cả
                </SegBtn>
                <SegBtn
                  active={userTypeFilter === "resident"}
                  onClick={() => setUserTypeFilter("resident")}
                  tone="blue"
                >
                  Cư dân
                </SegBtn>
                <SegBtn
                  active={userTypeFilter === "guest"}
                  onClick={() => setUserTypeFilter("guest")}
                  tone="purple"
                >
                  Khách
                </SegBtn>
              </div>
            </div>

            {hasActiveFilter && (
              <button className="rfid-link-btn" onClick={resetFilters} type="button">
                <X size={13} /> Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="rfid-toolbar-right">
            <div className="rfid-search">
              <Search size={14} />
              <input
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm UID, tên, biển số..."
                value={search}
                type="search"
              />
              {search && (
                <button
                  type="button"
                  className="rfid-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button className="small-button" onClick={loadCards} disabled={loading} type="button">
              <RefreshCcw size={13} className={loading ? "spin" : ""} /> Tải lại
            </button>

            {isAdmin && (
              <button
                className="small-button primary"
                onClick={() => setShowAddForm(true)}
                type="button"
              >
                <Plus size={14} /> Thêm thẻ
              </button>
            )}

            {isAdmin && (
              <button
                className="small-button"
                onClick={() => {
                  setBulkClear({ mode: "reset", scope: "all" });
                  setBulkConfirmText("");
                }}
                type="button"
                style={{ color: "#b45309", borderColor: "#b45309" }}
                title="Reset toàn bộ thẻ về trống"
              >
                <Eraser size={14} /> Clear toàn bộ
              </button>
            )}
          </div>
        </div>

        {isAdmin && selectedIds.size > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 600, color: "#1e40af" }}>
              Đã chọn {selectedIds.size} thẻ
            </span>
            <button
              className="small-button"
              type="button"
              onClick={() => {
                setBulkClear({ mode: "reset", scope: "selected" });
                setBulkConfirmText("");
              }}
              style={{ color: "#b45309", borderColor: "#b45309" }}
            >
              <Eraser size={13} /> Reset dữ liệu
            </button>
            <button
              className="small-button"
              type="button"
              onClick={() => {
                setBulkClear({ mode: "delete", scope: "selected" });
                setBulkConfirmText("");
              }}
              style={{ color: "#dc2626", borderColor: "#dc2626" }}
            >
              <Trash2 size={13} /> Xóa thẻ
            </button>
            <button
              className="small-button"
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{ marginLeft: "auto" }}
            >
              <X size={13} /> Bỏ chọn
            </button>
          </div>
        )}

        {msg && (
          <p className={`rfid-msg ${msg.startsWith("Đã") ? "ok" : "err"}`}>
            {msg}
          </p>
        )}

        {loading && cards.length === 0 ? (
          <p className="rfid-loading">
            <Loader2 size={16} className="spin" /> Đang tải...
          </p>
        ) : (
          <DataTable
            headers={["", "UID", "Chủ thẻ", "Biển số", "Loại", "Trạng thái", "Cập nhật", "Thao tác"]}
            rows={filtered.map((card) => [
              isAdmin ? (
                <button
                  key="select"
                  type="button"
                  onClick={() => toggleSelected(card.id)}
                  aria-label={selectedIds.has(card.id) ? "Bỏ chọn" : "Chọn"}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    color: selectedIds.has(card.id) ? "#2563eb" : "#94a3b8",
                  }}
                >
                  {selectedIds.has(card.id) ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              ) : (
                <span key="select" />
              ),
              <span key="uid" className="uid-pill">
                <Radio size={11} />
                {card.uid}
              </span>,
              <span key="owner" className="cell-muted-strong">
                {card.ownerName || "—"}
              </span>,
              <span key="plate" className="plate-cell">
                {card.plate || "—"}
              </span>,
              <span key="type" className={card.userType === "resident" ? "badge" : "badge warning"}>
                {userTypeLabel(card.userType)}
              </span>,
              <span key="status" className={statusBadgeClass(card.status)}>
                {statusLabel(card.status)}
              </span>,
              <span key="updated" className="cell-muted-tiny">
                {formatDate(card.updatedAt)}
              </span>,
              <div key="actions" className="rfid-actions">
                {isAdmin && (
                  <button
                    className="small-button"
                    onClick={() => setEditing({
                      card,
                      ownerName: card.ownerName,
                      plate: card.plate,
                      userType: card.userType,
                      notes: card.notes || "",
                    })}
                    title="Sửa thẻ"
                    type="button"
                  >
                    <Edit size={13} /> Sửa
                  </button>
                )}
                <button
                  className="small-button"
                  onClick={() => isOperationalStatus(card.status) ? (setLockingCard(card), setLockReason("")) : toggleStatus(card)}
                  disabled={submitting}
                  title={isOperationalStatus(card.status) ? "Khóa thẻ" : "Mở khóa thẻ"}
                  type="button"
                  style={{ color: isOperationalStatus(card.status) ? "#f59e0b" : "#16a34a" }}
                >
                  {isOperationalStatus(card.status) ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                  {isOperationalStatus(card.status) ? "Khóa" : "Mở khóa"}
                </button>
                {isAdmin && (
                  <button
                    className="small-button"
                    onClick={() => setConfirmDelete(card)}
                    title="Xóa thẻ"
                    type="button"
                    style={{ color: "#ef4444" }}
                  >
                    <Trash2 size={13} /> Xóa
                  </button>
                )}
              </div>,
            ])}
          />
        )}

        {filtered.length === 0 && !loading && (
          <div className="rfid-empty">
            {cards.length === 0 ? (
              <>
                <CreditCard size={32} />
                <p>Chưa có thẻ RFID nào. Hãy thêm thẻ đầu tiên.</p>
              </>
            ) : (
              <>
                <Search size={32} />
                <p>Không có thẻ nào khớp bộ lọc.</p>
                <button className="small-button" onClick={resetFilters} type="button">
                  <X size={13} /> Xóa bộ lọc
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddForm && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false); }}
        >
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <Plus size={22} />
                <h2>Thêm thẻ RFID</h2>
              </div>
              <button onClick={() => setShowAddForm(false)} className="modal-close" type="button">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div role="tablist" className="rfid-tabs">
              <button
                role="tab"
                aria-selected={addMode === "manual"}
                type="button"
                onClick={() => setAddMode("manual")}
                className={`rfid-tab ${addMode === "manual" ? "active" : ""}`}
              >
                <Keyboard size={14} /> Nhập tay
              </button>
              <button
                role="tab"
                aria-selected={addMode === "scan"}
                type="button"
                onClick={() => setAddMode("scan")}
                className={`rfid-tab ${addMode === "scan" ? "active" : ""}`}
              >
                <ScanLine size={14} /> Quét thẻ
              </button>
            </div>

            {addMode === "scan" ? (
              <ScanPanel
                phase={scanPhase}
                uid={scanUid}
                error={scanError}
                onStart={startScan}
                onCancel={cancelScan}
                onAccept={acceptScannedUidAndContinue}
                onRetry={() => {
                  setScanPhase("idle");
                  setScanError("");
                  setScanUid("");
                }}
              />
            ) : null}

            {addMode === "manual" ? (
              <form data-add-rfid-form onSubmit={handleAdd}>
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">
                      UID <span className="required">*</span>
                    </label>
                    <input
                      name="uid"
                      required
                      placeholder="Mã UID từ đầu đọc thẻ"
                      className="form-input mono"
                    />
                  </div>

                  {/* Auto-fill từ cư dân đã đăng ký gói */}
                  <div className="form-field">
                    <label className="form-label">
                      <UserCheck size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                      Gán cho cư dân đã đăng ký gói
                    </label>
                    <select
                      value={selectedResidentId}
                      onChange={(e) => handleSelectResidentInAddForm(e.target.value)}
                      className="form-input"
                    >
                      <option value="">
                        — Không gán (thẻ vãng lai / quét thẳng từ ESP32) —
                      </option>
                      {residents.map((r) => (
                        <option key={r.subscriptionId} value={r.subscriptionId}>
                          {r.plate} — {r.ownerName}
                          {r.memberCode ? ` (${r.memberCode})` : ""} · {r.planName}
                        </option>
                      ))}
                    </select>
                    {residents.length === 0 && (
                      <p className="form-hint muted-cell" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                        Chưa có cư dân nào có gói active mà chưa được gán thẻ.
                      </p>
                    )}
                  </div>

                  <div className="form-field">
                    <label className="form-label">Tên chủ thẻ</label>
                    <input
                      name="ownerName"
                      placeholder="VD: Nguyễn Văn A"
                      className="form-input"
                    />
                  </div>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Biển số</label>
                      {/* Luôn giữ input thật trong DOM để FormData submit đúng.
                          Khi đã gán cư dân → ẩn input, hiện badge read-only lên trên. */}
                      {addIsResidentLocked && (
                        <div className="form-input form-input-readonly mono">
                          {residents.find((r) => r.subscriptionId === selectedResidentId)?.plate || "—"}
                        </div>
                      )}
                      <input
                        name="plate"
                        placeholder="29A12345"
                        className="form-input mono"
                        style={addIsResidentLocked ? { display: "none" } : undefined}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Loại</label>
                      {addIsResidentLocked && (
                        <div className="form-input form-input-readonly">
                          <span className="badge">Cư dân</span>
                          <span className="muted-cell" style={{ fontSize: "0.78rem", marginLeft: 6 }}>
                            (đã gán theo cư dân)
                          </span>
                        </div>
                      )}
                      <select
                        name="userType"
                        defaultValue="guest"
                        className="form-input"
                        style={addIsResidentLocked ? { display: "none" } : undefined}
                        onChange={(e) => {
                          if (e.target.value === "guest") {
                            // Clear biển số + tên chủ thẻ khi chọn Khách
                            const formEl = e.currentTarget.form;
                            if (formEl) {
                              const owner = formEl.elements.namedItem("ownerName") as HTMLInputElement | null;
                              if (owner) owner.value = "";
                              const plate = formEl.elements.namedItem("plate") as HTMLInputElement | null;
                              if (plate) plate.value = "";
                            }
                            // Nếu đang chọn cư dân → bỏ chọn để không còn locked
                            setSelectedResidentId("");
                          }
                        }}
                      >
                        <option value="guest">Khách</option>
                        <option value="resident">Cư dân</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Ghi chú</label>
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Ghi chú về thẻ..."
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="small-button" onClick={() => setShowAddForm(false)} type="button">
                    Hủy
                  </button>
                  <button className="small-button primary" disabled={submitting} type="submit">
                    {submitting ? <Loader2 size={14} /> : <Plus size={14} />}
                    {submitting ? "Đang lưu..." : "Thêm thẻ"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      )}

      {lockingCard && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setLockingCard(null); }}>
          <div className="modal-card narrow">
            <h3 className="confirm-title"><AlertTriangle size={18} color="#b45309" /> Khóa thẻ RFID</h3>
            <p className="confirm-text">Nhập lý do khóa thẻ. Lý do này sẽ hiển thị tại bàn nhân viên khi quét thẻ.</p>
            <textarea value={lockReason} onChange={(e) => setLockReason(e.target.value)} rows={4} maxLength={500} placeholder="Ví dụ: Chủ thẻ báo mất, vi phạm quy định..." autoFocus />
            <div className="modal-actions">
              <button className="small-button" type="button" onClick={() => setLockingCard(null)}>Hủy</button>
              <button className="small-button danger" type="button" disabled={!lockReason.trim() || submitting} onClick={() => { void toggleStatus(lockingCard, lockReason).then(() => setLockingCard(null)); }}>Khóa thẻ</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="modal-card narrow">
            <div className="modal-header">
              <div className="modal-title">
                <Edit size={22} />
                <h2>Sửa thẻ RFID</h2>
              </div>
              <button onClick={() => setEditing(null)} className="modal-close" type="button">
                <X size={20} />
              </button>
            </div>

            <div className="rfid-edit-uid">
              <div className="rfid-edit-uid-label">UID</div>
              <div className="rfid-edit-uid-value">{editing.card.uid}</div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">
                  <UserCheck size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Gán cho cư dân đã đăng ký gói
                </label>
                <select
                  value={editSelectedResidentId}
                  onChange={(e) => setEditSelectedResidentId(e.target.value)}
                  className="form-input"
                >
                  <option value="">— Giữ nguyên / bỏ gán cư dân —</option>
                  {/* Hiển thị cư dân hiện tại đang gán cho thẻ này nếu có */}
                  {editing.userType === "resident" &&
                    editing.plate &&
                    !residents.some((r) => r.plate === editing.plate) && (
                      <option value={`__current__:${editing.plate}`}>
                        {editing.plate} — {editing.ownerName} (đang gán)
                      </option>
                    )}
                  {residents.map((r) => (
                    <option key={r.subscriptionId} value={r.subscriptionId}>
                      {r.plate} — {r.ownerName}
                      {r.memberCode ? ` (${r.memberCode})` : ""} · {r.planName}
                    </option>
                  ))}
                </select>
                <p className="form-hint muted-cell" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                  Chọn 1 cư dân để tự điền lại biển số, tên chủ thẻ và đánh dấu là cư dân.
                </p>
              </div>

              <div className="form-field">
                <label className="form-label">Tên chủ thẻ</label>
                <input
                  value={editing.ownerName}
                  onChange={(e) => setEditing({ ...editing, ownerName: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Biển số</label>
                  {editIsResidentLocked && (
                    <div className="form-input form-input-readonly mono">
                      {editing.plate || "—"}
                    </div>
                  )}
                  <input
                    value={editing.plate}
                    onChange={(e) => setEditing({ ...editing, plate: e.target.value })}
                    className="form-input mono"
                    placeholder="29A12345"
                    style={editIsResidentLocked ? { display: "none" } : undefined}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Loại</label>
                  {editIsResidentLocked && (
                    <div className="form-input form-input-readonly">
                      <span className="badge">Cư dân</span>
                      <span className="muted-cell" style={{ fontSize: "0.78rem", marginLeft: 6 }}>
                        (đã gán theo cư dân)
                      </span>
                    </div>
                  )}
                  <select
                    value={editing.userType}
                    onChange={(e) => {
                      const next = e.target.value as "resident" | "guest";
                      // Đổi sang Khách → clear tên chủ thẻ và biển số
                      if (next === "guest") {
                        setEditing({ ...editing, userType: next, ownerName: "", plate: "" });
                      } else {
                        setEditing({ ...editing, userType: next });
                      }
                    }}
                    className="form-input"
                    style={editIsResidentLocked ? { display: "none" } : undefined}
                  >
                    <option value="guest">Khách</option>
                    <option value="resident">Cư dân</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Ghi chú</label>
                <textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                  className="form-input"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="small-button" onClick={() => setEditing(null)} type="button">
                Hủy
              </button>
              <button className="small-button primary" disabled={submitting} onClick={handleSaveEdit} type="button">
                {submitting ? <Loader2 size={14} /> : <Edit size={14} />}
                {submitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="modal-card narrow">
            <h3 className="confirm-title">
              <Trash2 size={18} color="#ef4444" />
              Xác nhận xóa thẻ
            </h3>
            <p className="confirm-text">
              Bạn có chắc muốn xóa thẻ <strong className="mono">{confirmDelete.uid}</strong>?
              Hành động này không thể hoàn tác.
            </p>
            <div className="modal-actions">
              <button className="small-button" onClick={() => setConfirmDelete(null)} type="button">
                Hủy
              </button>
              <button
                className="small-button danger"
                onClick={handleDelete}
                disabled={submitting}
                type="button"
              >
                {submitting ? <Loader2 size={14} /> : <Trash2 size={14} />}
                {submitting ? "Đang xóa..." : "Xóa thẻ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkClear && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setBulkClear(null);
              setBulkConfirmText("");
            }
          }}
        >
          <div className="modal-card narrow">
            <h3 className="confirm-title">
              {bulkClear.mode === "reset" ? (
                <Eraser size={18} color="#b45309" />
              ) : (
                <Trash2 size={18} color="#ef4444" />
              )}
              {bulkClear.mode === "reset" ? "Reset dữ liệu thẻ" : "Xóa thẻ vĩnh viễn"}
            </h3>

            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fbbf24",
                borderRadius: 8,
                padding: 12,
                color: "#92400e",
                fontSize: 13,
                marginBottom: 12,
                display: "flex",
                gap: 10,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                {bulkClear.mode === "reset" ? (
                  <>
                    <strong>Reset</strong> sẽ xóa hết chủ thẻ, biển số, subscription, userId — đưa thẻ về
                    trạng thái <strong>guest / active / trống</strong>. UID và lịch sử tạo được giữ lại.
                  </>
                ) : (
                  <>
                    <strong>Xóa vĩnh viễn</strong> sẽ xóa hoàn toàn thẻ khỏi hệ thống. Hành động này
                    <strong> không thể hoàn tác</strong>.
                  </>
                )}
              </div>
            </div>

            <p className="confirm-text">
              Phạm vi:{" "}
              <strong>
                {bulkClear.scope === "all"
                  ? `Toàn bộ (${cards.length} thẻ)`
                  : `${selectedIds.size} thẻ đã chọn`}
              </strong>
            </p>

            <label
              style={{
                display: "block",
                marginTop: 12,
                fontSize: 13,
                color: "#475569",
              }}
            >
              Nhập chính xác <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>RESET_ALL_RFID_DATA</code>{" "}
              để xác nhận:
            </label>
            <input
              type="text"
              value={bulkConfirmText}
              onChange={(e) => setBulkConfirmText(e.target.value)}
              placeholder="RESET_ALL_RFID_DATA"
              autoFocus
              style={{
                width: "100%",
                marginTop: 6,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontFamily: "monospace",
                boxSizing: "border-box",
              }}
            />

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                className="small-button"
                onClick={() => {
                  setBulkClear(null);
                  setBulkConfirmText("");
                }}
                disabled={submitting}
                type="button"
              >
                Hủy
              </button>
              <button
                className={bulkClear.mode === "reset" ? "small-button" : "small-button danger"}
                onClick={executeBulkClear}
                disabled={submitting || bulkConfirmText !== "RESET_ALL_RFID_DATA"}
                type="button"
              >
                {submitting ? <Loader2 size={14} /> : bulkClear.mode === "reset" ? <Eraser size={14} /> : <Trash2 size={14} />}
                {submitting
                  ? "Đang xử lý..."
                  : bulkClear.mode === "reset"
                    ? "Reset dữ liệu"
                    : "Xóa thẻ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================== Sub components ============================== */

type StatColor = "slate" | "green" | "amber" | "blue" | "purple";

function StatCard({ color, label, value }: { color: StatColor; label: string; value: number }) {
  return (
    <div className={`rfid-stat rfid-stat-${color}`}>
      <div className="rfid-stat-label">{label}</div>
      <div className="rfid-stat-value">{value}</div>
    </div>
  );
}

type SegTone = "default" | "green" | "amber" | "blue" | "purple";

function SegBtn({
  active,
  onClick,
  children,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: SegTone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rfid-seg ${active ? `active tone-${tone}` : ""}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

type ScanPanelProps = {
  phase: "idle" | "starting" | "waiting" | "success" | "duplicate" | "error" | "timeout";
  uid: string;
  error: string;
  onStart: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onRetry: () => void;
};

function ScanPanel({ phase, uid, error, onStart, onCancel, onAccept, onRetry }: ScanPanelProps) {
  const isWaiting = phase === "starting" || phase === "waiting";
  const isDone = phase === "success" || phase === "duplicate" || phase === "error" || phase === "timeout";

  return (
    <div className="rfid-scan">
      <div className={`rfid-scan-stage ${isWaiting ? "active" : ""}`}>
        {isWaiting ? (
          <>
            <div className="rfid-scan-icon">
              <ScanLine size={48} className="spin" style={{ animationDuration: "2s" }} />
            </div>
            <p className="rfid-scan-title primary">Đang chờ quét thẻ...</p>
            <p className="rfid-scan-sub">
              Đặt thẻ lên đầu đọc ESP32 (cổng vào hoặc ra). Tối đa 15 giây.
            </p>
          </>
        ) : phase === "success" ? (
          <>
            <CheckCircle2 size={48} className="rfid-scan-big-icon" color="#16a34a" />
            <p className="rfid-scan-title green">Quét thành công</p>
            <div className="rfid-scan-uid">{uid}</div>
            <p className="rfid-scan-sub">Bấm "Dùng UID này" để tự điền vào form.</p>
          </>
        ) : phase === "duplicate" ? (
          <>
            <Radio size={48} className="rfid-scan-big-icon" color="#ca8a04" />
            <p className="rfid-scan-title amber">Thẻ đã tồn tại</p>
            <div className="rfid-scan-uid">{uid}</div>
            <p className="rfid-scan-sub">
              Thẻ này đã được đăng ký trong hệ thống. Quay lại danh sách chính để xem.
            </p>
          </>
        ) : phase === "timeout" ? (
          <>
            <XCircle size={48} className="rfid-scan-big-icon" color="#ca8a04" />
            <p className="rfid-scan-title amber">Hết thời gian chờ</p>
            <p className="rfid-scan-sub">
              ESP32 không gửi UID nào trong 15 giây. Kiểm tra kết nối serial hoặc thử lại.
            </p>
          </>
        ) : (
          <>
            <Zap size={48} className="rfid-scan-big-icon" color="var(--muted)" />
            <p className="rfid-scan-title">Quét thẻ qua ESP32</p>
            <p className="rfid-scan-sub">
              Bridge service sẽ bật chế độ SCAN_ON trên cả 2 ESP32. Đặt thẻ RFID lên đầu đọc.
            </p>
          </>
        )}

        {error && phase === "error" && (
          <p className="rfid-scan-error">{error}</p>
        )}
      </div>

      <div className="modal-actions">
        {phase === "idle" || phase === "error" || phase === "timeout" ? (
          <button className="small-button primary" onClick={onStart} type="button">
            <Zap size={14} /> Bắt đầu quét
          </button>
        ) : null}

        {isWaiting ? (
          <button className="small-button" onClick={onCancel} type="button">
            <X size={14} /> Hủy quét
          </button>
        ) : null}

        {phase === "success" ? (
          <>
            <button className="small-button" onClick={onRetry} type="button">
              <RefreshCcw size={14} /> Quét lại
            </button>
            <button className="small-button success" onClick={onAccept} type="button">
              <CheckCircle2 size={14} /> Dùng UID này
            </button>
          </>
        ) : null}

        {(phase === "duplicate" || phase === "timeout") ? (
          <button className="small-button" onClick={onRetry} type="button">
            <RefreshCcw size={14} /> Quét lại
          </button>
        ) : null}
      </div>
    </div>
  );
}
