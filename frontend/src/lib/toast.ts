import Swal from "sweetalert2";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  customClass: {
    container: "ipark-toast-container",
  },
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

export function showSuccess(message: string) {
  Toast.fire({ icon: "success", title: message });
}

export function showError(message: string) {
  Toast.fire({ icon: "error", title: message });
}

export function showWarning(message: string) {
  Toast.fire({ icon: "warning", title: message });
}

export function showInfo(message: string) {
  Toast.fire({ icon: "info", title: message });
}

/**
 * Detect message type and show appropriate toast.
 * Keywords: "Đã", "thành công", "Sẵn sàng" → success
 * Keywords: "Không", "Lỗi", "lỗi", "fail" → error
 * Keywords: "Vui lòng", "cần", "chờ" → warning
 * Otherwise → info
 */
export function showAutoToast(message: string) {
  if (!message || message === "Sẵn sàng vận hành.") return;

  const lower = message.toLowerCase();
  if (
    lower.includes("đã ") ||
    lower.includes("thành công") ||
    lower.includes("đã tạo") ||
    lower.includes("đã lưu") ||
    lower.includes("đã xóa") ||
    lower.includes("đã cập nhật") ||
    lower.includes("đã gửi") ||
    lower.includes("đã nhận diện")
  ) {
    showSuccess(message);
  } else if (
    lower.includes("không ") ||
    lower.includes("lỗi") ||
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("không thể")
  ) {
    showError(message);
  } else if (
    lower.includes("vui lòng") ||
    lower.includes("cần") ||
    lower.includes("chờ") ||
    lower.includes("chưa")
  ) {
    showWarning(message);
  } else {
    showInfo(message);
  }
}

/**
 * Confirmation dialog before destructive actions.
 */
export async function confirmAction(
  title: string,
  text: string,
  confirmText: string = "Xác nhận",
): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#3b82f6",
    cancelButtonColor: "#64748b",
    confirmButtonText: confirmText,
    cancelButtonText: "Hủy",
  });
  return result.isConfirmed;
}
