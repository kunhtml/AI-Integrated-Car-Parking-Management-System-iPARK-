import { expect, test } from "@playwright/test";

const API = "http://localhost:4000";

test("slot tabs: Vãng lai / Thành viên show occupied-only; Slot trống shows empty", async ({ page }) => {
  // login as admin (full-page reload to /overview on success)
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "admin@ipark.vn");
  await page.fill('input[name="password"]', "admin");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/overview", { timeout: 30000 });

  await page.goto("http://localhost:3000/parking-slots", {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".quota-pool-tabs")).toBeVisible({ timeout: 30000 });

  const tabs = page.locator(".quota-pool-tabs button");
  const labels = await tabs.allTextContents();
  console.log("TABS:", JSON.stringify(labels));
  expect(labels).toEqual(["Tất cả slot", "Thành viên", "Vãng lai", "Slot trống"]);

  // helper: count visible tiles + their statuses
  const readTiles = async () => {
    return page.locator(".quota-slot-grid .quota-slot-tile").evaluateAll((els) =>
      els.map((el) => ({
        code: el.querySelector(".quota-slot-code")?.textContent?.trim() ?? "",
        status: el.querySelector(".quota-status")?.textContent?.trim() ?? "",
      })),
    );
  };

  // baseline: Tất cả slot shows everything
  await tabs.filter({ hasText: "Tất cả slot" }).click();
  await page.waitForTimeout(300);
  const allTiles = await readTiles();
  console.log(`TẤT CẢ SLOT: ${allTiles.length} tiles`);
  expect(allTiles.length).toBeGreaterThan(0);

  // Vãng LAI -> only occupied (checked-in) walk-in slots
  await tabs.filter({ hasText: "Vãng lai" }).click();
  await page.waitForTimeout(300);
  const walkinTiles = await readTiles();
  console.log(`VÃNG LAI: ${JSON.stringify(walkinTiles)}`);
  expect(walkinTiles.length).toBeGreaterThan(0);
  for (const t of walkinTiles) {
    expect(t.status).toBe("Đang sử dụng");
  }
  await expect(page.locator(".quota-slot-unified-head h2")).toContainText(
    "vãng lai đang sử dụng",
  );
  await expect(page.locator(".quota-slot-unified-head p")).toContainText(
    "đang có xe checkin",
  );

  // THÀNH VIÊN -> only occupied (checked-in) member slots
  await tabs.filter({ hasText: "Thành viên" }).click();
  await page.waitForTimeout(300);
  const memberTiles = await readTiles();
  console.log(`THÀNH VIÊN: ${JSON.stringify(memberTiles)}`);
  for (const t of memberTiles) {
    expect(t.status).toBe("Đang sử dụng");
  }

  // SLOT TRỐNG -> only empty slots
  await tabs.filter({ hasText: "Slot trống" }).click();
  await page.waitForTimeout(300);
  const emptyTiles = await readTiles();
  console.log(`SLOT TRỐNG: ${emptyTiles.length} tiles`);
  expect(emptyTiles.length).toBeGreaterThan(0);
  for (const t of emptyTiles) {
    expect(t.status).toBe("Sẵn sàng cấp");
  }
  await expect(page.locator(".quota-slot-unified-head h2")).toContainText(
    "Slot trống",
  );

  // back to Tất cả slot restores full list
  await tabs.filter({ hasText: "Tất cả slot" }).click();
  await page.waitForTimeout(300);
  const backTiles = await readTiles();
  expect(backTiles.length).toEqual(allTiles.length);
  console.log("OK: all tabs behave as expected");
});
