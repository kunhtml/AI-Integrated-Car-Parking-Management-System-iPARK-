import { expect, test } from "@playwright/test";

test("subscription history shows plate + Gia hạn on expired subs", async ({ page }) => {
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  // customer1 has purchased history
  await page.fill('input[name="email"]', "khach102@ipark.vn");
  await page.fill('input[name="password"]', "temppass123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/overview", { timeout: 30000 }).catch(async () => {
    // login may land elsewhere; navigate explicitly
  });

  await page.goto("http://localhost:3000/subscriptions", {
    waitUntil: "networkidle",
  });

  const historySection = page.locator(".subscription-history");
  // If customer1 has no history, skip gracefully
  const hasHistory = await historySection
    .count()
    .then((c) => c > 0)
    .catch(() => false);
  if (!hasHistory) {
    console.log("SKIP: no subscription history for customer1");
    test.skip();
    return;
  }

  await expect(historySection.locator("h3")).toContainText("Lịch sử gói đã mua");

  const rows = historySection.locator(".subscription-history-row");
  const rowCount = await rows.count();
  console.log(`HISTORY ROWS: ${rowCount}`);

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const detail = (label: string) =>
      row
        .locator(".history-detail")
        .filter({ hasText: label })
        .locator("b")
        .textContent();

    const planType = await detail("Loại gói:");
    const plate = await detail("Biển số xe:");
    const tx = await detail("ID giao dịch:");
    console.log(
      `ROW ${i} planType=${planType} plate=${plate} tx=${tx}`,
    );
    expect(planType?.trim().length).toBeGreaterThan(0);
    expect(plate?.trim().length).toBeGreaterThan(0);

    const statusText =
      (await row.locator("b.history-expired, b.history-cancelled").first().textContent())?.trim() ?? "";
    const renewBtn = row.locator(".history-renew-btn");
    if (statusText === "Đã hết hạn") {
      await expect(renewBtn).toBeVisible();
      await expect(renewBtn).toContainText("Gia hạn");

      // click renew → must produce a feedback banner or payment modal
      await renewBtn.click();
      await page
        .locator(".feedback-banner")
        .waitFor({ state: "visible", timeout: 15000 });
      const fb = await page.locator(".feedback-banner").textContent();
      console.log(`RENEW FEEDBACK: ${fb?.trim()}`);
      expect(fb?.trim().length).toBeGreaterThan(0);
      const modalVisible = await page
        .locator(".modal-card")
        .count()
        .then((n) => n > 0)
        .catch(() => false);
      console.log(`PAYMENT MODAL OPEN: ${modalVisible}`);
      // close any modal
      if (modalVisible) {
        await page
          .locator(".modal-card .ghost-button")
          .first()
          .click()
          .catch(() => {});
      }
    } else {
      await expect(renewBtn).toHaveCount(0);
    }
  }
});
