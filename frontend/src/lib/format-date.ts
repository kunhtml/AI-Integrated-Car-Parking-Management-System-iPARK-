/**
 * Chuẩn hóa định dạng ngày tháng hiển thị toàn hệ thống iPARK: dd/mm/yyyy
 */
export function formatDisplayDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Chuẩn hóa định dạng ngày giờ hiển thị toàn hệ thống: HH:mm dd/mm/yyyy
 */
export function formatDisplayDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}
