"use client";

import { Eye, EyeOff } from "lucide-react";
import { ChangeEvent, useState } from "react";

type PasswordInputProps = {
  name: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoFocus?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  className?: string;
};

/**
 * Ô nhập mật khẩu kèm nút bật/tắt hiển thị (mắt).
 * Dùng thay cho <input type="password"> để người dùng có thể xem lại mật khẩu.
 */
export function PasswordInput({
  name,
  placeholder,
  required,
  minLength,
  maxLength,
  autoFocus,
  defaultValue,
  value,
  onChange,
  autoComplete,
  className,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-field">
      <input
        autoComplete={autoComplete}
        className={className ? `password-input ${className}` : "password-input"}
        defaultValue={defaultValue}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        type={visible ? "text" : "password"}
        value={value}
        autoFocus={autoFocus}
      />
      <button
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        type="button"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  );
}
