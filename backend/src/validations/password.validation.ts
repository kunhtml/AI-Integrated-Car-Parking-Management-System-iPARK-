import { z } from "zod";

/**
 * Mật khẩu mạnh:
 * - Tối thiểu 8 ký tự
 * - Ít nhất 1 chữ hoa (A-Z)
 * - Ít nhất 1 chữ thường (a-z)
 * - Ít nhất 1 chữ số (0-9)
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
  { label: "Ít nhất 8 ký tự", test: (p: string) => p.length >= 8 },
  { label: "Ít nhất 1 chữ hoa", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Ít nhất 1 chữ thường", test: (p: string) => /[a-z]/.test(p) },
  { label: "Ít nhất 1 chữ số", test: (p: string) => /[0-9]/.test(p) },
] as const;

export function passwordIssues(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map(
    (rule) => rule.label,
  );
}

export function isStrongPassword(password: string): boolean {
  return passwordIssues(password).length === 0;
}

export const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
  )
  .refine((p) => /[A-Z]/.test(p), "Mật khẩu phải có ít nhất 1 chữ hoa")
  .refine((p) => /[a-z]/.test(p), "Mật khẩu phải có ít nhất 1 chữ thường")
  .refine((p) => /[0-9]/.test(p), "Mật khẩu phải có ít nhất 1 chữ số");
