// DEPRECATED: đã hợp nhất vào lib/client-api.ts.
// File này hiện chỉ còn là shim tương thích để các consumer chưa chuyển
// sang @/lib/client-api (3 view trong features/*) vẫn biên dịch bình thường.
// Khi các view đó chuyển sang @/lib/client-api thì xoá file này.
export {
  buildApiUrlWithApiBase as buildApiUrl,
  apiFetchWithApiBase as apiFetch,
} from "./client-api";
