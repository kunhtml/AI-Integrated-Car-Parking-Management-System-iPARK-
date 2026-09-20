// Debug: dump what the staff-desk page actually renders after staff login.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const STAFF = { email: "nv.1@ipark.vn", password: "123456" };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"], input[name="email"]', STAFF.email);
await page.fill('input[type="password"], input[name="password"]', STAFF.password);
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);
console.log("url after login:", page.url());

await page.goto(`${BASE}/staff-desk`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
console.log("url:", page.url());

const summary = await page.evaluate(() => {
  const text = document.body.innerText.slice(0, 2000);
  const exitConsole = !!document.querySelector(".staff-desk__exit-console");
  const sseState = document.body.innerText.match(/SSE[^\n]{0,40}/);
  return { exitConsole, sseState: sseState ? sseState[0] : null, text };
});
console.log("exitConsole present:", summary.exitConsole);
console.log("SSE state:", summary.sseState);
console.log("--- page text (first 1500 chars) ---");
console.log(summary.text.slice(0, 1500));
console.log("--- console errors ---");
console.log(consoleErrors.slice(0, 10).join("\n"));

await page.screenshot({ path: "evidence/mbr02/debug_desk.png" });
await browser.close();
