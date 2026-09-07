/**
 * Giá mặc định cho initialPricingConfig (trước đây nằm trong lib/mock-data.ts
 * đã bị xóa — giữ lại đúng shape mà backend PricingConfig mong đợi).
 */
export const initialPricingConfig = {
  id: "default",
  dayRate: 5000,
  nightRate: 10000,
  dayStartHour: 6,
  nightStartHour: 22,
  isActive: true,
} as const;
