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

export function passwordErrorMessage(password: string): string {
  const issues = passwordIssues(password);
  return issues.length > 0 ? `Mật khẩu phải có: ${issues.join(", ")}.` : "";
}
