"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  TicketCheck,
  TriangleAlert,
  WalletCards,
  X,
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { apiFetch, bridgeFetch } from "@/lib/client-api";
import {
  addRfidInventoryCard,
  confirmRfidSale,
  createRfidSale,
  getRfidInventory,
  getRfidTransactions,
  replaceRfidCard,
  returnRfidCard,
  RfidInventoryItem,
  RfidLifecycleStatus,
  RfidPaymentMethod,
  RfidSaleInput,
  RfidTransaction,
  updateRfidLifecycleStatus,
  reconcilePendingRfidSales,
} from "./rfid-sales-api";

type PanelTab = "inventory" | "transactions";
type StatusAction = "lost" | "blocked" | "damaged";
type SaleForm = {
  cardId: string;
  userId: string;
  vehicleId: string;
  vehiclePlate: string;
  userEmail: string;
  salePrice: string;
  method: RfidPaymentMethod;
  note: string;
  freeReason: string;
};

type ReturnDialog = {
  card: RfidInventoryItem;
  inspectionPassed: boolean;
};

type StatusDialog = {
  card: RfidInventoryItem;
  action: StatusAction;
  reason: string;
};

type InventoryForm = {
  uid: string;
  notes: string;
};
type RfidDetails = { card: RfidInventoryItem; owner?: { name?: string; email?: string; phone?: string }; vehicle?: { plate?: string; ownerName?: string; brand?: string; model?: string; color?: string; status?: string }; history: RfidTransaction[] };

const EMPTY_INVENTORY_FORM: InventoryForm = { uid: "", notes: "" };

const EMPTY_SALE_FORM: SaleForm = {
  cardId: "",
  userId: "",
  vehicleId: "",
  vehiclePlate: "",
  userEmail: "",
  salePrice: "0",
  method: "cash",
  note: "",
  freeReason: "",
};

const STATUS_LABEL: Record<RfidLifecycleStatus, string> = {
  available: "Sẵn sàng bán",
  "pending-sale": "Chờ thanh toán",
  "in-use": "Đang sử dụng",
  active: "Đang sử dụng",
  lost: "Báo mất",
  blocked: "Đã khóa",
  damaged: "Hư hỏng",
  returned: "Chờ kiểm tra",
  inactive: "Ngưng dùng",
};

const TRANSACTION_LABEL: Record<RfidTransaction["transactionType"], string> = {
  rfid_sale: "Bán thẻ Member",
  rfid_deposit: "Thu cọc",
  rfid_replacement: "Cấp lại thẻ Member",
  rfid_refund: "Hoàn cọc",
};

function money(value: number | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value ?? 0);
}

function dateTime(value?: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function statusClass(status: RfidLifecycleStatus) {
  if (["available", "active", "in-use"].includes(status)) return "rfid-life-badge success";
  if (status === "pending-sale") return "rfid-life-badge warning";
  if (["lost", "damaged", "blocked"].includes(status)) return "rfid-life-badge danger";
  return "rfid-life-badge muted";
}

function blankSaleForm(overrides: Partial<SaleForm> = {}): SaleForm {
  return { ...EMPTY_SALE_FORM, ...overrides };
}

function normalizeSaleInput(form: SaleForm): RfidSaleInput {
  return {
    cardType: "member",
    cardId: form.cardId,
    userId: form.userId.trim() || undefined,
    vehicleId: form.vehicleId.trim(),
    salePrice: Number(form.salePrice) || 0,
    depositAmount: 0,
    method: form.method,
    note: form.note.trim() || undefined,
    freeReason: form.freeReason.trim() || undefined,
  };
}

function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="modal-card rfid-sales-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h2>{title}</h2>
            {description && <p className="muted-cell">{description}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="rfid-sales-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function RfidSalesPanel() {
  const [tab, setTab] = useState<PanelTab>("inventory");
  const [inventory, setInventory] = useState<RfidInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<RfidTransaction[]>([]);
  const [summary, setSummary] = useState<Array<{ _id: RfidLifecycleStatus; count: number }>>([]);
  const [inventoryStatus, setInventoryStatus] = useState<"all" | RfidLifecycleStatus>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saleForm, setSaleForm] = useState<SaleForm | null>(null);
  const [saleFormError, setSaleFormError] = useState<string | null>(null);
  const [replaceCard, setReplaceCard] = useState<RfidInventoryItem | null>(null);
  const [returnDialog, setReturnDialog] = useState<ReturnDialog | null>(null);
  const [statusDialog, setStatusDialog] = useState<StatusDialog | null>(null);
  const [payosPayment, setPayosPayment] = useState<{ transaction: RfidTransaction; checkoutUrl: string } | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryForm | null>(null);
  const [inventoryScanLoading, setInventoryScanLoading] = useState(false);
  const [rfidDetails, setRfidDetails] = useState<RfidDetails | null>(null);
  const [rfidDetailsLoading, setRfidDetailsLoading] = useState(false);
  const [vehicleSuggestions, setVehicleSuggestions] = useState<Array<{ id: string; plate: string; ownerName?: string; userId?: string; email?: string }>>([]);
  const [userSuggestions, setUserSuggestions] = useState<Array<{ id: string; email: string; name?: string }>>([]);
  const [rfidPrice, setRfidPrice] = useState(50000);
  const [rfidPriceForm, setRfidPriceForm] = useState("50000");
  const [rfidPriceOpen, setRfidPriceOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inventoryResult, transactionsResult] = await Promise.all([
        getRfidInventory({ limit: 100 }),
        getRfidTransactions({ limit: 50 }),
      ]);
      setInventory(inventoryResult.items);
      setSummary(inventoryResult.summary);
      setTransactions(transactionsResult.items);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không tải được dữ liệu RFID." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    void apiFetch("/pricing-config").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const value = Number(data.pricingConfig?.rfidCardSalePrice ?? 50000);
      setRfidPrice(value);
      setRfidPriceForm(String(value));
    }).catch(() => undefined);
  }, []);

  async function saveRfidPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(rfidPriceForm);
    if (!Number.isFinite(value) || value < 0) {
      setNotice({ tone: "error", text: "Giá thẻ RFID phải là số không âm." });
      return;
    }
    setSubmitting(true);
    try {
      const current = await apiFetch("/pricing-config");
      const currentData = await current.json().catch(() => ({}));
      const config = currentData.pricingConfig || {};
      const response = await apiFetch("/pricing-config", {
        method: "PATCH",
        body: JSON.stringify({
          dayRate: Number(config.dayRate ?? 5000),
          nightRate: Number(config.nightRate ?? 10000),
          dayStartHour: Number(config.dayStartHour ?? 6),
          nightStartHour: Number(config.nightStartHour ?? 22),
          gracePeriod: Number(config.gracePeriod ?? 20),
          maxMinutes: Number(config.maxMinutes ?? 1440),
          rfidCardSalePrice: Math.round(value),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không thể lưu giá thẻ RFID.");
      const saved = Number(data.pricingConfig?.rfidCardSalePrice ?? value);
      setRfidPrice(saved);
      setRfidPriceForm(String(saved));
      setRfidPriceOpen(false);
      setNotice({ tone: "success", text: `Đã cập nhật giá bán RFID Member: ${money(saved)}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể lưu giá thẻ RFID." });
    } finally {
      setSubmitting(false);
    }
  }

  const summaryCount = (status: RfidLifecycleStatus) => summary.find((item) => item._id === status)?.count ?? 0;
  const availableCards = useMemo(() => inventory.filter((card) => card.status === "available"), [inventory]);
  const filteredInventory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return inventory.filter((card) => {
      const statusMatched = inventoryStatus === "all" || card.status === inventoryStatus;
      const searchMatched = !normalized || [card.uid, card.cardId, card.plate, card.ownerName].filter(Boolean).some((value) => value!.toLowerCase().includes(normalized));
      return statusMatched && searchMatched;
    });
  }, [inventory, inventoryStatus, query]);

  async function scanInventoryCard() {
    if (!inventoryForm || inventoryScanLoading || submitting) return;
    setInventoryScanLoading(true);
    setInventoryForm({ ...inventoryForm, uid: "" });
    try {
      const start = await bridgeFetch("/api/rfid/scan/start", { method: "POST", body: JSON.stringify({ direction: "in", mode: "inventory" }) });
      if (!start.ok) throw new Error("Không bật được đầu đọc RFID cổng vào.");
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        const poll = await bridgeFetch("/api/rfid/scan/poll?direction=in");
        const data = await poll.json().catch(() => ({}));
        if (data.status === "waiting") continue;
        if (data.status === "success" && data.uid) {
          setInventoryForm((current) => current ? { ...current, uid: data.uid } : current);
          setNotice({ tone: "success", text: `Đã đọc UID ${data.uid}. Kiểm tra rồi bấm Nhập tồn kho.` });
          return;
        }
        if (data.status === "error") throw new Error(data.message || "Không đọc được thẻ RFID.");
      }
      throw new Error("Hết thời gian chờ. Hãy đặt thẻ lên đầu đọc rồi thử lại.");
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không quét được thẻ RFID." });
    } finally {
      await bridgeFetch("/api/rfid/scan/cancel", { method: "POST", body: JSON.stringify({ direction: "in" }) }).catch(() => undefined);
      setInventoryScanLoading(false);
    }
  }

  async function submitInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryForm || submitting) return;
    const uid = inventoryForm.uid.trim();
    if (!uid) {
      setNotice({ tone: "error", text: "Hãy quét thẻ RFID để lấy UID trước khi nhập kho." });
      return;
    }
    setSubmitting(true);
    try {
      await addRfidInventoryCard({ uid, notes: inventoryForm.notes });
      setInventoryForm(null);
      setNotice({ tone: "success", text: `Đã nhập thẻ ${uid} vào tồn kho sẵn sàng bán.` });
      await loadData();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể nhập thẻ vào tồn kho." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSale(event: FormEvent<HTMLFormElement>, replacementOf?: RfidInventoryItem) {
    event.preventDefault();
    const form = replacementOf ? saleForm : saleForm;
    if (!form || submitting) return;
    setSaleFormError(null);
    const normalizedPlate = form.vehiclePlate.trim().toUpperCase().replace(/[\s-]+/g, "");
    const vehicleMatch = vehicleSuggestions.find((vehicle) => vehicle.plate.toUpperCase().replace(/[\s-]+/g, "") === normalizedPlate);
    if (!normalizedPlate || !vehicleMatch || !vehicleMatch.id) {
      setSaleFormError("Biển số xe không tồn tại hoặc chưa được đăng ký trong hệ thống. Hãy chọn biển số từ danh sách gợi ý.");
      return;
    }
    if (form.userEmail.trim()) {
      const emailMatch = userSuggestions.find((user) => user.email.toLowerCase() === form.userEmail.trim().toLowerCase());
      if (!emailMatch) {
        setSaleFormError("Email tài khoản không tồn tại trong hệ thống. Hãy chọn email từ danh sách gợi ý.");
        return;
      }
      if (vehicleMatch.userId && emailMatch.id !== vehicleMatch.userId) {
        setSaleFormError("Email không thuộc chủ sở hữu của biển số xe đã chọn. Vui lòng chọn đúng tài khoản.");
        return;
      }
    }
    if (!form.vehicleId || form.vehicleId !== vehicleMatch.id) {
      setSaleFormError("Vui lòng chọn đúng biển số xe trong danh sách gợi ý.");
      return;
    }
    const payload = normalizeSaleInput({ ...form, vehicleId: vehicleMatch.id, userId: vehicleMatch.userId || form.userId });
    if (!payload.cardId) {
      setNotice({ tone: "error", text: "Hãy chọn một thẻ RFID sẵn sàng bán." });
      return;
    }
    if (!payload.vehicleId) {
      setNotice({ tone: "error", text: "RFID Member phải được bán và gắn với một xe đã đăng ký." });
      return;
    }
    if (payload.salePrice < 0) {
      setNotice({ tone: "error", text: "Giá bán không được âm." });
      return;
    }
    if (payload.salePrice === 0 && !payload.freeReason) {
      setNotice({ tone: "error", text: "Cấp thẻ miễn phí cần ghi rõ lý do." });
      return;
    }
    setSubmitting(true);
    try {
      const result = replacementOf ? await replaceRfidCard(replacementOf.id, payload) : await createRfidSale(payload);
      const transaction = result.transaction;
      const isPayOS = transaction.method === "payos" && transaction.status === "pending";
      if (isPayOS && transaction.payosCheckoutUrl) {
        setPayosPayment({ transaction, checkoutUrl: transaction.payosCheckoutUrl });
      }
      setSaleForm(null);
      setReplaceCard(null);
      setNotice({
        tone: "success",
        text: isPayOS
          ? "Đã tạo yêu cầu thanh toán PayOS. Quét QR hoặc mở liên kết thanh toán; thẻ sẽ tự kích hoạt khi PayOS xác nhận."
          : replacementOf
            ? "Đã cấp lại thẻ RFID thành công."
            : "Đã bán/cấp thẻ RFID thành công.",
      });
      await loadData();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể xử lý giao dịch thẻ." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReturn() {
    if (!returnDialog || submitting) return;
    setSubmitting(true);
    try {
      await returnRfidCard(returnDialog.card.id, {
        inspectionPassed: returnDialog.inspectionPassed,
        refundDeposit: false,
      });
      setReturnDialog(null);
      setNotice({
        tone: "success",
        text: "Đã nhận trả thẻ và cập nhật tồn kho.",
      });
      await loadData();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể xử lý trả thẻ." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStatus() {
    if (!statusDialog || submitting) return;
    setSubmitting(true);
    try {
      await updateRfidLifecycleStatus(statusDialog.card.id, statusDialog.action, statusDialog.reason.trim() || undefined);
      setNotice({ tone: "success", text: `Đã cập nhật thẻ ${statusDialog.card.uid} thành ${STATUS_LABEL[statusDialog.action]}.` });
      setStatusDialog(null);
      await loadData();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể cập nhật trạng thái thẻ." });
    } finally {
      setSubmitting(false);
    }
  }

  async function openRfidDetails(transaction: RfidTransaction) {
    if (!transaction.rfidCardId || rfidDetailsLoading) return;
    setRfidDetailsLoading(true);
    try {
      const response = await apiFetch(`/rfid/${transaction.rfidCardId}/details`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không tải được thông tin thẻ RFID.");
      setRfidDetails(data);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không tải được thông tin thẻ RFID." });
    } finally {
      setRfidDetailsLoading(false);
    }
  }

  async function reconcilePayments() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await reconcilePendingRfidSales();
      setNotice({ tone: "success", text: result.updated ? `Đã cập nhật ${result.updated} giao dịch RFID đã thanh toán.` : "Chưa có giao dịch RFID nào được PayOS xác nhận." });
      await loadData();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể đối soát thanh toán PayOS." });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPendingSale(transaction: RfidTransaction) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await confirmRfidSale(transaction.id);
      setNotice({ tone: "success", text: "Đã kiểm tra thanh toán và kích hoạt thẻ RFID." });
      await loadData();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể xác nhận giao dịch." });
    } finally {
      setSubmitting(false);
    }
  }

  async function loadSaleSuggestions() {
    try {
      const [vehiclesResponse, usersResponse] = await Promise.all([apiFetch("/vehicles"), apiFetch("/users")]);
      const vehiclesData = await vehiclesResponse.json().catch(() => ({}));
      const usersData = await usersResponse.json().catch(() => ({}));
      setVehicleSuggestions((vehiclesData.vehicles || []).map((vehicle: any) => ({ id: vehicle.id, plate: vehicle.plate, ownerName: vehicle.ownerName, userId: vehicle.userId, email: vehicle.user?.email || vehicle.email })));
      setUserSuggestions((usersData.users || []).map((user: any) => ({ id: user.id, email: user.email, name: user.name })));
    } catch {
      setVehicleSuggestions([]);
      setUserSuggestions([]);
    }
  }

  function openSale(card?: RfidInventoryItem) {
    setSaleForm(blankSaleForm({ cardId: card?.id ?? "", salePrice: String(rfidPrice) }));
    setSaleFormError(null);
    setReplaceCard(null);
    setSaleFormError(null);
    void loadSaleSuggestions();
  }

  function openReplace(card: RfidInventoryItem) {
    setReplaceCard(card);
    setSaleForm(blankSaleForm({ vehicleId: String(card.vehicleId ?? ""), userId: String(card.userId ?? ""), salePrice: String(card.salePrice || rfidPrice), vehiclePlate: "", userEmail: "" }));
  }

  return (
    <section className="rfid-sales-section" aria-label="Bán và quản lý vòng đời thẻ RFID">
      <div className="rfid-sales-heading">
        <div>
          <p className="rfid-eyebrow">NGHIỆP VỤ THẺ</p>
          <h3>RFID Member — bán đứt theo xe</h3>
          <p>Thẻ Guest ở kho được cấp và thu hồi tại cổng; thẻ Member được bán đứt, liên kết duy nhất với một xe và có thể dùng để mua gói.</p>
        </div>
        <div className="rfid-sales-heading-actions">
          <button className="small-button" type="button" onClick={() => void loadData()} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "spin" : ""} /> Làm mới
          </button>
          <button className="small-button" type="button" onClick={() => { setRfidPriceForm(String(rfidPrice)); setRfidPriceOpen(true); }}>
            <CreditCard size={14} /> Giá thẻ: {money(rfidPrice)}
          </button>
          <button className="small-button" type="button" onClick={() => void reconcilePayments()} disabled={submitting}>
            <RefreshCcw size={14} /> Kiểm tra PayOS
          </button>
          <button className="small-button" type="button" onClick={() => setInventoryForm({ ...EMPTY_INVENTORY_FORM })}>
            <PackageCheck size={15} /> Nhập thẻ kho
          </button>
          <button className="small-button primary" type="button" onClick={() => openSale()}>
            <Plus size={15} /> Bán thẻ Member
          </button>
        </div>
      </div>

      {notice && (
        <div className={`rfid-sales-notice ${notice.tone}`} role="status">
          {notice.tone === "success" ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={15} /></button>
        </div>
      )}

      <div className="rfid-sales-kpis">
        <button type="button" className="rfid-sales-kpi available" onClick={() => { setTab("inventory"); setInventoryStatus("available"); }}>
          <PackageCheck size={19} />
          <span><small>Sẵn sàng bán</small><strong>{summaryCount("available")}</strong></span>
        </button>
        <button type="button" className="rfid-sales-kpi in-use" onClick={() => { setTab("inventory"); setInventoryStatus("in-use"); }}>
          <TicketCheck size={19} />
          <span><small>Đang sử dụng</small><strong>{summaryCount("in-use") + summaryCount("active")}</strong></span>
        </button>
        <button type="button" className="rfid-sales-kpi pending" onClick={() => { setTab("inventory"); setInventoryStatus("pending-sale"); }}>
          <WalletCards size={19} />
          <span><small>Chờ thanh toán</small><strong>{summaryCount("pending-sale")}</strong></span>
        </button>
        <button type="button" className="rfid-sales-kpi issue" onClick={() => { setTab("inventory"); setInventoryStatus("lost"); }}>
          <ShieldAlert size={19} />
          <span><small>Mất / hỏng / khóa</small><strong>{summaryCount("lost") + summaryCount("damaged") + summaryCount("blocked")}</strong></span>
        </button>
      </div>

      <div className="rfid-sales-tabs" role="tablist" aria-label="Nghiệp vụ thẻ RFID">
        <button type="button" className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")} role="tab" aria-selected={tab === "inventory"}>
          <CreditCard size={16} /> Tồn kho thẻ
        </button>
        <button type="button" className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")} role="tab" aria-selected={tab === "transactions"}>
          <ClipboardList size={16} /> Giao dịch RFID
        </button>
      </div>

      {tab === "inventory" ? (
        <>
          <div className="rfid-sales-toolbar">
            <div className="rfid-sales-filter">
              <label htmlFor="rfid-life-filter">Trạng thái</label>
              <select id="rfid-life-filter" value={inventoryStatus} onChange={(event) => setInventoryStatus(event.target.value as "all" | RfidLifecycleStatus)}>
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </div>
            <label className="rfid-sales-search">
              <span className="sr-only">Tìm thẻ RFID</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm UID, mã thẻ, chủ thẻ, biển số..." />
            </label>
            <span className="muted-cell">{filteredInventory.length} thẻ hiển thị</span>
          </div>

          {loading ? <div className="rfid-sales-loading"><Loader2 size={18} className="spin" /> Đang tải tồn kho RFID…</div> : filteredInventory.length === 0 ? (
            <div className="rfid-sales-empty"><PackageCheck size={25} /><strong>Chưa có thẻ phù hợp</strong><span>Hãy thêm thẻ RFID vào kho hoặc điều chỉnh điều kiện lọc.</span></div>
          ) : (
            <DataTable
              headers={["Mã thẻ", "Loại thẻ / xe", "Giá bán", "Trạng thái", "Cập nhật", "Thao tác"]}
              rows={filteredInventory.map((card) => [
                <div key="card" className="rfid-card-identity"><strong>{card.cardId || card.uid}</strong><span>UID: {card.uid}</span></div>,
                <div key="owner" className="rfid-card-owner"><strong>{card.cardType === "member" ? "RFID Member" : "RFID Guest"}</strong><span>{card.plate ? `${card.ownerName || "Chưa gán"} · ${card.plate}` : "Thẻ Guest trong kho / chưa gán xe"}</span></div>,
                <div key="money" className="rfid-card-money"><strong>{money(card.salePrice || (card.status === "available" ? rfidPrice : 0))}</strong></div>,
                <span key="status" className={statusClass(card.status)}>{STATUS_LABEL[card.status]}</span>,
                <span key="updated" className="cell-muted-tiny">{dateTime(card.updatedAt || card.soldAt || card.createdAt)}</span>,
                <div key="actions" className="rfid-sales-actions">
                  {card.status === "available" && <button type="button" className="small-button success" onClick={() => openSale(card)}><BadgeDollarSign size={13} /> Bán Member</button>}
                  {card.cardType === "guest" && ["in-use", "active"].includes(card.status) && <button type="button" className="small-button" onClick={() => setReturnDialog({ card, inspectionPassed: true })}><RotateCcw size={13} /> Thu hồi thẻ Guest</button>}
                  {["lost", "blocked", "damaged"].includes(card.status) && <button type="button" className="small-button primary" onClick={() => openReplace(card)}><TicketCheck size={13} /> Cấp lại</button>}
                  {!['lost', 'blocked', 'damaged'].includes(card.status) && <button type="button" className="small-button danger" onClick={() => setStatusDialog({ card, action: "lost", reason: "" })} title="Báo mất thẻ"><AlertTriangle size={13} /></button>}
                  {card.status !== "blocked" && <button type="button" className="small-button" onClick={() => setStatusDialog({ card, action: "blocked", reason: "" })} title="Khóa thẻ"><Ban size={13} /></button>}
                  {card.status !== "damaged" && <button type="button" className="small-button" onClick={() => setStatusDialog({ card, action: "damaged", reason: "" })} title="Báo hỏng thẻ"><TriangleAlert size={13} /></button>}
                </div>,
              ])}
            />
          )}
        </>
      ) : (
        <>
          {loading ? <div className="rfid-sales-loading"><Loader2 size={18} className="spin" /> Đang tải lịch sử giao dịch…</div> : transactions.length === 0 ? (
            <div className="rfid-sales-empty"><ClipboardList size={25} /><strong>Chưa có giao dịch RFID</strong><span>Giao dịch bán và cấp lại sẽ xuất hiện tại đây.</span></div>
          ) : (
            <DataTable
              headers={["Loại giao dịch", "Thẻ / UID", "Số tiền", "Thanh toán", "Thời gian", "Thao tác"]}
              rows={transactions.map((transaction) => [
                <button key="type" type="button" className="rfid-transaction-type rfid-transaction-clickable" onClick={() => void openRfidDetails(transaction)}>{TRANSACTION_LABEL[transaction.transactionType]}</button>,
                <button key="uid" type="button" className="uid-pill rfid-transaction-clickable" onClick={() => void openRfidDetails(transaction)}>{transaction.uid || "—"}</button>,
                <div key="amount" className="rfid-card-money"><strong>{money(transaction.amount)}</strong><span>Giá: {money(transaction.salePrice)}</span></div>,
                <div key="method" className="rfid-method"><strong>{transaction.method === "payos" ? "PayOS" : transaction.method === "cash" ? "Tiền mặt" : "Ví điện tử"}</strong><span className={transaction.status === "paid" ? "rfid-life-badge success" : transaction.status === "pending" ? "rfid-life-badge warning" : "rfid-life-badge danger"}>{transaction.status === "paid" ? "Đã thanh toán" : transaction.status === "pending" ? "Chờ thanh toán" : "Không thành công"}</span></div>,
                <span key="time" className="cell-muted-tiny">{dateTime(transaction.paidAt || transaction.createdAt)}</span>,
                <div key="confirm" className="rfid-sales-actions">
                  {transaction.status === "pending" ? <button type="button" className="small-button success" disabled={submitting} onClick={() => void confirmPendingSale(transaction)}><CheckCircle2 size={13} /> Kiểm tra lại</button> : <span className="cell-muted-tiny">—</span>}
                </div>,
              ])}
            />
          )}
        </>
      )}

      {rfidPriceOpen && (
        <Modal title="Cấu hình giá bán RFID Member" description="Giá này áp dụng cho giao dịch bán thẻ và khách mua thẻ trực tiếp trên website." onClose={() => !submitting && setRfidPriceOpen(false)}>
          <form className="rfid-sales-form" onSubmit={(event) => void saveRfidPrice(event)}>
            <Field label="Giá bán thẻ RFID (VND)" hint="Nhập 0 nếu muốn cấp miễn phí; giao dịch miễn phí vẫn cần ghi lý do ở luồng bán thẻ.">
              <input autoFocus type="number" min={0} step={1000} required value={rfidPriceForm} onChange={(event) => setRfidPriceForm(event.target.value)} />
            </Field>
            <div className="modal-actions"><button type="button" className="small-button" onClick={() => setRfidPriceOpen(false)} disabled={submitting}>Hủy</button><button type="submit" className="small-button primary" disabled={submitting}>{submitting ? "Đang lưu…" : "Lưu giá thẻ"}</button></div>
          </form>
        </Modal>
      )}

      {rfidDetails && (
        <Modal title={`Chi tiết thẻ RFID · ${rfidDetails.card.uid}`} description="Thông tin sở hữu, xe liên kết và lịch sử giao dịch của thẻ." onClose={() => setRfidDetails(null)}>
          <div className="rfid-sales-form">
            <div className="rfid-detail-grid">
              <div className="rfid-detail-item"><strong>Trạng thái</strong><span>{STATUS_LABEL[rfidDetails.card.status]}</span></div>
              <div className="rfid-detail-item"><strong>Loại thẻ</strong><span>{rfidDetails.card.cardType === "member" ? "RFID Member" : "RFID Guest"}</span></div>
              <div className="rfid-detail-item"><strong>Chủ sở hữu</strong><span>{rfidDetails.owner?.name || rfidDetails.card.ownerName || "Chưa gán"}</span><small>{rfidDetails.owner?.email || "—"}</small></div>
              <div className="rfid-detail-item"><strong>Xe đang sử dụng</strong><span>{rfidDetails.vehicle?.plate || rfidDetails.card.plate || "Chưa gắn xe"}</span><small>{[rfidDetails.vehicle?.brand, rfidDetails.vehicle?.model, rfidDetails.vehicle?.color].filter(Boolean).join(" · ") || "—"}</small></div>
            </div>
            <h4>Lịch sử giao dịch</h4>
            {rfidDetails.history.length === 0 ? <p className="muted-cell">Chưa có giao dịch.</p> : <div className="table-wrap"><table><thead><tr><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>{rfidDetails.history.map((item) => <tr key={item.id}><td>{TRANSACTION_LABEL[item.transactionType]}</td><td>{money(item.amount)}</td><td>{item.status === "paid" ? "Đã thanh toán" : item.status === "pending" ? "Chờ thanh toán" : "Không thành công"}</td><td>{dateTime(item.paidAt || item.createdAt)}</td></tr>)}</tbody></table></div>}
            <div className="modal-actions"><button type="button" className="small-button" onClick={() => setRfidDetails(null)}>Đóng</button></div>
          </div>
        </Modal>
      )}

      {inventoryForm && (
        <Modal title="Nhập thẻ vào tồn kho" description="Thẻ được tạo ở trạng thái sẵn sàng bán và chưa được phép qua cổng." onClose={() => !submitting && setInventoryForm(null)}>
          <form className="rfid-sales-form" onSubmit={(event) => void submitInventory(event)}>
            <Field label="UID thẻ RFID" hint="Đặt thẻ lên đầu đọc cổng vào rồi bấm Quét thẻ. UID phải là duy nhất."><div style={{ display: "flex", gap: 8 }}><input required readOnly value={inventoryForm.uid} placeholder="Chưa quét thẻ" /><button type="button" className="small-button" onClick={() => void scanInventoryCard()} disabled={inventoryScanLoading || submitting}>{inventoryScanLoading ? <><Loader2 size={14} className="spin" /> Đang quét…</> : "Quét thẻ"}</button></div></Field>
            <Field label="Ghi chú nhập kho"><textarea rows={3} value={inventoryForm.notes} onChange={(event) => setInventoryForm({ ...inventoryForm, notes: event.target.value })} placeholder="Ví dụ: Lô thẻ mới tháng 08/2026" /></Field>
            <div className="modal-actions"><button type="button" className="small-button" onClick={() => setInventoryForm(null)} disabled={submitting}>Hủy</button><button type="submit" className="small-button primary" disabled={submitting}>{submitting ? <><Loader2 size={14} className="spin" /> Đang nhập…</> : <><PackageCheck size={14} /> Nhập tồn kho</>}</button></div>
          </form>
        </Modal>
      )}

      {saleForm && !replaceCard && (
        <Modal title="Bán / cấp thẻ RFID" description="Chọn thẻ còn trong kho, gắn với xe hoặc khách hàng, sau đó ghi nhận thanh toán." onClose={() => !submitting && setSaleForm(null)}>
          <form className="rfid-sales-form" onSubmit={(event) => void submitSale(event)}>
            <SaleFields form={saleForm} setForm={(next) => { setSaleForm(next); setSaleFormError(null); }} availableCards={availableCards} vehicleSuggestions={vehicleSuggestions} userSuggestions={userSuggestions} error={saleFormError} />
            <div className="modal-actions">
              <button type="button" className="small-button" onClick={() => setSaleForm(null)} disabled={submitting}>Hủy</button>
              <button type="submit" className="small-button primary" disabled={submitting}>{submitting ? <><Loader2 size={14} className="spin" /> Đang xử lý…</> : <><BadgeDollarSign size={14} /> Tạo giao dịch</>}</button>
            </div>
          </form>
        </Modal>
      )}

      {replaceCard && saleForm && (
        <Modal title="Cấp lại thẻ RFID" description={`Thẻ cũ ${replaceCard.cardId || replaceCard.uid} đang ở trạng thái ${STATUS_LABEL[replaceCard.status].toLowerCase()}.`} onClose={() => !submitting && (setReplaceCard(null), setSaleForm(null))}>
          <form className="rfid-sales-form" onSubmit={(event) => void submitSale(event, replaceCard)}>
            <SaleFields form={saleForm} setForm={(next) => { setSaleForm(next); setSaleFormError(null); }} availableCards={availableCards} vehicleSuggestions={vehicleSuggestions} userSuggestions={userSuggestions} error={saleFormError} replacement />
            <div className="modal-actions">
              <button type="button" className="small-button" onClick={() => { setReplaceCard(null); setSaleForm(null); }} disabled={submitting}>Hủy</button>
              <button type="submit" className="small-button primary" disabled={submitting}>{submitting ? <><Loader2 size={14} className="spin" /> Đang xử lý…</> : <><TicketCheck size={14} /> Cấp thẻ thay thế</>}</button>
            </div>
          </form>
        </Modal>
      )}

      {payosPayment && (
        <Modal title="Thanh toán PayOS" description="Sau khi PayOS xác nhận giao dịch, thẻ RFID sẽ tự động chuyển sang trạng thái đang sử dụng." onClose={() => setPayosPayment(null)}>
          <div className="rfid-payos-payment">
            <div className="rfid-payos-qr"><QRCodeSVG value={payosPayment.checkoutUrl} size={176} level="M" includeMargin /></div>
            <strong>Thanh toán {money(payosPayment.transaction.amount)}</strong>
            <span>Thẻ: {payosPayment.transaction.uid || "RFID"} · Giao dịch đang chờ xác nhận.</span>
            <a className="small-button primary" href={payosPayment.checkoutUrl} target="_blank" rel="noreferrer">Mở trang thanh toán PayOS</a>
            <div className="modal-actions"><button type="button" className="small-button" onClick={() => { setPayosPayment(null); void loadData(); }}>Đóng</button></div>
          </div>
        </Modal>
      )}

      {returnDialog && (
        <Modal title="Nhận trả thẻ RFID" description={`Thẻ ${returnDialog.card.cardId || returnDialog.card.uid}.`} onClose={() => !submitting && setReturnDialog(null)}>
          <div className="rfid-sales-form">
            <label className="rfid-sales-check"><input type="checkbox" checked={returnDialog.inspectionPassed} onChange={(event) => setReturnDialog({ ...returnDialog, inspectionPassed: event.target.checked })} /> Thẻ còn sử dụng được, đưa về tồn kho sẵn sàng bán.</label>
            <div className="modal-actions"><button type="button" className="small-button" onClick={() => setReturnDialog(null)} disabled={submitting}>Hủy</button><button type="button" className="small-button primary" disabled={submitting} onClick={() => void submitReturn()}>{submitting ? <><Loader2 size={14} className="spin" /> Đang xử lý…</> : <><RotateCcw size={14} /> Xác nhận trả thẻ</>}</button></div>
          </div>
        </Modal>
      )}

      {statusDialog && (
        <Modal title="Cập nhật trạng thái thẻ" description={`Thẻ ${statusDialog.card.cardId || statusDialog.card.uid} sẽ bị chặn tại cổng sau khi cập nhật.`} onClose={() => !submitting && setStatusDialog(null)}>
          <div className="rfid-sales-form">
            <Field label="Trạng thái mới"><select value={statusDialog.action} onChange={(event) => setStatusDialog({ ...statusDialog, action: event.target.value as StatusAction })}><option value="lost">Báo mất</option><option value="blocked">Khóa thẻ</option><option value="damaged">Thẻ hư hỏng</option></select></Field>
            <Field label="Lý do / ghi chú"><textarea rows={3} value={statusDialog.reason} onChange={(event) => setStatusDialog({ ...statusDialog, reason: event.target.value })} placeholder="Mô tả tình trạng thẻ hoặc lý do khóa" /></Field>
            <div className="modal-actions"><button type="button" className="small-button" onClick={() => setStatusDialog(null)} disabled={submitting}>Hủy</button><button type="button" className="small-button danger" disabled={submitting} onClick={() => void submitStatus()}>{submitting ? <><Loader2 size={14} className="spin" /> Đang lưu…</> : <><ShieldAlert size={14} /> Cập nhật</>}</button></div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function SaleFields({ form, setForm, availableCards, vehicleSuggestions, userSuggestions, error, replacement = false }: { form: SaleForm; setForm: (next: SaleForm) => void; availableCards: RfidInventoryItem[]; vehicleSuggestions: Array<{ id: string; plate: string; ownerName?: string; userId?: string; email?: string }>; userSuggestions: Array<{ id: string; email: string; name?: string }>; error?: string | null; replacement?: boolean }) {
  const total = Number(form.salePrice) || 0;
  const patch = (values: Partial<SaleForm>) => setForm({ ...form, ...values });
  return (
    <div className="rfid-sales-fields">
      {error && <div className="rfid-sales-notice error" role="alert"><TriangleAlert size={16} /><span>{error}</span></div>}
      <Field label={replacement ? "Thẻ Member thay thế" : "Thẻ Member từ tồn kho"} hint={`Có ${availableCards.length} thẻ sẵn sàng bán.`}>
        <select required value={form.cardId} onChange={(event) => patch({ cardId: event.target.value })}>
          <option value="">Chọn thẻ RFID…</option>
          {availableCards.map((card) => <option key={card.id} value={card.id}>{card.cardId || card.uid} · UID {card.uid}</option>)}
        </select>
      </Field>
      <Field label="Biển số xe đã đăng ký" hint="Nhập biển số để chọn xe đã có trong hệ thống."><input required list="rfid-vehicle-plates" value={form.vehiclePlate} onChange={(event) => { const value = event.target.value; const match = vehicleSuggestions.find((vehicle) => vehicle.plate.toUpperCase() === value.trim().toUpperCase()); patch({ vehiclePlate: value, vehicleId: match?.id || "", userId: match?.userId || form.userId, userEmail: match?.email || form.userEmail }); }} placeholder="Ví dụ: 30A12345" /><datalist id="rfid-vehicle-plates">{vehicleSuggestions.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.ownerName || ""}</option>)}</datalist></Field>
      <Field label="Email tài khoản (tùy chọn)" hint="Chọn email để xác nhận đúng chủ xe."><input list="rfid-user-emails" value={form.userEmail} onChange={(event) => { const value = event.target.value; const match = userSuggestions.find((user) => user.email.toLowerCase() === value.trim().toLowerCase()); patch({ userEmail: value, userId: match?.id || form.userId }); }} placeholder="Ví dụ: khachhang@email.com" /><datalist id="rfid-user-emails">{userSuggestions.map((user) => <option key={user.id} value={user.email}>{user.name || ""}</option>)}</datalist></Field>
      <div className="rfid-sales-form-grid">
        <Field label="Giá bán thẻ (VND)"><input type="number" min="0" step="1000" required value={form.salePrice} onChange={(event) => patch({ salePrice: event.target.value })} /></Field>
</div>
      <div className="rfid-sales-total"><span>Tổng cần thu</span><strong>{money(total)}</strong></div>
      <Field label="Phương thức thanh toán"><select value={form.method} onChange={(event) => patch({ method: event.target.value as RfidPaymentMethod })}><option value="cash">Tiền mặt</option><option value="payos">PayOS (QR / chuyển khoản)</option></select></Field>
      {total === 0 && <Field label="Lý do cấp miễn phí"><input required value={form.freeReason} onChange={(event) => patch({ freeReason: event.target.value })} placeholder="Ví dụ: Chương trình ưu đãi cư dân" /></Field>}
      <Field label="Ghi chú"><textarea rows={2} value={form.note} onChange={(event) => patch({ note: event.target.value })} placeholder="Ghi chú nội bộ (nếu có)" /></Field>
    </div>
  );
}


