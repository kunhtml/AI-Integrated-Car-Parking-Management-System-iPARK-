import { redirect } from "next/navigation";

// Cấu hình sức chứa đã được gộp vào trang /parking-slots (phân loại cư dân / vãng lai / chung
// trực tiếp trên từng ô). Route cũ được redirect về đó để tránh link hỏng.
export default function CapacityConfigPage() {
  redirect("/parking-slots");
}
