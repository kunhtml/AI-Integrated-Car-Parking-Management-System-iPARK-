export const parkingConfig = {
  totalCapacity: 30,
  // Dynamic model: Ngưỡng an toàn để ưu tiên vé tháng
  // Khi remaining <= safetyThreshold → chỉ cho thành viên active vào (block vãng lai)
  safetyThreshold: 5, // Ví dụ: còn 5 chỗ thì khóa khách vãng lai
  useDynamicPriority: true, // true = Dynamic (khuyến nghị), false = Reserved (cố định slot)
  reservedForMembers: 0, // Nếu >0 thì dùng Reserved mode (ví dụ 10/30 slot dành riêng cho member)
};

export function allocateCarSlot(activeCount: number) {
  const slotNumber = activeCount + 1;
  const row = String.fromCharCode(65 + Math.floor((slotNumber - 1) / 10));
  const column = String(((slotNumber - 1) % 10) + 1).padStart(2, "0");
  return `${row}-${column}`;
}

/**
 * Kiểm tra xem xe có được vào bãi không theo mô hình Dynamic/Reserved
 * Ưu tiên thành viên active (membershipActive = true)
 */
export async function canEnterParking(
  isMemberActive: boolean,
  currentActiveCount: number
): Promise<{ allowed: boolean; reason?: string; mode: 'dynamic' | 'reserved' }> {
  const { totalCapacity, safetyThreshold, useDynamicPriority, reservedForMembers } = parkingConfig;
  const remaining = totalCapacity - currentActiveCount;

  // Mode Reserved: giữ slot cố định cho member
  if (!useDynamicPriority && reservedForMembers > 0) {
    const maxWalkIn = totalCapacity - reservedForMembers;
    if (isMemberActive) {
      return { allowed: currentActiveCount < totalCapacity, reason: undefined, mode: 'reserved' };
    } else {
      return {
        allowed: currentActiveCount < maxWalkIn,
        reason: currentActiveCount >= maxWalkIn ? `Bãi đã dành ${reservedForMembers} chỗ cho vé tháng. Chỉ còn ${maxWalkIn} cho vãng lai.` : undefined,
        mode: 'reserved'
      };
    }
  }

  // Mode Dynamic (khuyến nghị): chặn vãng lai khi chạm ngưỡng an toàn
  if (isMemberActive) {
    // Thành viên active luôn được vào nếu còn chỗ (hoặc full nếu overbook sau này)
    return { allowed: currentActiveCount < totalCapacity, reason: undefined, mode: 'dynamic' };
  } else {
    // Vãng lai hoặc member hết hạn: chỉ vào nếu còn > safetyThreshold chỗ
    const allowed = remaining > safetyThreshold;
    return {
      allowed,
      reason: allowed ? undefined : `Bãi gần đầy (còn ${remaining} chỗ). Chỉ ưu tiên vé tháng active.`,
      mode: 'dynamic'
    };
  }
}
