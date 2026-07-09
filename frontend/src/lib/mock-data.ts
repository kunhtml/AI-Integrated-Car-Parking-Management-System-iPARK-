export type ShiftItem = {
  id: string;
  name: string;
  staff: string;
  startAt: string;
  endAt: string;
  status: string;
  note: string;
};

export const shiftRows: ShiftItem[] = [
  {
    id: "0",
    name: "Ca sáng",
    staff: "nv.1@ipark.vn",
    startAt: "06:00",
    endAt: "14:00",
    status: "Đang làm",
    note: "Ưu tiên cổng vào và hỗ trợ check-in đầu ngày.",
  },
  {
    id: "1",
    name: "Ca chiều",
    staff: "nv.2@ipark.vn",
    startAt: "14:00",
    endAt: "22:00",
    status: "Chưa bắt đầu",
    note: "Theo dõi checkout, xử lý thanh toán và bàn giao ca.",
  },
  {
    id: "2",
    name: "Ca đêm",
    staff: "nv.3@ipark.vn",
    startAt: "22:00",
    endAt: "06:00",
    status: "Chưa bắt đầu",
    note: "Giám sát an ninh, camera và các cảnh báo bất thường.",
  },
];

export function fallbackShifts(): ShiftItem[] {
  return shiftRows.map((item) => ({ ...item }));
}