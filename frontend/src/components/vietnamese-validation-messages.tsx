"use client";

import { useEffect } from "react";

type ValidatableField =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

function isField(target: EventTarget | null): target is ValidatableField {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function getValidationMessage(field: ValidatableField): string {
  const validity = field.validity;

  if (validity.valueMissing) return "Vui lòng điền vào trường này.";

  if (validity.typeMismatch) {
    if (field instanceof HTMLInputElement && field.type === "email") {
      return "Vui lòng nhập địa chỉ email hợp lệ.";
    }
    if (field instanceof HTMLInputElement && field.type === "url") {
      return "Vui lòng nhập địa chỉ URL hợp lệ.";
    }
    return "Dữ liệu không đúng định dạng yêu cầu.";
  }

  if (validity.tooShort) {
    const input = field as HTMLInputElement | HTMLTextAreaElement;
    return `Vui lòng nhập ít nhất ${input.minLength} ký tự (bạn đang nhập ${input.value.length} ký tự).`;
  }
  if (validity.tooLong) {
    const input = field as HTMLInputElement | HTMLTextAreaElement;
    return `Vui lòng nhập tối đa ${input.maxLength} ký tự (bạn đang nhập ${input.value.length} ký tự).`;
  }
  if (validity.patternMismatch)
    return "Vui lòng nhập đúng định dạng được yêu cầu.";
  if (validity.rangeUnderflow) {
    return `Giá trị phải lớn hơn hoặc bằng ${(field as HTMLInputElement).min}.`;
  }
  if (validity.rangeOverflow) {
    return `Giá trị phải nhỏ hơn hoặc bằng ${(field as HTMLInputElement).max}.`;
  }
  if (validity.stepMismatch) return "Vui lòng chọn một giá trị hợp lệ.";
  if (validity.badInput) return "Vui lòng nhập một giá trị hợp lệ.";

  return "Vui lòng kiểm tra lại thông tin này.";
}

/**
 * Trình duyệt hiển thị bubble xác thực mặc định (tiếng Anh) TRƯỚC khi sự kiện
 * `submit` được phát. Vì vậy component này:
 * 1. Bật `noValidate` cho mọi form (trừ form đã tự tắt xác thực gốc) để chặn
 *    bubble tiếng Anh mặc định.
 * 2. Trong pha capture của `submit`, tự kiểm tra validity rồi gọi
 *    `reportValidity()` để hiển thị bubble tiếng Việt; nếu form không hợp lệ
 *    thì chặn submit trước khi tới handler của React.
 * 3. Bắt sự kiện `invalid` (không bubble) làm dự phòng cho form nào lọt qua.
 * 4. Xoá custom validity khi người dùng chỉnh sửa để lỗi cũ không bị "kẹt".
 */
export function VietnameseValidationMessages() {
  useEffect(() => {
    const syncForms = (root: ParentNode) => {
      const forms: HTMLFormElement[] = [];
      if (root instanceof HTMLFormElement) forms.push(root);
      if (root instanceof Document || root instanceof Element) {
        root.querySelectorAll("form").forEach((form) => {
          if (form instanceof HTMLFormElement) forms.push(form);
        });
      }

      forms.forEach((form) => {
        // Form đã chủ động tắt xác thực gốc (noValidate) và tự kiểm tra thủ công
        // thì không can thiệp.
        if (
          form.dataset.viValidation === "1" ||
          form.hasAttribute("novalidate")
        )
          return;
        form.noValidate = true;
        form.dataset.viValidation = "1";
      });
    };

    const localize = (event: Event) => {
      const field = event.target;
      if (!isField(field) || !field.willValidate || field.validity.customError)
        return;
      field.setCustomValidity(getValidationMessage(field));
    };

    const clearCustomMessage = (event: Event) => {
      if (isField(event.target)) {
        event.target.setCustomValidity("");
      }
    };

    const interceptSubmit = (event: Event) => {
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        form.dataset.viValidation !== "1"
      )
        return;

      const fields = Array.from(form.elements)
        .filter(isField)
        .filter((field) => field.willValidate);
      fields.forEach((field) => field.setCustomValidity(""));

      const firstInvalid = fields.find((field) => !field.validity.valid);
      if (!firstInvalid) return;

      firstInvalid.setCustomValidity(getValidationMessage(firstInvalid));
      event.preventDefault();
      event.stopPropagation();
      firstInvalid.reportValidity();
    };

    syncForms(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element || node instanceof Document)
            syncForms(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("invalid", localize, true);
    document.addEventListener("input", clearCustomMessage, true);
    document.addEventListener("change", clearCustomMessage, true);
    document.addEventListener("submit", interceptSubmit, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("invalid", localize, true);
      document.removeEventListener("input", clearCustomMessage, true);
      document.removeEventListener("change", clearCustomMessage, true);
      document.removeEventListener("submit", interceptSubmit, true);
    };
  }, []);

  return null;
}
