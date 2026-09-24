import { expect, test } from "@playwright/test";

test("slot tabs render on mobile viewport without overflow", async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "admin@ipark.vn");
  await page.fill('input[name="password"]', "admin");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/overview", { timeout: 30000 });

  await page.goto("http://localhost:3000/parking-slots", {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".quota-pool-tabs")).toBeVisible({ timeout: 30000 });

  const overflow = await page.evaluate<
    | { width: number; scrollW: number; overflows: boolean; docOverflows: boolean }
    | "missing"
  >(() => {
    const tabs = document.querySelector(".quota-pool-tabs");
    if (!tabs) return "missing";
    const r = tabs.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      scrollW: tabs.scrollWidth,
      overflows: tabs.scrollWidth > tabs.clientWidth + 1,
      docOverflows:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    };
  });
  console.log("MOBILE TABS:", JSON.stringify(overflow));
  expect(overflow).not.toBe("missing");
  expect(overflow.docOverflows).toBe(false);

  // tabs still clickable on mobile
  await page
    .locator(".quota-pool-tabs button")
    .filter({ hasText: "Vãng lai" })
    .click();
  await page.waitForTimeout(300);
  const count = await page
    .locator(".quota-slot-grid .quota-slot-tile")
    .count();
  console.log("MOBILE VÃNG LAI tiles:", count);
  expect(count).toBeGreaterThan(0);
  await page.close();
});
