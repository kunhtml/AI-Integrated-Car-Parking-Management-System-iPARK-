import { existsSync } from "node:fs";

const TAHOMA_REGULAR = "C:\\Windows\\Fonts\\tahoma.ttf";
const TAHOMA_BOLD = "C:\\Windows\\Fonts\\tahomabd.ttf";

/**
 * Đăng ký font hệ thống có hỗ trợ tiếng Việt cho pdfkit (giống receipt.service).
 * Trả về tên font để dùng với doc.font(); fallback về Helvetica nếu không tìm thấy.
 */
export function registerVietnameseFonts(doc: PDFKit.PDFDocument) {
  if (existsSync(TAHOMA_REGULAR) && existsSync(TAHOMA_BOLD)) {
    doc.registerFont("VN-Regular", TAHOMA_REGULAR);
    doc.registerFont("VN-Bold", TAHOMA_BOLD);
    return { regular: "VN-Regular", bold: "VN-Bold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}
