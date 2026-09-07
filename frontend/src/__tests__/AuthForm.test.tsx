import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../app/login/page";

const mockHandleLogin = jest.fn();
const mockHandleVerifyLoginTwoFactor = jest.fn();

// Trang login mới không tự gọi apiFetch nữa — mọi submit đi qua
// use-auth-actions handleLogin (xử lý 202/403 đúng cách).
jest.mock("@/context/parking-app-context", () => ({
  useParkingApp: () => ({
    handleLogin: mockHandleLogin,
    handleVerifyLoginTwoFactor: mockHandleVerifyLoginTwoFactor,
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the login form with accessible fields", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("routes submission through handleLogin instead of calling the API directly", async () => {
    mockHandleLogin.mockResolvedValue({ kind: "ok", user: { role: "customer" } });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "customer@ipark.com" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(mockHandleLogin).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the 2FA code step when handleLogin returns a two-factor result (HTTP 202)", async () => {
    mockHandleLogin.mockResolvedValue({
      kind: "two-factor",
      pendingTwoFactorId: "tf-123",
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@ipark.com" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    // Trước fix, 202 bị coi là thành công và chuyển thẳng /overview.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Xác minh hai yếu tố" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Mã xác minh (OTP)")).toBeInTheDocument();
  });
});
