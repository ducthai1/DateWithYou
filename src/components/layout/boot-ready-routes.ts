/**
 * Màn nào tự báo "đã có gì để xem" cho tấm khởi động.
 *
 * Tách ra khỏi component vì hai bên cùng cần: tấm che đọc để biết có nên đợi
 * hay gỡ theo mốc `load`, còn `tests/unit/every-tab-reports-app-ready.test.ts`
 * đọc để bắt lỗi thêm tab mới mà quên nối tín hiệu.
 *
 * ⚠️ Phải là DANH SÁCH ROUTE, không phải cờ do màn tự bật lúc chạy. Đã thử bản
 * để màn tự khai qua `useEffect`: cờ chỉ có sau khi hydrate, mà mốc `load` tới
 * TRƯỚC hydrate trên mạng chậm, nên `/home` gỡ tấm che sớm và bài e2e "màn còn
 * khung xương thì tấm phủ vẫn che kín" đỏ ngay. Đường dẫn thì biết được từ
 * khung hình đầu tiên, không đợi ai cả.
 *
 * `/map` cố tình đứng ngoài: nó có màn chờ riêng đã dựng sẵn trong HTML đầu
 * tiên (`map-loading-veil`), không phải khung xương.
 */
export const BOOT_READY_ROUTES = [
  "/home",
  "/calendar",
  "/timeline",
  "/trips",
  "/activity",
  "/library",
  "/rides",
] as const;

export function reportsAppReady(pathname: string): boolean {
  return (BOOT_READY_ROUTES as readonly string[]).includes(pathname);
}
