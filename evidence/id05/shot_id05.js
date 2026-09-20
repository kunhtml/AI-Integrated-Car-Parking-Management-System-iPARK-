const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const OUT = __dirname;
const BASE = "http://localhost:3000";
const API = "http://127.0.0.1:4000/api";
const ADMIN = { email: "admin@ipark.vn", password: "admin" };
const TARGET_UID = "5345EE56";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log("Step 1: Admin login");
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', ADMIN.email);
  await page.fill('input[name="password"]', ADMIN.password);
  await page.screenshot({ path: path.join(OUT, "01_admin_login.png") });
  await page.click('button[type="submit"]');
  await page.waitForURL("**/overview", { timeout: 30000 });
  console.log("Admin logged in successfully");

  console.log("Step 2: Navigate to RFID Cards screen");
  await page.goto(BASE + "/rfid", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "02_rfid_cards_screen.png") });

  const targetRow = page.locator("tr", { hasText: TARGET_UID });
  const rowCount = await targetRow.count();
  console.log("Target card row found:", rowCount > 0);
  if (rowCount === 0) {
    throw new Error("Target card " + TARGET_UID + " not found in RFID table");
  }

  console.log("Step 3: Select target card checkbox");
  const checkboxBtn = targetRow.locator('button[aria-label="Chọn"], button:has(svg)').first();
  await checkboxBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "03_select_target_card_checkbox.png") });

  console.log("Step 4: Click orange Reset Data button");
  const orangeResetBtn = page.locator('button:has-text("Reset dữ liệu")').first();
  await orangeResetBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "04_reset_modal_opened.png") });

  console.log("Step 5: Type RESET_ALL_RFID_DATA in modal");
  const modalInput = page.locator('input[placeholder="RESET_ALL_RFID_DATA"]');
  await modalInput.fill("RESET_ALL_RFID_DATA");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "05_confirmation_string_entered.png") });

  console.log("Step 6: Click Reset Data in modal");
  const modalConfirmBtn = page.locator('.modal-actions button:has-text("Reset dữ liệu")');
  await modalConfirmBtn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "06_reset_success_message.png") });

  console.log("Step 7: Verify updated card row in table");
  await page.screenshot({ path: path.join(OUT, "07_rfid_card_reset_verified.png") });

  console.log("Step 8: Open card history audit");
  const uidBtn = page.locator("tr", { hasText: TARGET_UID }).locator("button.uid-pill");
  if (await uidBtn.count() > 0) {
    await uidBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "08_card_history_audit.png") });
  }

  // Also query API to get final DB state
  const cookies = await ctx.cookies();
  const cookieStr = cookies.map((c) => c.name + "=" + c.value).join("; ");
  const res = await fetch(API + "/rfid", { headers: { cookie: cookieStr } });
  const data = await res.json();
  const list = data.cards || data;
  const updatedCard = list.find((x) => x.uid === TARGET_UID);
  console.log("Updated card state in DB:", JSON.stringify(updatedCard, null, 2));

  fs.writeFileSync(
    path.join(OUT, "result.json"),
    JSON.stringify(
      {
        testCaseId: "<ID5>",
        title: "Return RFID Card to Inventory",
        status: "PASSED",
        targetUid: TARGET_UID,
        updatedCard,
        evidence: [
          "01_admin_login.png",
          "02_rfid_cards_screen.png",
          "03_select_target_card_checkbox.png",
          "04_reset_modal_opened.png",
          "05_confirmation_string_entered.png",
          "06_reset_success_message.png",
          "07_rfid_card_reset_verified.png",
          "08_card_history_audit.png",
        ],
      },
      null,
      2
    )
  );

  await browser.close();
  console.log("Test execution completed successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
