export const parkingConfig = {
  totalCapacity: 30,
};

export function allocateCarSlot(activeCount: number) {
  const slotNumber = activeCount + 1;
  const row = String.fromCharCode(65 + Math.floor((slotNumber - 1) / 10));
  const column = String(((slotNumber - 1) % 10) + 1).padStart(2, "0");
  return `${row}-${column}`;
}
