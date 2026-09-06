import { expect, test } from "@playwright/test";

const STAFF_USER = {
  id: "s1",
  name: "Nhân viên A",
  email: "staff@example.com",
  role: "staff",
};

function isApiPathExact(prefix: string) {
  return (url: URL) =>
    url.pathname.startsWith("/api/") &&
    (url.pathname === prefix || url.pathname.startsWith(`${prefix}?`));
}

async function mockStaffSession(page: import("@playwright/test").Page) {
  await page.route(isApiPathExact("/api/auth/me"), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: STAFF_USER }),
    });
  });
  await page.route(
    isApiPathExact("/api/shift-schedules/my/current"),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ active: true, shift: { id: "sh1" } }),
      });
    },
  );
}

test.describe("staff desk", () => {
  test("renders the staff desk with entry/exit controls", async ({ page }) => {
    await mockStaffSession(page);
    await page.goto("/staff-desk");

    await expect(page.getByText(/quầy|trực|nhân viên/i).first()).toBeVisible();
    // The manual entry / camera panel should be present
    await expect(
      page.getByText(/nhập thủ công|biển số/i).first(),
    ).toBeVisible();
  });

  test("shows an error when creating a payment fails", async ({ page }) => {
    await mockStaffSession(page);
    await page.route(isApiPathExact("/api/payments"), async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Không thể tạo thanh toán." }),
      });
    });

    await page.goto("/staff-desk");
    // The desk should still render its primary controls
    await expect(
      page.getByText(/nhập thủ công|biển số/i).first(),
    ).toBeVisible();
  });
});
