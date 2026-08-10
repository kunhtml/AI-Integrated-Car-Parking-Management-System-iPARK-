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
  if (session.status !== "Đã hoàn thành") {
    const err = new Error("Phien chua hoan thanh, khong the tao bien lai.") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  return {
    sessionId: session._id.toString(),
    plate: session.plate,
    ownerName: session.ownerName,
    slot: session.slot,
    checkIn: session.checkInAt.toLocaleString("vi-VN"),
    checkOut: session.checkOutAt?.toLocaleString("vi-VN") || "",
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
    const W = 226;
    const doc = new PDFDocument({ margin: 0, size: [W, 700] });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Use Windows system fonts with Vietnamese Unicode support
    doc.registerFont("Regular", "C:\\Windows\\Fonts\\tahoma.ttf");
    doc.registerFont("Bold", "C:\\Windows\\Fonts\\tahomabd.ttf");

    const M = 14;
    const CW = W - M * 2;
    const shortId = data.sessionId.slice(-8).toUpperCase();
    const now = new Date().toLocaleString("vi-VN");

    function textCenter(str: string, y: number, size: number, color: string, bold = false) {
      doc.font(bold ? "Bold" : "Regular").fontSize(size).fillColor(color);
      doc.text(str, M, y, { width: CW, align: "center" });
    }

    function lineRow(label: string, value: string, yPos: number, valueColor = "#222222") {
      doc.font("Regular").fontSize(8.5).fillColor("#222222");
      doc.text(label, M, yPos, { continued: true, width: CW * 0.42 });
      doc.font("Regular").fontSize(8.5).fillColor(valueColor);
      doc.text(value, M + CW * 0.42, yPos, { width: CW * 0.58, align: "right" });
      return yPos + 14;
    }

    function divider(y: number) {
      doc.strokeColor("#d0d9e4");
      doc.lineWidth(0.5);
      doc.moveTo(M, y).lineTo(W - M, y).stroke();
      return y + 6;
    }

    function sectionTitle(title: string, y: number) {
      doc.font("Bold").fontSize(6.5).fillColor("#1a3a5c");
      doc.text(title.toUpperCase(), M, y, { width: CW, characterSpacing: 1 });
      return y + 12;
    }

    // ── Header background
    doc.rect(0, 0, W, 88).fill("#1a3a5c");

    textCenter(parkingConfig.brandName, 12, 13, "#ffffff", true);
    textCenter("BIÊN LAI GỬI XE  •  PARKING RECEIPT", 29, 7, "#a8c8e8");

    doc.strokeColor("#4a7aad");
    doc.lineWidth(0.5);
    doc.moveTo(M, 46).lineTo(W - M, 46).stroke();
    textCenter(`Mã phiếu: ${shortId}`, 49, 6.5, "#a8c8e8");
    textCenter(`In lúc: ${now}`, 60, 6, "#6a9ac0");
    textCenter(parkingConfig.address, 71, 6, "#6a9ac0");

    let y = 96;

    // ── Biển số
    doc.rect(M, y, CW, 24).fill("#eaf2fb");
    doc.rect(M, y, CW, 24).stroke("#b8d0e8");
    textCenter(data.plate, y + 6, 15, "#1a3a5c", true);
    y += 28;

    y = divider(y + 4);

    // ── Thông tin cơ bản
    y = sectionTitle("Thông tin xe", y);
    y = lineRow("Chủ xe", data.ownerName, y);
    y = lineRow("Vị trí đỗ", `Slot ${data.slot}`, y);
    y += 6;

    y = divider(y);

    // ── Thời gian
    y = sectionTitle("Thời gian", y);

    const cardW = (CW - 6) / 2;
    const cardH = 36;
    const inParts = data.checkIn.includes(", ")
      ? data.checkIn.split(", ")
      : [data.checkIn, ""];
    const outParts = data.checkOut.includes(", ")
      ? data.checkOut.split(", ")
      : [data.checkOut, ""];

    doc.rect(M, y, cardW, cardH).fill("#e8f5e9");
    doc.rect(M, y, cardW, cardH).stroke("#a5d6a7");
    doc.font("Bold").fontSize(5.5).fillColor("#2e7d32");
    doc.text("GIỜ VÀO", M + 6, y + 5, { width: cardW - 12, align: "center" });
    doc.font("Bold").fontSize(9).fillColor("#1b5e20");
    doc.text(inParts[1] || inParts[0], M + 6, y + 14, { width: cardW - 12, align: "center" });
    doc.font("Regular").fontSize(5.5).fillColor("#2e7d32");
    doc.text(inParts[0], M + 6, y + 25, { width: cardW - 12, align: "center" });

    const card2X = M + cardW + 6;
    doc.rect(card2X, y, cardW, cardH).fill("#fff3e0");
    doc.rect(card2X, y, cardW, cardH).stroke("#ffcc80");
    doc.font("Bold").fontSize(5.5).fillColor("#e65100");
    doc.text("GIỜ RA", card2X + 6, y + 5, { width: cardW - 12, align: "center" });
    doc.font("Bold").fontSize(9).fillColor("#bf360c");
    doc.text(outParts[1] || outParts[0], card2X + 6, y + 14, { width: cardW - 12, align: "center" });
    doc.font("Regular").fontSize(5.5).fillColor("#e65100");
    doc.text(outParts[0], card2X + 6, y + 25, { width: cardW - 12, align: "center" });

    y += cardH + 8;
    y = divider(y);

    // ── Chi tiết phí
    y = sectionTitle("Chi tiết phí", y);
    y = lineRow("Tổng thời gian", `${data.totalMinutes} phút`, y);
    y = lineRow("Giờ tính phí", `${data.billableHours} giờ`, y);
    y = lineRow("Đơn giá", `${data.hourlyRate.toLocaleString("vi-VN")} ₫/h`, y);
    y = lineRow("Phí gửi xe", `${data.parkingFee.toLocaleString("vi-VN")} ₫`, y);

    if (data.overdueFine > 0) {
      y = lineRow("Phí quá hạn", `+${data.overdueFine.toLocaleString("vi-VN")} ₫`, y, "#c0392b");
    }
    if (data.discount > 0) {
      y = lineRow("Giảm giá", `-${data.discount.toLocaleString("vi-VN")} ₫`, y, "#27ae60");
    }

    y += 4;

    // ── Tổng cộng
    doc.rect(M, y, CW, 26).fill("#1a3a5c");
    doc.font("Bold").fontSize(7).fillColor("#a8c8e8");
    doc.text("TỔNG CỘNG", M + 10, y + 9, { continued: true, width: CW * 0.45 });
    doc.font("Bold").fontSize(13).fillColor("#ffffff");
    doc.text(`${data.totalFee.toLocaleString("vi-VN")} ₫`, M + CW * 0.45, y + 4, { width: CW * 0.55, align: "right" });
    y += 32;

    // ── Trạng thái thanh toán
    const isPaid = ["fully_paid", "partial_paid"].includes(data.paymentStatus);
    const bgColor = isPaid ? "#e8f5e9" : "#fff3e0";
    const strokeColor = isPaid ? "#a5d6a7" : "#ffcc80";
    const fgColor = isPaid ? "#2e7d32" : "#e65100";
    const methodMap: Record<string, string> = {
      payos: "PayOS",
      subscription: "Gói thành viên",
      cash: "Tiền mặt",
    };
    const methodText = data.paymentMethod ? (methodMap[data.paymentMethod] ?? data.paymentMethod) : "";

    doc.rect(M, y, CW, 22).fill(bgColor);
    doc.rect(M, y, CW, 22).stroke(strokeColor);
    doc.font("Bold").fontSize(8).fillColor(fgColor);
    doc.text(isPaid ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN", M + 8, y + 4, { width: CW - 16, align: "left" });
    if (methodText) {
      doc.font("Regular").fontSize(6.5).fillColor(fgColor);
      doc.text(methodText, M + 8, y + 15, { width: CW - 16, align: "left" });
    }
    y += 30;

    // ── Footer
    y = divider(y);
    textCenter(parkingConfig.brandName.toUpperCase(), y, 7, "#1a3a5c", true);
    y += 13;
    textCenter("Cảm ơn quý khách đã sử dụng dịch vụ!", y, 6, "#888888");
    y += 11;
    textCenter("Xin giữ biên lai khi rời bãi xe.", y, 5.5, "#bbbbbb");

    doc.end();
  });
}
