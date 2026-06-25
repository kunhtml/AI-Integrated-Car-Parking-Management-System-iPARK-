import crypto from "crypto";

// Host API chính thức của PayOS. Lưu ý: apex "api.payos.vn" KHÔNG có bản ghi A,
// host đúng là "api-merchant.payos.vn".
const PAYOS_API_BASE = "https://api-merchant.payos.vn";

/**
 * PayOS Service - Tích hợp thanh toán tự động qua PayOS
 * 
 * PayOS sẽ gửi webhook ngay khi có thanh toán thành công
 * Không cần polling/check định kỳ
 */

interface PayOSConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

interface CreatePaymentLinkData {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

interface PayOSPaymentLinkResponse {
  code: string;
  desc: string;
  data: {
    id: string;
    orderCode: number;
    amount: number;
    description: string;
    checkoutUrl: string;
    qrCode: string;
    status: string;
    accountNumber: string;
    accountName: string;
    bin: string;
  };
}

interface WebhookData {
  code: string;
  desc: string;
  success: boolean;
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    counterAccountBankId: string;
    counterAccountBankName: string;
    counterAccountName: string;
    counterAccountNumber: string;
    virtualAccountName: string;
    virtualAccountNumber: string;
  };
  signature: string;
}

/**
 * Lấy config PayOS từ .env
 */
export function getPayOSConfig(): PayOSConfig | null {
  const clientId = process.env.PAYTOS_CLIENT_ID;
  const apiKey = process.env.PAYTOS_API_KEY;
  const checksumKey = process.env.PAYTOS_CHECKSUM_KEY;
  
  if (!clientId || !apiKey || !checksumKey) {
    return null;
  }
  return { clientId, apiKey, checksumKey };
}

/**
 * Tạo chữ ký cho request
 */
function createSignature(data: Record<string, any>, checksumKey: string): string {
  const sortedKeys = Object.keys(data).sort();
  const signData = sortedKeys.map((key) => `${key}=${data[key]}`).join("&");
  return crypto.createHmac("sha256", checksumKey).update(signData).digest("hex");
}

/**
 * Tạo chữ ký cho webhook data
 */
function createSignatureFromObject(data: Record<string, any>, checksumKey: string): string {
  const signData = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("&");
  return crypto.createHmac("sha256", checksumKey).update(signData).digest("hex");
}

/**
 * Sinh orderCode dạng SỐ NGUYÊN cho PayOS (không được chứa chữ).
 */
export function generatePayOSOrderCode(): number {
  const tail = Date.now() % 1_000_000_000; // 9 chữ số
  const rand = Math.floor(Math.random() * 10_000); // 0..9999
  return tail * 10_000 + rand;
}

/**
 * Helper cấp cao: tạo link PayOS cho một khoản thanh toán bất kỳ.
 * Trả về đầy đủ thông tin QR + tài khoản để frontend hiển thị.
 */
export async function createPayOSPayment(params: {
  amount: number;
  sessionId: string;
  label?: string; // tiền tố nội dung, mặc định "iPARK"
  baseUrl: string;
  frontendUrl: string;
}): Promise<{
  success: boolean;
  error?: string;
  orderCode?: number;
  qrCode?: string;
  checkoutUrl?: string;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  description?: string;
}> {
  const orderCode = generatePayOSOrderCode();
  // PayOS giới hạn description tối đa 25 ký tự
  const description = `${params.label || "iPARK"} ${params.sessionId.slice(-6)}`.slice(0, 25);

  const result = await createPayOSPaymentLink({
    orderCode,
    amount: Math.round(params.amount || 0),
    description,
    returnUrl: `${params.baseUrl}/api/payos/return?orderCode=${orderCode}`,
    cancelUrl: `${params.frontendUrl}/payment/cancel?session=${params.sessionId}`,
  });

  if (result.success && result.data) {
    return {
      success: true,
      orderCode,
      qrCode: result.data.qrCode,
      checkoutUrl: result.data.checkoutUrl,
      accountNumber: result.data.accountNumber,
      accountName: result.data.accountName,
      bin: result.data.bin,
      description,
    };
  }
  return { success: false, error: result.error || "Không thể tạo liên kết thanh toán PayOS" };
}

/**
 * Tạo payment link với PayOS
 */
export async function createPayOSPaymentLink(
  paymentData: CreatePaymentLinkData,
): Promise<{
  success: boolean;
  data?: PayOSPaymentLinkResponse["data"];
  error?: string;
}> {
  const config = getPayOSConfig();
  if (!config) {
    return { success: false, error: "PayOS chưa được cấu hình" };
  }

  const { clientId, apiKey, checksumKey } = config;

  // Tạo signature
  const signatureData = {
    orderCode: paymentData.orderCode,
    amount: paymentData.amount,
    description: paymentData.description,
    cancelUrl: paymentData.cancelUrl,
    returnUrl: paymentData.returnUrl,
  };
  const signature = createSignature(signatureData, checksumKey);

  try {
    const response = await fetch(`${PAYOS_API_BASE}/v2/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        orderCode: paymentData.orderCode,
        amount: paymentData.amount,
        description: paymentData.description,
        returnUrl: paymentData.returnUrl,
        cancelUrl: paymentData.cancelUrl,
        buyerName: paymentData.buyerName,
        buyerEmail: paymentData.buyerEmail,
        buyerPhone: paymentData.buyerPhone,
        signature,
      }),
    });

    const result = await response.json();

    if (result.code === "00") {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.desc || "Lỗi không xác định" };
    }
  } catch (error) {
    console.error("[PayOS] Error creating payment link:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi kết nối PayOS",
    };
  }
}

/**
 * Xác minh chữ ký webhook
 */
export function verifyWebhookSignature(
  webhookBody: WebhookData,
  checksumKey: string,
): boolean {
  try {
    const { signature, ...data } = webhookBody;
    const expectedSignature = createSignatureFromObject(data, checksumKey);
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Lấy thông tin payment link
 */
export async function getPayOSPaymentLink(
  orderCode: string,
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const config = getPayOSConfig();
  if (!config) {
    return { success: false, error: "PayOS chưa được cấu hình" };
  }

  const { clientId, apiKey } = config;

  try {
    const response = await fetch(
      `${PAYOS_API_BASE}/v2/payment-requests/${orderCode}`,
      {
        method: "GET",
        headers: {
          "X-Client-Id": clientId,
          "X-API-Key": apiKey,
        },
      },
    );

    const result = await response.json();

    if (result.code === "00") {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.desc || "Lỗi không xác định" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi kết nối PayOS",
    };
  }
}

/**
 * Hủy payment link
 */
export async function cancelPayOSPaymentLink(
  orderCode: string,
): Promise<{ success: boolean; error?: string }> {
  const config = getPayOSConfig();
  if (!config) {
    return { success: false, error: "PayOS chưa được cấu hình" };
  }

  const { clientId, apiKey } = config;

  try {
    const response = await fetch(
      `${PAYOS_API_BASE}/v2/payment-requests/${orderCode}/cancel`,
      {
        method: "POST",
        headers: {
          "X-Client-Id": clientId,
          "X-API-Key": apiKey,
        },
      },
    );

    const result = await response.json();

    if (result.code === "00") {
      return { success: true };
    } else {
      return { success: false, error: result.desc || "Lỗi không xác định" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi kết nối PayOS",
    };
  }
}

/**
 * Xác nhận webhook URL với PayOS
 */
export async function confirmWebhookUrl(
  webhookUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const config = getPayOSConfig();
  if (!config) {
    return { success: false, error: "PayOS chưa được cấu hình" };
  }

  const { clientId, apiKey } = config;

  try {
    const response = await fetch(`${PAYOS_API_BASE}/v2/webhook/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ webhookUrl }),
    });

    const result = await response.json();

    if (result.code === "00") {
      return { success: true };
    } else {
      return { success: false, error: result.desc || "Lỗi không xác định" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi kết nối PayOS",
    };
  }
}

/**
 * Kiểm tra trạng thái thanh toán PayOS
 */
export async function checkPayOSPaymentStatus(
  orderCode: string,
): Promise<{ status: string; message?: string }> {
  const config = getPayOSConfig();
  if (!config) {
    return { status: "ERROR", message: "PayOS chưa được cấu hình" };
  }

  const { clientId, apiKey } = config;

  try {
    const response = await fetch(
      `${PAYOS_API_BASE}/v2/payment-requests/${orderCode}`,
      {
        method: "GET",
        headers: {
          "X-Client-Id": clientId,
          "X-API-Key": apiKey,
        },
      },
    );

    const result = await response.json();

    if (result.code === "00") {
      // Map PayOS status → Transaction.status chuẩn
      const payosStatus = result.data?.status?.toUpperCase();
      let mappedStatus: string;
      switch (payosStatus) {
        case "PAID":
        case "COMPLETED":
          mappedStatus = "paid";
          break;
        case "CANCELLED":
        case "EXPIRED":
          mappedStatus = "cancelled";
          break;
        default:
          mappedStatus = "pending";
      }
      return { status: mappedStatus };
    } else {
      return { status: "ERROR", message: result.desc || "Lỗi không xác định" };
    }
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Lỗi kết nối PayOS",
    };
  }
}
