import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const API = "http://localhost:4000/api";
const WEB = "http://localhost:3000";
const MONGO = "mongodb://localhost:27017/bai-do-xe";
const SHOTS = "evidence/id9";
mkdirSync(SHOTS, { recursive: true });
const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n);
const results = { steps: [] };
const TEST_EMAIL = "id9.e2e@ipark.vn";
const TEST_PW = "Id9-E2E-12345";
const VEHICLE_ID = "6aa969853f93e457683fce3a"; // 30H-678.90 (Đã đăng ký, userId=null)

function note(ok, label, extra = "") {
  results.steps.push({ ok, label, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${extra}`);
}
async function api(path, init, jar) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", cookie: jar ?? "" } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, raw: text };
}
function mongo(js) {
  return execFileSync("mongosh", [MONGO, "--quiet", "--eval", js], { encoding: "utf8", timeout: 20000 }).trim();
}
async function login(page, email, password) {
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}
function setPrice(jar, price, base) {
  return api("/pricing-config", { method: "PATCH", body: JSON.stringify({
    dayRate: base.dayRate, nightRate: base.nightRate,
    dayStartHour: base.dayStartHour, nightStartHour: base.nightStartHour,
    gracePeriod: base.gracePeriod, rfidCardSalePrice: price,
  }) }, jar);
}

// ── chuẩn bị: admin, cấu hình gốc, tài khoản test ──
const browser = await chromium.launch();
const aCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const a = await aCtx.newPage();
await login(a, "admin@ipark.vn", "admin");
const ajar = (await aCtx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const cfg0 = (await api("/pricing-config", { method: "GET" }, ajar)).json.pricingConfig;
const base = { dayRate: cfg0.dayRate, nightRate: cfg0.nightRate, dayStartHour: cfg0.dayStartHour, nightStartHour: cfg0.nightStartHour, gracePeriod: cfg0.gracePeriod };
console.log("baseline price:", cfg0.rfidCardSalePrice);

await setPrice(ajar, 50000, base); // đảm bảo giá xuất phát 50.000
await api("/users", { method: "POST", body: JSON.stringify({ name: "ID9 E2E", email: TEST_EMAIL, password: TEST_PW, role: "customer" }) }, ajar);
mongo(`db.vehicles.updateOne({_id: ObjectId("${VEHICLE_ID}")}, {$set: {userId: db.users.findOne({email: "${TEST_EMAIL}"})._id}})`);

const cCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const c = await cCtx.newPage();
await login(c, TEST_EMAIL, TEST_PW);
const cjar = (await cCtx.cookies()).map((k) => `${k.name}=${k.value}`).join("; ");

// ── 1. admin đổi giá 50.000 → 60.000 qua UI ──
await a.goto(`${WEB}/pricing`, { waitUntil: "networkidle" });
await a.waitForTimeout(900);
await a.screenshot({ path: `${SHOTS}/01-admin-config-50000.png` });
await a.getByRole("button", { name: "Chỉnh sửa" }).first().click();
await a.waitForTimeout(400);
await a.locator('input[name="rfidCardSalePrice"]').fill("60000");
await a.screenshot({ path: `${SHOTS}/02-admin-edit-60000.png` });
await a.getByRole("button", { name: "Lưu thay đổi" }).click();
let toast = null;
try { await a.waitForSelector(".ipark-toast-container", { timeout: 6000 }); toast = (await a.locator(".ipark-toast-container").innerText()).trim(); } catch (e) { toast = `<none: ${e.message}>`; }
note(!!toast && toast.includes("Đã lưu giá thẻ RFID."), 'Toast "Đã lưu giá thẻ RFID."', `text="${toast}"`);
await a.screenshot({ path: `${SHOTS}/03-admin-toast.png` });
const db60 = Number((await api("/pricing-config", { method: "GET" }, ajar)).json.pricingConfig.rfidCardSalePrice);
note(db60 === 60000, "DB ghi nhận 60.000 VND", `thực tế ${fmt(db60)}`);

// ── 2. khách thấy giá mới ──
await c.goto(`${WEB}/rfid-registration`, { waitUntil: "networkidle" });
try { await c.waitForSelector("text=Giá thẻ RFID:", { timeout: 8000 }); } catch {}
await c.waitForTimeout(700);
const cText = await c.locator("body").innerText();
note(cText.includes("Giá thẻ RFID: 60.000 VND"), "Dashboard khách hiện 60.000 VND", "");
await c.screenshot({ path: `${SHOTS}/04-customer-60000.png` });

// ── 3. mua thẻ theo giá DB = 60.000 ──
const pr60 = await api("/rfid/purchase-requests", { method: "POST", body: JSON.stringify({ vehicleId: VEHICLE_ID }) }, cjar);
note(pr60.status === 201 && Number(pr60.json?.request?.salePrice) === 60000, "Mua thẻ chốt 60.000 VND", `status=${pr60.status} salePrice=${pr60.json?.request?.salePrice}`);
await c.reload({ waitUntil: "networkidle" });
await c.waitForTimeout(900);
await c.screenshot({ path: `${SHOTS}/05-customer-purchase-60000.png` });
mongo(`db.rfidpurchaserequests.deleteOne({_id: ObjectId("${pr60.json?.request?.id}")}); db.transactions.deleteOne({_id: ObjectId("${pr60.json?.transactionId ?? "000000000000000000000000"}")})`);

// ── 4. admin hạ lại 50.000 → mua tiếp chốt 50.000 ──
await setPrice(ajar, 50000, base);
const pr50 = await api("/rfid/purchase-requests", { method: "POST", body: JSON.stringify({ vehicleId: VEHICLE_ID }) }, cjar);
note(pr50.status === 201 && Number(pr50.json?.request?.salePrice) === 50000, "Mua thẻ chốt 50.000 VND", `status=${pr50.status} salePrice=${pr50.json?.request?.salePrice}`);
await c.reload({ waitUntil: "networkidle" });
await c.waitForTimeout(700);
await c.screenshot({ path: `${SHOTS}/06-customer-purchase-50000.png` });

// ── dọn dẹp ──
mongo(`db.rfidpurchaserequests.deleteOne({_id: ObjectId("${pr50.json?.request?.id}")}); db.transactions.deleteOne({_id: ObjectId("${pr50.json?.transactionId ?? "000000000000000000000000}"})}); db.vehicles.updateOne({_id: ObjectId("${VEHICLE_ID}")}, {$unset: {userId: 1}})`);
const del = await api(`/users/${mongo(`db.users.findOne({email: "${TEST_EMAIL}"})._id.toString()`)}`, { method: "DELETE" }, ajar);
note(del.status === 200, "Xóa tài khoản test", `status=${del.status}`);
const final = Number((await api("/pricing-config", { method: "GET" }, ajar)).json.pricingConfig.rfidCardSalePrice);
note(final === 50000, "Trả giá về 50.000 VND", `thực tế ${fmt(final)}`);

writeFileSync(`${SHOTS}/result.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log("\n" + JSON.stringify(results, null, 2));
