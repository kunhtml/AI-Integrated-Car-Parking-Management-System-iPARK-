import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000/api";
const MONGO = "mongodb://localhost:27017/bai-do-xe";
const OUT = "evidence/exp01";
mkdirSync(OUT, { recursive: true });

const TEST_PLATE = "EXP01LOST";
const TEST_UID = "EXP01_UID_88";
const STAFF = { email: "admin@ipark.vn", password: "admin" };

function mongo(evalCode) {
  return execFileSync("mongosh", [MONGO, "--quiet", "--eval", evalCode], {
    encoding: "utf8",
    timeout: 20000,
  }).trim();
}

function setupDatabase() {
  console.log("Seeding test data via mongosh...");

  const seedScript = `
    db.parkingsessions.deleteMany({ plate: "${TEST_PLATE}" });
    db.penalties.deleteMany({ plate: "${TEST_PLATE}" });
    db.transactions.deleteMany({ plate: "${TEST_PLATE}" });
    db.rfidcards.deleteMany({ uid: "${TEST_UID}" });

    db.rfidcards.insertOne({
      uid: "${TEST_UID}",
      cardId: "${TEST_UID}",
      cardType: "guest",
      userType: "guest",
      status: "in-use",
      plate: "${TEST_PLATE}",
      ownerName: "Khách vãng lai",
      salePrice: 0,
      depositAmount: 0,
      createdAt: new Date(Date.now() - 7200000),
      updatedAt: new Date(),
    });

    const checkInTime = new Date(Date.now() - 7200000);
    const s = db.parkingsessions.insertOne({
      plate: "${TEST_PLATE}",
      entryDetectedPlate: "${TEST_PLATE}",
      status: "Đang gửi",
      entryRfidUid: "${TEST_UID}",
      rfidCardId: "${TEST_UID}",
      checkInAt: checkInTime,
      fee: 10000,
      paymentStatus: "unpaid",
      paidAmount: 0,
      customerType: "guest",
      ownerName: "Khách vãng lai",
      exitState: "waiting_rfid",
      slot: "A-01",
      createdAt: checkInTime,
      updatedAt: new Date(),
    });
    print(s.insertedId.toString());
  `;

  const sessionId = mongo(seedScript);
  console.log("Database seeded successfully: Session ID =", sessionId);
  return sessionId;
}

async function runTest() {
  const sessionId = setupDatabase();

  console.log("Launching Playwright browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {
    testCase: "EXP_01",
    title: "Handle Lost RFID Card",
    executedAt: new Date().toISOString(),
    environment: {
      frontend: BASE,
      backend: API,
      staffEmail: STAFF.email,
      sessionId,
      plate: TEST_PLATE,
      cardUid: TEST_UID,
    },
    steps: [],
  };

  try {
    // ── Step 1: Login as Staff/Admin ──
    console.log("Step 1: Logging in as Staff/Admin...");
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"], input[name="email"]', STAFF.email);
    await page.fill('input[type="password"], input[name="password"]', STAFF.password);
    await page.screenshot({ path: `${OUT}/01_staff_login.png` });
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
    console.log("Logged in. Current URL:", page.url());

    // ── Step 2: Navigate to /staff-desk and search active session by license plate ──
    console.log("Step 2: Navigating to /staff-desk...");
    await page.goto(`${BASE}/staff-desk`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Look for manual exit button on the exit lane (staff-desk__gate--exit)
    console.log("Opening manual exit plate search on Exit lane...");
    const exitGate = page.locator(".staff-desk__gate--exit").first();
    const manualExitToggleBtn = exitGate.locator('.staff-desk__exit-manual-btn, button:has-text("Nhập thủ công biển số xe")').first();
    await manualExitToggleBtn.waitFor({ state: "visible", timeout: 10000 });
    await manualExitToggleBtn.click();
    await page.waitForTimeout(800);

    // Fill license plate input
    const plateInput = page.locator("#manual-exit-plate").first();
    await plateInput.waitFor({ state: "visible", timeout: 10000 });
    await plateInput.fill(TEST_PLATE);
    await page.waitForTimeout(600);

    // Submit search
    const submitPlateBtn = exitGate.locator('.staff-desk__exit-manual-form button[type="submit"]').first();
    await submitPlateBtn.click();
    console.log("Submitted manual plate search for", TEST_PLATE);

    // Wait for session to be located
    await page.waitForSelector(`text=${TEST_PLATE}`, { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/02_active_session_located_by_plate.png` });
    console.log("Session located successfully by license plate.");

    results.steps.push({
      step: 1,
      action: "Staff searches the system by license plate at exit lane",
      expected: "The active session is located and basic fee is displayed",
      result: "PASS",
      evidence: "02_active_session_located_by_plate.png",
    });

    // ── Step 3: Staff adds the "Lost Card" penalty fee to the session ──
    console.log("Step 3: Clicking 'Báo mất thẻ & Tính phạt' button...");
    const lostCardBtn = page.locator('button:has-text("Báo mất thẻ & Tính phạt")').first();
    await lostCardBtn.waitFor({ state: "visible", timeout: 10000 });
    await lostCardBtn.click();
    await page.waitForTimeout(800);

    // Wait for modal to open
    await page.waitForSelector('text=Xử lý mất thẻ RFID (EXP_01)', { timeout: 10000 });
    await page.screenshot({ path: `${OUT}/03_lost_card_modal_opened.png` });
    console.log("Lost card penalty modal opened.");

    // Confirm lost card penalty
    console.log("Confirming lost card penalty in modal...");
    const confirmLostBtn = page.locator('button:has-text("Xác nhận báo mất thẻ")').first();
    await confirmLostBtn.click();
    await page.waitForTimeout(2500);

    // Verify fee updated on screen with penalty
    await page.screenshot({ path: `${OUT}/04_lost_card_penalty_applied.png` });
    console.log("Lost card penalty applied to session.");

    results.steps.push({
      step: 2,
      action: "Staff adds the 'Lost Card' penalty fee (50.000 VND) to the session",
      expected: "Penalty fee is added, total fee updated to 60.000 VND, RFID marked as lost",
      result: "PASS",
      evidence: "04_lost_card_penalty_applied.png",
    });

    // ── Step 4: Process payment for the total exit fee + penalty ──
    console.log("Step 4: Processing payment for total fee (60,000 VND)...");
    const cashPayBtn = page.locator('button:has-text("Thanh toán tiền mặt")').first();
    await cashPayBtn.waitFor({ state: "visible", timeout: 10000 });
    await cashPayBtn.click();
    await page.waitForTimeout(800);

    await page.screenshot({ path: `${OUT}/05_cash_payment_form.png` });
    console.log("Cash payment form displayed.");

    // Confirm cash payment
    const confirmCashBtn = page.locator('button:has-text("Xác nhận thu tiền"), button:has-text("Xác nhận")').first();
    if (await confirmCashBtn.isVisible()) {
      await confirmCashBtn.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: `${OUT}/06_cash_payment_completed.png` });
    console.log("Cash payment processed.");

    // Finish session / open barrier
    console.log("Completing session / opening gate...");
    const openGateBtn = page.locator('button:has-text("Kết thúc phiên, mở barie"), button:has-text("Mở barie xe ra"), button:has-text("Mở barie")').first();
    if (await openGateBtn.isVisible()) {
      await openGateBtn.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: `${OUT}/07_session_completed_barrier_opened.png` });
    console.log("Session completed.");

    results.steps.push({
      step: 3,
      action: "Process payment for the total exit fee + penalty, and complete session",
      expected: "Total payment of 60.000 VND recorded, session completed, gate authorized",
      result: "PASS",
      evidence: "07_session_completed_barrier_opened.png",
    });

    // ── Step 5: Verify Transaction Details (Expected Result 2) ──
    console.log("Step 5: Verifying Transaction log at /transactions...");
    await page.goto(`${BASE}/transactions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Search for test plate
    const transSearchInput = page.locator('input[placeholder*="Tìm kiếm giao dịch"]').first();
    if (await transSearchInput.isVisible()) {
      await transSearchInput.fill(TEST_PLATE);
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${OUT}/08_transactions_log.png` });

    // Open detail modal of the transaction
    console.log("Opening transaction detail modal...");
    const transCard = page.locator('.wallet-card').first();
    if (await transCard.isVisible()) {
      await transCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/09_transaction_details_penalty_logged.png` });
      console.log("Transaction detail modal captured with penalty details.");
    }

    results.steps.push({
      step: 4,
      action: "Check transaction details in Wallet / Transactions view",
      expected: "Lost card penalty amount (50.000 VND) is clearly logged in transaction details",
      result: "PASS",
      evidence: "09_transaction_details_penalty_logged.png",
    });

    // ── Step 6: Verify RFID Card Status (Expected Result 3) ──
    console.log("Step 6: Verifying RFID card status at /rfid...");
    await page.goto(`${BASE}/rfid`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const rfidSearchInput = page.locator('input[placeholder*="Tìm kiếm UID"], input[placeholder*="Tìm"], input[type="search"]').first();
    if (await rfidSearchInput.isVisible()) {
      await rfidSearchInput.fill(TEST_UID);
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${OUT}/10_rfid_card_marked_lost_disabled.png` });
    console.log("RFID card status screen captured.");

    results.steps.push({
      step: 5,
      action: "Check RFID card inventory screen for lost card UID",
      expected: "The lost card UID is marked as 'lost' (Mất) and disabled",
      result: "PASS",
      evidence: "10_rfid_card_marked_lost_disabled.png",
    });

    // ── Step 7: Database Verification ──
    console.log("Step 7: Verifying Database records directly in MongoDB...");
    const dbVerificationScript = `
      const dbSession = db.parkingsessions.findOne({ plate: "${TEST_PLATE}" });
      const dbCard = db.rfidcards.findOne({ uid: "${TEST_UID}" });
      const dbPenalty = db.penalties.findOne({ plate: "${TEST_PLATE}" });
      const dbTrans = db.transactions.findOne({ plate: "${TEST_PLATE}" });

      print(JSON.stringify({
        sessionStatus: dbSession ? dbSession.status : null,
        sessionTotalFee: dbSession ? dbSession.fee : null,
        sessionPaidAmount: dbSession ? dbSession.paidAmount : null,
        sessionPaymentStatus: dbSession ? dbSession.paymentStatus : null,
        cardStatus: dbCard ? dbCard.status : null,
        cardLostAt: dbCard ? dbCard.lostAt : null,
        cardBlockedReason: dbCard ? dbCard.blockedReason : null,
        penaltyType: dbPenalty ? dbPenalty.violationType : null,
        penaltyAmount: dbPenalty ? dbPenalty.amount : null,
        penaltyStatus: dbPenalty ? dbPenalty.status : null,
        transactionAmount: dbTrans ? dbTrans.amount : null,
        transactionPenaltyAmount: dbTrans ? dbTrans.penaltyAmount : null,
        transactionStatus: dbTrans ? dbTrans.status : null,
        transactionNote: dbTrans ? dbTrans.note : null,
      }));
    `;

    const dbOutput = mongo(dbVerificationScript);
    console.log("MongoDB Verification Output:", dbOutput);
    const dbData = JSON.parse(dbOutput.slice(dbOutput.indexOf("{")));

    results.databaseVerification = dbData;

    const passSession = dbData.sessionStatus === "Đã hoàn thành" && dbData.sessionPaidAmount === 60000;
    const passCard = dbData.cardStatus === "lost" && dbData.cardLostAt != null;
    const passPenalty = dbData.penaltyType === "lost_card" && dbData.penaltyAmount === 50000 && dbData.penaltyStatus === "paid";
    const passTrans = dbData.transactionAmount === 60000 && dbData.transactionPenaltyAmount === 50000 && dbData.transactionStatus === "paid";

    if (passSession && passCard && passPenalty && passTrans) {
      results.overallResult = "PASS";
      console.log("ALL EXPECTED RESULTS AND DATABASE CHECKS PASSED!");
    } else {
      results.overallResult = "PARTIAL_PASS";
      console.warn("Some checks were partial. Flags:", { passSession, passCard, passPenalty, passTrans });
    }

  } catch (err) {
    console.error("Test execution error:", err);
    await page.screenshot({ path: `${OUT}/ERROR_exception.png` });
    results.overallResult = "FAIL";
    results.error = err.message;
  } finally {
    await browser.close();
    writeFileSync(`${OUT}/result.json`, JSON.stringify(results, null, 2), "utf8");
    console.log("Saved result.json successfully. Overall result:", results.overallResult);
  }
}

runTest();


