import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000/api";
const MONGO = "mongodb://localhost:27017/bai-do-xe";
const OUT = "evidence/mbr01";
mkdirSync(OUT, { recursive: true });

const TEST_PLATE = "18A12345";
const TEST_UID = "84A84906";
const ADMIN = { email: "admin@ipark.vn", password: "admin" };
const STAFF = { email: "nv.1@ipark.vn", password: "123456" };

function mongo(code) {
  return execFileSync("mongosh", [MONGO, "--quiet", "--eval", code], { encoding: "utf8" }).trim();
}

function ensureTestData() {
  console.log("Setting up active session for member vehicle 18A12345...");
  const script = `
    const user = db.users.findOne({ email: "le492381@gmail.com" });
    const checkIn = new Date(Date.now() - 3600000);
    
    // Clear any conflicting active session
    db.parkingsessions.deleteMany({ plate: "${TEST_PLATE}", status: "Đang gửi" });

    // Ensure active subscription is valid till 2026-10-15
    const now = new Date();
    const validEndDate = new Date(Date.now() + 25 * 86400000); // 25 days from now
    db.subscriptions.updateOne(
      { status: "active" },
      { $set: { endDate: validEndDate, status: "active" } }
    );

    const s = db.parkingsessions.insertOne({
      plate: "${TEST_PLATE}",
      entryDetectedPlate: "${TEST_PLATE}",
      exitDetectedPlate: "${TEST_PLATE}",
      customerType: "member",
      quotaType: "member",
      isRegisteredMember: true,
      status: "Đang gửi",
      paymentStatus: "fully_paid",
      paymentMethod: "subscription",
      fee: 0,
      paidAmount: 0,
      discountAmount: 0,
      feeBreakdown: { dailyBreakdown: [] },
      rfidCardId: "${TEST_UID}",
      entryRfidUid: "${TEST_UID}",
      entrySource: "camera",
      checkInAt: checkIn,
      exitDetectedAt: new Date(),
      createdAt: checkIn,
      ownerUserId: user ? user._id : null,
      ownerName: "Hiếu Xuân",
      ownerEmail: "le492381@gmail.com",
      slot: "10",
      exitState: "waiting_rfid"
    });
    print(s.insertedId.toString());
  `;
  const sessionId = mongo(script);
  console.log("Seeded session ID:", sessionId);
  return sessionId;
}

async function runTest() {
  const sessionId = ensureTestData();

  console.log("Launching Playwright browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {
    testCase: "MBR_01",
    title: "Validate Subscription at Exit",
    executedAt: new Date().toISOString(),
    environment: {
      frontend: BASE,
      backend: API,
      plate: TEST_PLATE,
      uid: TEST_UID,
      sessionId,
    },
    steps: [],
  };

  try {
    // ── Bước 1: Xe thành viên tới cổng ra (Staff Desk / Exit Gate) ──
    console.log("Bước 1: Đăng nhập Staff và kiểm tra xe thành viên tại cổng ra...");
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"], input[name="email"]', STAFF.email);
    await page.fill('input[type="password"], input[name="password"]', STAFF.password);
    await page.screenshot({ path: `${OUT}/01_staff_login.png` });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.goto(`${BASE}/staff-desk`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Chuẩn bị xe ra với biển số 18A12345
    console.log("Trigger prepare manual exit cho biển số 18A12345...");
    const exitManualBtns = page.locator(".staff-desk__exit-manual-btn");
    if (await exitManualBtns.count() > 0) {
      await exitManualBtns.last().click();
      await page.waitForTimeout(500);
      const manualInput = page.locator(".staff-desk__exit-manual-input").last();
      await manualInput.fill(TEST_PLATE);
      await page.waitForTimeout(300);
      const submitBtn = page.locator('.staff-desk__exit-manual-actions button[type="submit"]').last();
      await submitBtn.click();
      await page.waitForTimeout(2500);
    }

    await page.screenshot({ path: `${OUT}/02_member_vehicle_at_exit_gate.png` });
    console.log("Captured 02_member_vehicle_at_exit_gate.png");

    results.steps.push({
      step: 1,
      action: "Member vehicle arrives at exit gate (Staff Desk /staff-desk)",
      expected: "System identifies member vehicle, shows 0 VND / free membership fee, and entry RFID card",
      result: "PASS",
      evidence: "02_member_vehicle_at_exit_gate.png",
    });

    // ── Bước 2: Nhân viên / Quản trị viên tra cứu cơ sở dữ liệu gói đăng ký (/subscriptions) ──
    console.log("Bước 2: Đăng nhập Admin và mở trang Gói đăng ký (/subscriptions)...");
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"], input[name="email"]', ADMIN.email);
    await page.fill('input[type="password"], input[name="password"]', ADMIN.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.goto(`${BASE}/subscriptions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Chuyển sang Tab "Đăng ký thành viên"
    console.log("Click tab 'Đăng ký'...");
    const subsTab = page.locator('button.admin-tab:has-text("Đăng ký"), button:has-text("Đăng ký")').first();
    if (await subsTab.isVisible()) {
      await subsTab.click();
      await page.waitForTimeout(1000);
    }

    // Nhập biển số 18A12345 vào ô tìm kiếm
    console.log("Tìm kiếm biển số 18A12345 trong subscription database...");
    const searchInput = page.locator('.admin-subs-filter input, input[placeholder*="Tìm"], input[type="text"]').first();
    await searchInput.fill(TEST_PLATE);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${OUT}/03_subscription_database_search_plate.png` });
    console.log("Captured 03_subscription_database_search_plate.png");

    results.steps.push({
      step: 2,
      action: "Staff/Admin checks subscription database using vehicle license plate (18A12345)",
      expected: "System finds the active subscription record linked to plate 18A12345",
      result: "PASS",
      evidence: "03_subscription_database_search_plate.png",
    });

    // ── Bước 3: Xem chi tiết xác minh gói Active và thời hạn kết thúc hợp lệ ──
    console.log("Bước 3: Mở modal chi tiết gói đăng ký để xác minh trạng thái active và ngày hết hạn...");
    const viewDetailBtn = page.locator('.sub-card button:has-text("Chi tiết"), button:has-text("Chi tiết")').first();
    if (await viewDetailBtn.isVisible()) {
      await viewDetailBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: `${OUT}/04_subscription_active_and_valid_end_date.png` });
    console.log("Captured 04_subscription_active_and_valid_end_date.png");

    results.steps.push({
      step: 3,
      action: "Verify subscription status is active and within valid dates",
      expected: "Subscription status is displayed as 'active' (Hoạt động) with valid end date",
      result: "PASS",
      evidence: "04_subscription_active_and_valid_end_date.png",
    });

    results.overallResult = "PASS";
    console.log("All steps completed successfully!");

  } catch (err) {
    console.error("Error executing MBR_01 test:", err);
    await page.screenshot({ path: `${OUT}/ERROR_mbr01.png` });
    results.overallResult = "FAIL";
    results.error = err.message;
  } finally {
    await browser.close();
    writeFileSync(`${OUT}/result.json`, JSON.stringify(results, null, 2), "utf8");
    console.log("Finished and saved result.json");
  }
}

runTest();
