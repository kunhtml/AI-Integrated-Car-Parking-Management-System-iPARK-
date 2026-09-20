// MBR_02 v2 — inject session cookie from API login, then open /staff-desk.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const API = "http://localhost:4000/api";
const STAFF = { email: "nv.1@ipark.vn", password: "123456" };
const PLATE = "30E92291";
const OUT = "evidence/mbr02";
mkdirSync(OUT, { recursive: true });

const results = {
  testCase: "MBR_02",
  title: "Expired subscription at exit gate",
  executedAt: new Date().toISOString(),
  environment: { frontend: BASE, plate: PLATE },
  steps: [],
};

try {
  // 1. API login → cookie
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(STAFF),
  });
  if (!loginRes.ok) throw new Error(`login failed ${loginRes.status}`);
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookiePart = setCookie.split(";")[0];
  const [name, value] = cookiePart.split("=");
  console.log("login ok, cookie:", name);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name, value, domain: "localhost", path: "/" },
  ]);
  const page = await context.newPage();

  // 2. Staff desk — exit card restores from /exit/pending
  await page.goto(`${BASE}/staff-desk`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const paymentLabelEl = page
    .locator(".staff-desk__exit-field")
    .filter({ has: page.locator(".staff-desk__exit-label", { hasText: "Trạng thái thanh toán" }) })
    .locator(".staff-desk__exit-status");
  await paymentLabelEl.waitFor({ state: "visible", timeout: 15000 });
  const paymentLabel = ((await paymentLabelEl.textContent()) ?? "").trim();
  const paymentClass = (await paymentLabelEl.getAttribute("class")) ?? "";

  const feeEl = page
    .locator(".staff-desk__exit-field")
    .filter({ has: page.locator(".staff-desk__exit-label", { hasText: "Phí phiên gửi xe" }) })
    .locator("strong");
  const feeLabel = ((await feeEl.textContent()) ?? "").trim();

  const plateText =
    ((await page.locator(".staff-desk__exit-plate").first().textContent()) ?? "").trim();

  console.log("plate:", JSON.stringify(plateText));
  console.log("payment label:", JSON.stringify(paymentLabel));
  console.log("payment class:", paymentClass);
  console.log("fee label:", JSON.stringify(feeLabel));

  await page.screenshot({ path: `${OUT}/02_expired_subscription_exit_card.png` });

  const labelOk = paymentLabel === "Gói đăng ký hết hạn";
  const toneOk = paymentClass.includes("staff-desk__exit-status--warn");
  const feeOk = feeLabel.includes("10.000");
  const plateOk = plateText.includes(PLATE);

  results.steps.push(
    { step: 1, action: "Staff desk restores pending exit session for expired-subscription member", expected: `Plate ${PLATE}`, result: plateOk ? "PASS" : "FAIL" },
    { step: 2, action: "Payment status reflects lapsed package", expected: "Gói đăng ký hết hạn", result: labelOk ? "PASS" : `FAIL (got ${paymentLabel})` },
    { step: 3, action: "Payment status uses warning tone", expected: "--warn", result: toneOk ? "PASS" : `FAIL (got ${paymentClass})` },
    { step: 4, action: "Session fee still charged", expected: "10.000đ", result: feeOk ? "PASS" : `FAIL (got ${feeLabel})` },
  );
  results.overallResult = [plateOk, labelOk, toneOk, feeOk].every(Boolean) ? "PASS" : "FAIL";
  await browser.close();
} catch (err) {
  console.error("ERROR", err);
  results.overallResult = "FAIL";
  results.error = err.message;
}

writeFileSync(`${OUT}/result.json`, JSON.stringify(results, null, 2), "utf8");
console.log("overall:", results.overallResult);
