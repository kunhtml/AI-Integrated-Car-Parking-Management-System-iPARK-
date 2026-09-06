import { expect, test } from "@playwright/test";

test.describe("guest exit", () => {
  test("exposes manual plate lookup when camera is unavailable", async ({
    page,
  }) => {
    await page.goto("/guest-exit");

    // Heading + manual plate input should be present
    await expect(
      page.getByText(/thoát xe|ra bãi|khách vãng lai/i).first(),
    ).toBeVisible();
    const plateInput = page.getByPlaceholder(/nhập biển số|VD: 51/i).first();
    await expect(plateInput).toBeVisible();

    await plateInput.fill("51A-123.45");
    await expect(plateInput).toHaveValue("51A-123.45");
  });

  test("shows a connection error message when session lookup fails", async ({
    page,
  }) => {
    await page.route("**/parking-sessions/plate/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Lỗi máy chủ." }),
      });
    });

    await page.goto("/guest-exit");
    const plateInput = page.getByPlaceholder(/nhập biển số|VD: 51/i).first();
    await plateInput.fill("51A-999.99");
    await page
      .getByRole("button", { name: /tìm|tra cứu|kiểm tra/i })
      .first()
      .click();

    await expect(
      page.getByText(/lỗi|không thể|thất bại/i).first(),
    ).toBeVisible();
  });
});
