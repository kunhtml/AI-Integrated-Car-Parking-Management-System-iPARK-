import { expect, test } from "@playwright/test";

test.describe("public navigation", () => {
  test("home page exposes the main navigation and login action", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("main#main-content, main").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /đăng nhập/i }).first()).toBeVisible();
  });

  test("login page exposes labeled credentials fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
    await expect(page.getByLabel("Mật khẩu")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  test("login page displays an API error without leaving the page", async ({ page }) => {
    await page.route("**/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email hoặc mật khẩu không đúng." }),
      });
    });
    await page.goto("/login");

    await page.getByLabel("Email").fill("invalid@example.com");
    await page.getByLabel("Mật khẩu").fill("wrong-password");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByText("Email hoặc mật khẩu không đúng.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
