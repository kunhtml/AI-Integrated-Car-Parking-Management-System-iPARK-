import { chromium } from "playwright";

const WEB = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${WEB}/login`, { waitUntil: "networkidle" });
console.log("url:", p.url());
console.log("email field visible:", await p.locator('input[type="email"]').isVisible().catch(() => "err"));
await p.fill('input[type="email"]', "kh.1@gmail.com");
await p.fill('input[type="password"]', "123456");
await p.click('button[type="submit"]');
await p.waitForTimeout(4000);
console.log("after login url:", p.url());
await p.screenshot({ path: "evidence/id9/debug-customer-login.png" });
const t = await p.locator("body").innerText();
console.log(t.slice(0, 400));
await browser.close();
