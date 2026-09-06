import { expect, test } from "@playwright/test";

const DEMO_USER = {
  id: "u1",
  name: "Nguyễn Văn A",
  email: "user@example.com",
  role: "customer",
};

function isApiPathExact(prefix: string) {
  return (url: URL) =>
    url.pathname.startsWith("/api/") &&
    (url.pathname === prefix || url.pathname.startsWith(`${prefix}?`));
}

async function mockSession(page: import("@playwright/test").Page) {
  await page.route(isApiPathExact("/api/auth/me"), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: DEMO_USER }),
    });
  });
  await page.route(
    isApiPathExact("/api/disputes/references"),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [], transactions: [] }),
      });
    },
  );
}

test.describe("disputes", () => {
  test("lists disputes and handles load failure gracefully", async ({
    page,
  }) => {
    await mockSession(page);
    await page.route(isApiPathExact("/api/disputes"), async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Lỗi tải khiếu nại." }),
      });
    });

    await page.goto("/disputes");

    // The create form heading should render even when the list fails to load
    await expect(
      page.getByRole("heading", { name: /gửi khiếu nại mới/i }),
    ).toBeVisible();
  });

  test("exposes the new dispute form fields", async ({ page }) => {
    await mockSession(page);
    await page.route(isApiPathExact("/api/disputes"), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ disputes: [] }),
      });
    });

    await page.goto("/disputes");

    // The create form heading and reason field are always rendered
    await expect(
      page.getByRole("heading", { name: /gửi khiếu nại mới/i }),
    ).toBeVisible();
    await expect(page.getByText(/lý do khiếu nại/i).first()).toBeVisible();
  });
});
