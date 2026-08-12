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
} from "./rfid-sales-api";

type PanelTab = "inventory" | "transactions";
type StatusAction = "lost" | "blocked" | "damaged";
type SaleForm = {
  cardId: string;
  userId: string;
  vehicleId: string;
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

const EMPTY_INVENTORY_FORM: InventoryForm = { uid: "", notes: "" };

const EMPTY_SALE_FORM: SaleForm = {
  cardId: "",
  userId: "",
  vehicleId: "",
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
  const [replaceCard, setReplaceCard] = useState<RfidInventoryItem | null>(null);
  const [returnDialog, setReturnDialog] = useState<ReturnDialog | null>(null);
  const [statusDialog, setStatusDialog] = useState<StatusDialog | null>(null);
  const [payosPayment, setPayosPayment] = useState<{ transaction: RfidTransaction; checkoutUrl: string } | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryForm | null>(null);

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

  async function submitInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryForm || submitting) return;
    const uid = inventoryForm.uid.trim();
    if (!uid) {
      setNotice({ tone: "error", text: "Hãy nhập UID của thẻ RFID." });
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
    const payload = normalizeSaleInput(form);
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

  async function confirmPendingSale(transaction: RfidTransaction) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await confirmRfidSale(transaction.id);
      setNotice({ tone: "success", text: "Đã xác nhận giao dịch và kích hoạt thẻ RFID." });
      await loadData();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Không thể xác nhận giao dịch." });
    } finally {
      setSubmitting(false);
    }
  }

  function openSale(card?: RfidInventoryItem) {
    setSaleForm(blankSaleForm({ cardId: card?.id ?? "" }));
    setReplaceCard(null);
  }

  function openReplace(card: RfidInventoryItem) {
    setReplaceCard(card);
    setSaleForm(blankSaleForm({ vehicleId: String(card.vehicleId ?? ""), userId: String(card.userId ?? ""), salePrice: String(card.salePrice ?? 0) }));
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
                <div key="money" className="rfid-card-money"><strong>{money(card.salePrice)}</strong></div>,
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
                <span key="type" className="rfid-transaction-type">{TRANSACTION_LABEL[transaction.transactionType]}</span>,
                <span key="uid" className="uid-pill">{transaction.uid || "—"}</span>,
                <div key="amount" className="rfid-card-money"><strong>{money(transaction.amount)}</strong><span>Giá: {money(transaction.salePrice)}</span></div>,
                <div key="method" className="rfid-method"><strong>{transaction.method === "payos" ? "PayOS" : transaction.method === "cash" ? "Tiền mặt" : "Ví điện tử"}</strong><span className={transaction.status === "paid" ? "rfid-life-badge success" : transaction.status === "pending" ? "rfid-life-badge warning" : "rfid-life-badge danger"}>{transaction.status === "paid" ? "Đã thanh toán" : transaction.status === "pending" ? "Chờ thanh toán" : "Không thành công"}</span></div>,
                <span key="time" className="cell-muted-tiny">{dateTime(transaction.paidAt || transaction.createdAt)}</span>,
                <div key="confirm" className="rfid-sales-actions">
                  {transaction.status === "pending" ? <button type="button" className="small-button success" disabled={submitting} onClick={() => void confirmPendingSale(transaction)}><CheckCircle2 size={13} /> Xác nhận</button> : <span className="cell-muted-tiny">—</span>}
                </div>,
              ])}
            />
          )}
        </>
      )}

      {inventoryForm && (
        <Modal title="Nhập thẻ vào tồn kho" description="Thẻ được tạo ở trạng thái sẵn sàng bán và chưa được phép qua cổng." onClose={() => !submitting && setInventoryForm(null)}>
          <form className="rfid-sales-form" onSubmit={(event) => void submitInventory(event)}>
            <Field label="UID thẻ RFID" hint="Quét hoặc nhập UID in trên thẻ. UID phải là duy nhất."><input autoFocus required value={inventoryForm.uid} onChange={(event) => setInventoryForm({ ...inventoryForm, uid: event.target.value })} placeholder="Ví dụ: 04A1B2C3D4" /></Field>
            <Field label="Ghi chú nhập kho"><textarea rows={3} value={inventoryForm.notes} onChange={(event) => setInventoryForm({ ...inventoryForm, notes: event.target.value })} placeholder="Ví dụ: Lô thẻ mới tháng 08/2026" /></Field>
            <div className="modal-actions"><button type="button" className="small-button" onClick={() => setInventoryForm(null)} disabled={submitting}>Hủy</button><button type="submit" className="small-button primary" disabled={submitting}>{submitting ? <><Loader2 size={14} className="spin" /> Đang nhập…</> : <><PackageCheck size={14} /> Nhập tồn kho</>}</button></div>
          </form>
        </Modal>
      )}

      {saleForm && !replaceCard && (
        <Modal title="Bán / cấp thẻ RFID" description="Chọn thẻ còn trong kho, gắn với xe hoặc khách hàng, sau đó ghi nhận thanh toán." onClose={() => !submitting && setSaleForm(null)}>
          <form className="rfid-sales-form" onSubmit={(event) => void submitSale(event)}>
            <SaleFields form={saleForm} setForm={setSaleForm} availableCards={availableCards} />
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
            <SaleFields form={saleForm} setForm={setSaleForm} availableCards={availableCards} replacement />
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

function SaleFields({ form, setForm, availableCards, replacement = false }: { form: SaleForm; setForm: (next: SaleForm) => void; availableCards: RfidInventoryItem[]; replacement?: boolean }) {
  const total = Number(form.salePrice) || 0;
  const patch = (values: Partial<SaleForm>) => setForm({ ...form, ...values });
  return (
    <div className="rfid-sales-fields">
      <Field label={replacement ? "Thẻ Member thay thế" : "Thẻ Member từ tồn kho"} hint={`Có ${availableCards.length} thẻ sẵn sàng bán.`}>
        <select required value={form.cardId} onChange={(event) => patch({ cardId: event.target.value })}>
          <option value="">Chọn thẻ RFID…</option>
          {availableCards.map((card) => <option key={card.id} value={card.id}>{card.cardId || card.uid} · UID {card.uid}</option>)}
        </select>
      </Field>
      <Field label="Mã xe đã đăng ký" hint="Bắt buộc. Một RFID Member chỉ được bán đứt và gắn với một xe."><input required value={form.vehicleId} onChange={(event) => patch({ vehicleId: event.target.value })} placeholder="MongoDB ObjectId của xe" /></Field>
      <Field label="Mã tài khoản (tùy chọn)" hint="Hệ thống sẽ tự đối chiếu chủ xe để ngăn gắn nhầm thẻ."><input value={form.userId} onChange={(event) => patch({ userId: event.target.value })} placeholder="MongoDB ObjectId" /></Field>
      <div className="rfid-sales-form-grid">
        <Field label="Giá bán thẻ (VND)"><input type="number" min="0" step="1000" required value={form.salePrice} onChange={(event) => patch({ salePrice: event.target.value })} /></Field>
</div>
      <div className="rfid-sales-total"><span>Tổng cần thu</span><strong>{money(total)}</strong></div>
      <Field label="Phương thức thanh toán"><select value={form.method} onChange={(event) => patch({ method: event.target.value as RfidPaymentMethod })}><option value="cash">Tiền mặt</option><option value="payos">PayOS (QR / chuyển khoản)</option><option value="wallet">Ví điện tử</option></select></Field>
      {total === 0 && <Field label="Lý do cấp miễn phí"><input required value={form.freeReason} onChange={(event) => patch({ freeReason: event.target.value })} placeholder="Ví dụ: Chương trình ưu đãi cư dân" /></Field>}
      <Field label="Ghi chú"><textarea rows={2} value={form.note} onChange={(event) => patch({ note: event.target.value })} placeholder="Ghi chú nội bộ (nếu có)" /></Field>
    </div>
  );
}
