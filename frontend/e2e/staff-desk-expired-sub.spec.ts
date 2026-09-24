import { expect, test } from "@playwright/test";

const PLATE = "30E92291"; // has RFID Member card, subscription expired

test("staff desk entry shows 'Gói đăng ký: Đã hết hạn' for member with lapsed sub", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "nv.1@ipark.vn");
  await page.fill('input[name="password"]', "temppass123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/overview", { timeout: 30000 });

  await page.goto("http://localhost:3000/staff-desk", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // If a check-in prompt is shown (no active shift), check in first.
  const checkInBtn = page
    .locator(".staff-desk-attendance-row button")
    .first();
  if (await checkInBtn.count().then((n) => n > 0).catch(() => false)) {
    await checkInBtn.click();
    await page.waitForTimeout(4000);
  }

  // open manual entry form (Xe vào side)
  const entryPanel = page.locator(".staff-desk__waiting--entry");
  await expect(entryPanel).toBeVisible({ timeout: 30000 });
  await entryPanel
    .locator("button")
    .filter({ hasText: "Nhập thủ công biển số xe" })
    .click();

  const input = entryPanel.locator("#manual-entry-plate");
  await expect(input).toBeVisible();
  await input.fill(PLATE);
  await entryPanel.locator("button[type=submit]").click();

  // vehicle details block appears
  const details = entryPanel.locator(".staff-desk__manual-vehicle-details");
  await expect(details).toBeVisible({ timeout: 15000 });
  const text = (await details.textContent()) ?? "";
  console.log("ENTRY DETAILS:", JSON.stringify(text.trim().replace(/\s+/g, " ")));
  expect(text).toContain(PLATE);
  expect(text).toContain("RFID Member");
  expect(text).toContain("Gói đăng ký: Đã hết hạn");
  // must NOT claim active package
  expect(text).not.toContain("Gói thành viên đang hiệu lực");
});
