// ADD_02 - RFID Card Sales: customer buys card on self-service page,
// PayOS QR payment, webhook registers payment, card -> active, admin verifies reports.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { chromium } = require("playwright");

const OUT = __dirname;
const BASE = "http://localhost:3000";
const API = "http://127.0.0.1:4000/api";
const CUSTOMER = { email: "add02.test@ipark.vn", password: "123456" };
const ADMIN = { email: "admin@ipark.vn", password: "admin" };
const PLATE = "30ADD02";
const CHECKSUM_KEY = process.env.PAYTOS_CHECKSUM_KEY || "05a208dccd1392423a41dcc5b5a4ca356fafeda1ba447d3d419d9580c7780ae9";

const apiFail = [];
let orderCode = null, transactionId = null, purchaseRequestId = null, assignedUid = null;
const log = (m) => console.log("[add02] " + m);
function signWebhook(data) {
  const s = Object.keys(data).sort().map((k) => k + "=" + data[k]).join("&");
  return crypto.createHmac("sha256", CHECKSUM_KEY).update(s).digest("hex");
}
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 400) {
      apiFail.push(res.status() + " " + res.request().method() + " " + res.url());
    }
  });

  // ---------- Step 0: customer login ----------
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', CUSTOMER.email);
  await page.fill('input[name="password"]', CUSTOMER.password);
  await page.screenshot({ path: path.join(OUT, "01_customer_login.png") });
  await page.click('button[type="submit"]');
  await page.waitForURL("**/overview", { timeout: 30000 });
  log("customer logged in");

  // ---------- Step 1: self-service RFID registration page ----------
  await page.goto(BASE + "/rfid-registration", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "02_rfid_registration_before.png") });

  const buyBtn = page.locator("tr", { hasText: PLATE }).locator('button:has-text("Mua thẻ ngay")').first();
  if ((await buyBtn.count()) === 0) {
    log("FAIL: no Mua thẻ ngay button for plate " + PLATE);
    await page.screenshot({ path: path.join(OUT, "FAIL_no_buy_button.png") });
    process.exit(1);
  }
  await buyBtn.click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, "03_after_buy_click_pending.png") });

  const cookies = await ctx.cookies();
  const cookieStr = cookies.map((c) => c.name + "=" + c.value).join("; ");

  const mine = await fetch(API + "/rfid/purchase-requests/mine", { headers: { cookie: cookieStr } }).then((r) => r.json());
  const req = (mine.requests || []).find((r) => r.vehicleId && r.status === "pending_payment");
  if (!req) { log("FAIL: no pending_payment request found"); process.exit(1); }
  purchaseRequestId = req.id;
  transactionId = req.transactionId;
  log("purchase request " + purchaseRequestId + " txn " + transactionId + " status=" + req.status);

  const payRes = await fetch(API + "/rfid/purchase-requests/" + purchaseRequestId + "/pay", { method: "POST", headers: { cookie: cookieStr } }).then((r) => r.json());
  log("pay -> success=" + payRes.payos?.success + " orderCode=" + payRes.payos?.orderCode);
  const txnRaw = await fetch(API + "/transactions/" + transactionId, { headers: { cookie: cookieStr } }).then((r) => r.json()); const txn = txnRaw.transaction || txnRaw;
  orderCode = txn.payosOrderCode;
  log("payosOrderCode=" + orderCode + " amount=" + txn.amount + " status=" + txn.status);
  await page.screenshot({ path: path.join(OUT, "04_purchase_pending_payment.png") });

  // ---------- Step 2: simulate signed PayOS webhook -> payment registered ----------
  const dataForWebhook = {
    orderCode: Number(orderCode),
    amount: Number(txn.amount),
    description: txn.note || "iPARK RFID",
    accountNumber: "10142609160919728",
    reference: "ADD02_TEST",
    transactionDateTime: new Date().toISOString(),
    paymentLinkId: String(orderCode),
    code: "00",
    desc: "thanh toan thanh cong",
    counterAccountBankId: "",
    counterAccountBankName: "",
    counterAccountName: "",
    counterAccountNumber: "",
    virtualAccountName: "",
    virtualAccountNumber: "",
  };
  const signature = signWebhook(dataForWebhook);
  const webhookBody = { code: "00", success: true, desc: "thanh toan thanh cong", signature, data: dataForWebhook };
  const webhookRes = await fetch("http://127.0.0.1:4000/api/payos/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(webhookBody),
  });
  const webhookText = await webhookRes.text();
  log("webhook -> " + webhookRes.status + " " + webhookText);

  // ---------- Step 3: customer page shows payment success ----------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "05_after_webhook_waiting_issuance.png") });
  const waiting = await page.locator("text=/Thanh toán thành công|Đã thanh toán|chờ gắn RFID/i").count();
  log("customer page shows payment-success text: " + waiting);

  // ---------- Step 4: admin reviews + assigns card ----------
  const adminPage = await ctx.newPage();
  await adminPage.goto(BASE + "/login", { waitUntil: "networkidle" });
  await adminPage.fill('input[name="email"]', ADMIN.email);
  await adminPage.fill('input[name="password"]', ADMIN.password);
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/overview", { timeout: 30000 });
  log("admin logged in");

  await adminPage.goto(BASE + "/rfid", { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(2500);
  await adminPage.screenshot({ path: path.join(OUT, "06_admin_rfid_purchase_requests.png") });

  const reqCard = adminPage.locator("div", { hasText: PLATE }).filter({ has: adminPage.locator("text=/Yêu cầu mua|Duyệt yêu cầu|Cấp và gắn thẻ|Đã thanh toán/i") }).first();
  const approveBtn = adminPage.locator('button:has-text("Duyệt yêu cầu")').first();
  if ((await approveBtn.count()) > 0) {
    await approveBtn.click();
    await adminPage.waitForTimeout(2500);
    log("approved purchase request");
  } else {
    log("WARN: no approve button visible");
  }
  await adminPage.screenshot({ path: path.join(OUT, "07_admin_after_approve.png") });

  const uidSelect = adminPage.locator('select[aria-label="Chọn thẻ RFID còn trống trong kho"]').first();
  if ((await uidSelect.count()) > 0) {
    const options = await uidSelect.locator("option").evaluateAll((els) => els.map((e) => ({ value: e.value, text: e.textContent })));
    const pick = options.find((o) => o.value && o.value !== "");
    log("inventory options: " + JSON.stringify(options.map((o) => o.value)));
    if (pick) {
      await uidSelect.selectOption(pick.value);
      assignedUid = pick.value;
      await adminPage.waitForTimeout(800);
    }
  }
  const assignBtn = adminPage.locator('button:has-text("Cấp và gắn thẻ")').first();
  if ((await assignBtn.count()) > 0) {
    await assignBtn.click();
    await adminPage.waitForTimeout(3000);
    const assignMsg = await adminPage.locator(".action-log").first().textContent().catch(() => "");
    log("assign UI message: " + String(assignMsg).slice(0, 150));
  }
  await adminPage.screenshot({ path: path.join(OUT, "08_admin_assign_card.png") });

  const adminCookies = await ctx.cookies();
  const adminCookieStr = adminCookies.map((c) => c.name + "=" + c.value).join("; ");
  await adminPage.reload({ waitUntil: "networkidle" });
  await adminPage.waitForTimeout(2500);
  await adminPage.screenshot({ path: path.join(OUT, "09_admin_after_assign.png") });

  // ---------- Step 5: verify card active + financial log ----------
  const finalReq = await fetch(API + "/rfid/purchase-requests/mine", { headers: { cookie: cookieStr } }).then((r) => r.json());
  const done = (finalReq.requests || []).find((r) => r.id === purchaseRequestId);
  log("final request status=" + done && done.status + " card=" + JSON.stringify(done && done.card));

  let cardStatus = null, cardPlate = null;
  if (!assignedUid) {
    const mine2 = await fetch(API + "/rfid/purchase-requests/mine", { headers: { cookie: cookieStr } }).then((r) => r.json());
    const doneReq2 = (mine2.requests || []).find((r) => r.id === purchaseRequestId);
    assignedUid = doneReq2 && doneReq2.card ? doneReq2.card.uid : null;
    log("resolved assigned UID from request: " + assignedUid);
  }
  if (assignedUid) {
    const cardDoc = await fetch(API + "/rfid/by-uid/" + assignedUid, { headers: { cookie: adminCookieStr } }).then((r) => r.json());
    cardStatus = cardDoc.card ? cardDoc.card.status : cardDoc.status;
    cardPlate = cardDoc.card ? cardDoc.card.plate : cardDoc.plate;
    log("card " + assignedUid + " status=" + cardStatus + " plate=" + cardPlate);
  }

  await page.bringToFront();
  await page.goto(BASE + "/rfid-registration", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "10_customer_card_active.png") });

  const txnList = await fetch(API + "/transactions?limit=50", { headers: { cookie: adminCookieStr } }).then((r) => r.json());
  const rows = txnList.transactions || txnList.items || txnList.data || [];
  const saleRow = rows.find((t) => String(t._id || t.id) === String(transactionId));
  log("financial log: type=" + (saleRow && saleRow.transactionType) + " status=" + (saleRow && saleRow.status) + " amount=" + (saleRow && saleRow.amount) + " uid=" + (saleRow && saleRow.uid));

  await adminPage.goto(BASE + "/transactions", { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(2500);
  await adminPage.screenshot({ path: path.join(OUT, "11_admin_transactions_log.png") });

  await adminPage.goto(BASE + "/rfid-reports", { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(2500);
  await adminPage.screenshot({ path: path.join(OUT, "12_admin_rfid_reports.png") });

  await adminPage.goto(BASE + "/rfid", { waitUntil: "networkidle" });
  await adminPage.waitForTimeout(2000);
  if (assignedUid) {
    const histBtn = adminPage.locator("button.uid-pill", { hasText: assignedUid }).first();
    if ((await histBtn.count()) > 0) {
      await histBtn.click();
      await adminPage.waitForTimeout(2500);
      await adminPage.screenshot({ path: path.join(OUT, "13_card_history_audit.png") });
    }
  }

  // ---------- verdict ----------
  const ok = done && done.status === "completed" && cardStatus === "active" && saleRow && saleRow.status === "paid";
  log("api_failures: " + JSON.stringify(apiFail.slice(0, 5)));
  log(ok ? "RESULT: PASS" : "RESULT: FAIL");
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({
    result: ok ? "PASS" : "FAIL",
    purchaseRequestId, transactionId, orderCode, assignedUid,
    requestStatus: done && done.status, cardStatus, cardPlate,
    transactionStatus: saleRow && saleRow.status, amount: saleRow && saleRow.amount,
    apiFailures: apiFail.slice(0, 5),
  }, null, 2));

  await ctx.close();
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("[add02] FATAL", e); process.exit(2); });
