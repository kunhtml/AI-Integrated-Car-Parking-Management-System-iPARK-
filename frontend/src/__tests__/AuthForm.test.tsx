/// <reference types="jest" />
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthForm from "../components/auth/AuthForm";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock context
const mockHandleLogin = jest.fn();
const mockHandleRegister = jest.fn();
let mockAuthError = "";

jest.mock("../context/parking-app-context", () => ({
  useParkingApp: () => ({
    handleLogin: mockHandleLogin,
    handleRegister: mockHandleRegister,
    authError: mockAuthError,
  }),
}));

describe("AuthForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthError = "";
  });

  it("TC-FE-01: Render form đăng nhập mặc định", () => {
    const { container } = render(<AuthForm />);

    expect(screen.getByText("iPARK")).toBeInTheDocument();
    expect(container.querySelector('input[name="email"]')).toBeInTheDocument();
    expect(
      container.querySelector('input[name="password"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('button[type="submit"]')).toHaveTextContent(
      "Đăng nhập",
    );
    expect(
      container.querySelector('input[name="name"]'),
    ).not.toBeInTheDocument();
  });

  it("TC-FE-02: Chuyển đổi qua lại giữa Đăng nhập và Đăng ký", () => {
    const { container } = render(<AuthForm />);

    // Click tab "Đăng ký" ở trên cùng
    const registerTabBtn = screen.getByRole("button", { name: /^Đăng ký$/i });
    fireEvent.click(registerTabBtn);

    expect(container.querySelector('input[name="name"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="phone"]')).toBeInTheDocument();
    expect(
      container.querySelector('input[name="confirmPassword"]'),
    ).toBeInTheDocument();

    // Click tab "Đăng nhập" ở trên cùng
    const loginTabBtn = screen.getByRole("button", { name: /^Đăng nhập$/i });
    fireEvent.click(loginTabBtn);

    expect(
      container.querySelector('input[name="name"]'),
    ).not.toBeInTheDocument();
  });

  it("TC-FE-03: Submit form Đăng nhập thành công → redirect", async () => {
    mockHandleLogin.mockResolvedValue({ role: "customer" });
    const { container } = render(<AuthForm />);

    const emailInput = container.querySelector(
      'input[name="email"]',
    ) as HTMLInputElement;
    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement;
    const submitBtn = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    await userEvent.type(emailInput, "customer@ipark.com");
    await userEvent.type(passwordInput, "password123");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockHandleLogin).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/sessions");
    });
  });

  it("TC-FE-04: Submit form Đăng ký thành công → redirect", async () => {
    mockHandleRegister.mockResolvedValue({ role: "customer" });
    const { container } = render(<AuthForm />);

    // Chuyển sang Đăng ký
    fireEvent.click(screen.getByRole("button", { name: /^Đăng ký$/i }));

    const nameInput = container.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement;
    const phoneInput = container.querySelector(
      'input[name="phone"]',
    ) as HTMLInputElement;
    const emailInput = container.querySelector(
      'input[name="email"]',
    ) as HTMLInputElement;
    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement;
    const confirmPasswordInput = container.querySelector(
      'input[name="confirmPassword"]',
    ) as HTMLInputElement;
    const submitBtn = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    await userEvent.type(nameInput, "Nguyen Van A");
    await userEvent.type(phoneInput, "0912345678");
    await userEvent.type(emailInput, "newuser@ipark.com");
    await userEvent.type(passwordInput, "Password123!");
    await userEvent.type(confirmPasswordInput, "Password123!");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockHandleRegister).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/sessions");
    });
  });

  it("TC-FE-05: Hiển thị thông báo lỗi nếu authError tồn tại", () => {
    mockAuthError = "Email hoặc mật khẩu không đúng.";
    render(<AuthForm />);

    expect(
      screen.getByText("Email hoặc mật khẩu không đúng."),
    ).toBeInTheDocument();
  });

  it("TC-FE-06: Toggle ẩn/hiện mật khẩu", () => {
    const { container } = render(<AuthForm />);

    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement;
    const toggleBtn = screen.getByRole("button", { name: /Hiện/i });

    expect(passwordInput.type).toBe("password");

    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe("text");
    expect(screen.getByRole("button", { name: /Ẩn/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ẩn/i }));
    expect(passwordInput.type).toBe("password");
  });
});
