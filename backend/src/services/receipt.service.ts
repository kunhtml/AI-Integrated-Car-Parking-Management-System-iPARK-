import PDFDocument from "pdfkit";
import { ParkingSession } from "../models/ParkingSession.js";
import { parkingConfig } from "../config/parking.js";

export type ReceiptData = {
  sessionId: string;
  plate: string;
  ownerName: string;
  slot: string;
  checkIn: string;
  checkOut: string;
  totalMinutes: number;
  billableHours: number;
  hourlyRate: number;
  parkingFee: number;
  overdueFine: number;
  discount: number;
  totalFee: number;
  paymentStatus: string;
  paymentMethod?: string;
};

export async function getReceiptData(sessionId: string): Promise<ReceiptData> {
  const session = await ParkingSession.findById(sessionId);
  if (!session) {
    const err = new Error("Phien khong ton tai.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  // Nhân viên in hóa đơn NGAY sau khi thu tiền, trước khi mở barie — phiên
  // lúc đó vẫn "Đang gửi". Chỉ chặn phiên chưa thanh toán.
  const settled =
    session.status === "Đã hoàn thành" || session.paymentStatus === "fully_paid";
  if (!settled) {
    const err = new Error("Phien chua thanh toan, khong the tao bien lai.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  return {
    sessionId: session._id.toString(),
    plate: session.plate,
    ownerName: session.ownerName,
    slot: session.slot,
    checkIn: session.checkInAt.toLocaleString("vi-VN"),
    // Chưa mở barie thì lấy thời điểm hiện tại làm giờ ra dự kiến.
    checkOut: session.checkOutAt
      ? session.checkOutAt.toLocaleString("vi-VN")
      : new Date().toLocaleString("vi-VN"),
    totalMinutes: session.feeBreakdown?.totalMinutes ?? 0,
    billableHours: session.feeBreakdown?.billableHours ?? 0,
    hourlyRate: session.feeBreakdown?.hourlyRate ?? 0,
    parkingFee: session.feeBreakdown?.parkingFee ?? 0,
    overdueFine: (session.feeBreakdown as any)?.overdueFine ?? 0,
    discount: session.discountAmount ?? 0,
    totalFee: session.fee,
    paymentStatus: session.paymentStatus,
    paymentMethod: session.paymentMethod,
  };
}

export async function generateReceiptPdf(sessionId: string): Promise<Buffer> {
  const data = await getReceiptData(sessionId);

  return new Promise<Buffer>((resolve, reject) => {
    // Biên lai khổ 80mm (~226.8pt). Chiều cao đủ cho nội dung dài nhất.
    const W = 226;
    const H = 640;
    const doc = new PDFDocument({ margin: 0, size: [W, H] });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Font hệ thống Windows có Unicode tiếng Việt
    doc.registerFont("Regular", "C:\\Windows\\Fonts\\tahoma.ttf");
    doc.registerFont("Bold", "C:\\Windows\\Fonts\\tahomabd.ttf");

    const M = 14;
    const CW = W - M * 2;
    const NAVY = "#1a3a5c";
    const shortId = data.sessionId.slice(-8).toUpperCase();
    const now = new Date().toLocaleString("vi-VN");

    // Con trỏ duy nhất — mọi khối đọc/ghi yCursor, không tính offset tuyệt đối.
    let yCursor = 0;

    function textCenter(str: string, y: number, size: number, color: string, bold = false) {
      doc.font(bold ? "Bold" : "Regular").fontSize(size).fillColor(color);
      doc.text(str, M, y, { width: CW, align: "center", lineBreak: false });
    }

    function divider(y: number, gap = 8) {
      doc.strokeColor("#c3cfdd").lineWidth(0.5);
      doc.moveTo(M, y).lineTo(W - M, y).stroke();
      return y + gap;
    }

    function sectionTitle(title: string, y: number) {
      doc.font("Bold").fontSize(7).fillColor(NAVY);
      doc.text(title.toUpperCase(), M, y, { width: CW, characterSpacing: 1, lineBreak: false });
      return y + 14;
    }

    // ── Header
    const headerH = 84;
    doc.rect(0, 0, W, headerH).fill(NAVY);
    textCenter(parkingConfig.brandName, 12, 14, "#ffffff", true);
    textCenter("BIÊN LAI GỬI XE • PARKING RECEIPT", 31, 6.5, "#a8c8e8");
    doc.strokeColor("#4a7aad").lineWidth(0.5);
    doc.moveTo(M, 44).lineTo(W - M, 44).stroke();
    textCenter(`Mã phiếu: ${shortId}`, 48, 6.5, "#c8dcf0");
    textCenter(`In lúc: ${now}`, 59, 6, "#8fb4d6");
    textCenter(parkingConfig.address, 70, 6, "#8fb4d6");
    yCursor = headerH + 10;

    // ── Biển số nổi bật
    const plateH = 30;
    doc.roundedRect(M, yCursor, CW, plateH, 4).fill("#eaf2fb");
    doc.roundedRect(M, yCursor, CW, plateH, 4).stroke("#b8d0e8");
    textCenter(data.plate, yCursor + 7, 16, NAVY, true);
    yCursor += plateH + 10;

    yCursor = divider(yCursor, 10);

    // ── Thông tin xe
    yCursor = sectionTitle("Thông tin xe", yCursor);
    function lineRow(label: string, value: string, y: number, valueColor = "#222222", valueBold = false) {
      doc.font("Regular").fontSize(8.5).fillColor("#556070");
      doc.text(label, M, y, { width: CW * 0.4, lineBreak: false });
      doc.font(valueBold ? "Bold" : "Regular").fontSize(8.5).fillColor(valueColor);
      doc.text(value, M + CW * 0.4, y, { width: CW * 0.6, align: "right", lineBreak: false });
      return y + 15;
    }
    yCursor = lineRow("Chủ xe", data.ownerName, yCursor);
    yCursor = lineRow("Vị trí đỗ", `Slot ${data.slot}`, yCursor);
    yCursor += 6;

    yCursor = divider(yCursor, 10);

    // ── Thời gian: 2 thẻ giờ vào / giờ ra
    yCursor = sectionTitle("Thời gian", yCursor);
    const cardW = (CW - 8) / 2;
    const cardH = 38;
    const split = (s: string) => (s.includes(", ") ? s.split(", ") : [s, ""]);
    const [inDate, inTime] = split(data.checkIn);
    const [outDate, outTime] = split(data.checkOut);

    function timeCard(x: number, title: string, time: string, date: string, bg: string, border: string, fgTitle: string, fgMain: string) {
      doc.roundedRect(x, yCursor, cardW, cardH, 4).fill(bg);
      doc.roundedRect(x, yCursor, cardW, cardH, 4).stroke(border);
      doc.font("Bold").fontSize(5.5).fillColor(fgTitle);
      doc.text(title, x + 4, yCursor + 6, { width: cardW - 8, align: "center", lineBreak: false });
      doc.font("Bold").fontSize(10).fillColor(fgMain);
      doc.text(time || date, x + 4, yCursor + 15, { width: cardW - 8, align: "center", lineBreak: false });
      doc.font("Regular").fontSize(5.5).fillColor(fgTitle);
      doc.text(time ? date : "", x + 4, yCursor + 28, { width: cardW - 8, align: "center", lineBreak: false });
    }
    timeCard(M, "GIỜ VÀO", inTime, inDate, "#e8f5e9", "#a5d6a7", "#2e7d32", "#1b5e20");
    timeCard(M + cardW + 8, "GIỜ RA", outTime, outDate, "#fff3e0", "#ffcc80", "#e65100", "#bf360c");
    yCursor += cardH + 10;

    yCursor = divider(yCursor, 10);

    // ── Chi tiết phí
    yCursor = sectionTitle("Chi tiết phí", yCursor);
    yCursor = lineRow("Tổng thời gian", `${data.totalMinutes} phút`, yCursor);
    yCursor = lineRow("Giờ tính phí", `${data.billableHours} giờ`, yCursor);
    yCursor = lineRow("Đơn giá", `${data.hourlyRate.toLocaleString("vi-VN")} ₫/h`, yCursor);
    yCursor = lineRow("Phí gửi xe", `${data.parkingFee.toLocaleString("vi-VN")} ₫`, yCursor);
    if (data.overdueFine > 0) {
      yCursor = lineRow("Phí quá hạn", `+${data.overdueFine.toLocaleString("vi-VN")} ₫`, yCursor, "#c0392b");
    }
    if (data.discount > 0) {
      yCursor = lineRow("Giảm giá", `-${data.discount.toLocaleString("vi-VN")} ₫`, yCursor, "#27ae60");
    }
    yCursor += 8;

    // ── TỔNG CỘNG (khối đặc, cao hơn, tiền khổ lớn)
    const totalH = 34;
    doc.roundedRect(M, yCursor, CW, totalH, 4).fill(NAVY);
    doc.font("Bold").fontSize(7).fillColor("#a8c8e8");
    doc.text("TỔNG CỘNG", M + 10, yCursor + 13, { width: CW * 0.4, lineBreak: false });
    doc.font("Bold").fontSize(15).fillColor("#ffffff");
    doc.text(`${data.totalFee.toLocaleString("vi-VN")} ₫`, M + CW * 0.4, yCursor + 9, { width: CW * 0.6 - 10, align: "right", lineBreak: false });
    yCursor += totalH + 10;

    // ── Trạng thái thanh toán
    const isPaid = ["fully_paid", "partial_paid"].includes(data.paymentStatus);
    const bg = isPaid ? "#e8f5e9" : "#fff3e0";
    const border = isPaid ? "#a5d6a7" : "#ffcc80";
    const fg = isPaid ? "#2e7d32" : "#e65100";
    const methodMap: Record<string, string> = {
      payos: "PayOS",
      subscription: "Gói thành viên",
      cash: "Tiền mặt",
    };
    const methodText = data.paymentMethod ? (methodMap[data.paymentMethod] ?? data.paymentMethod) : "";

    const payH = methodText ? 30 : 22;
    doc.roundedRect(M, yCursor, CW, payH, 4).fill(bg);
    doc.roundedRect(M, yCursor, CW, payH, 4).stroke(border);
    doc.font("Bold").fontSize(9).fillColor(fg);
    doc.text(isPaid ? "✓ ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN", M + 10, yCursor + 6, { width: CW - 20, lineBreak: false });
    if (methodText) {
      doc.font("Regular").fontSize(6.5).fillColor(fg);
      doc.text(`Phương thức: ${methodText}`, M + 10, yCursor + 19, { width: CW - 20, lineBreak: false });
    }
    yCursor += payH + 10;

    // ── Footer
    yCursor = divider(yCursor, 8);
    textCenter(parkingConfig.brandName.toUpperCase(), yCursor, 7, NAVY, true);
    yCursor += 12;
    textCenter("Cảm ơn quý khách đã sử dụng dịch vụ!", yCursor, 6.5, "#667080");
    yCursor += 11;
    textCenter("Vui lòng giữ biên lai khi rời bãi xe.", yCursor, 5.5, "#9aa5b1");

    doc.end();
  });
}
