import { z } from "zod";

export const registerSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự"),
      email: z.string().trim().email("Email không hợp lệ"),
      phone: z.string().trim().min(9, "Số điện thoại không hợp lệ").optional(),
      password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
      confirmPassword: z.string().min(8, "Mật khẩu xác nhận phải có ít nhất 8 ký tự"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Mật khẩu xác nhận không khớp",
      path: ["confirmPassword"],
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Email không hợp lệ"),
    password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  }),
});

export const forgotPasswordEmailSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Email không hợp lệ"),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Email không hợp lệ"),
    otp: z.string().regex(/^\d{6}$/, "OTP phải gồm 6 chữ số"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      resetToken: z.string().min(1, "Thiếu reset token"),
      newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự"),
      confirmPassword: z.string().min(8, "Mật khẩu xác nhận phải có ít nhất 8 ký tự"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Mật khẩu xác nhận không khớp",
      path: ["confirmPassword"],
    }),
});
