import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * Tấm khởi động chỉ đợi được màn nào TỰ BÁO. Màn không báo thì nó gỡ theo mốc
 * `load` — mà `load` không đợi dữ liệu, nên người ta thấy đúng cái "khung xương
 * trắng chen giữa splash và nội dung".
 *
 * Đo thật trên `/calendar`, mạng trễ 900ms, trước khi sửa: tấm che gỡ lúc
 * 8404ms trong khi khung xương còn chiếm 6,8% màn. Sau khi sửa: 10004ms, 0%.
 *
 * Bài này gác phần dễ quên nhất — thêm một tab mới mà không nối tín hiệu. Nó
 * đọc tĩnh, không cần trình duyệt, nên chạy ở mọi lần `npm run verify`.
 */
const HOOK = "useAppReady";

/** Màn của từng tab ở thanh dưới, theo components/layout/nav-items.ts. */
const TAB_SCREENS: Record<string, string> = {
  "/home": "src/features/home/home-screen.tsx",
  "/calendar": "src/features/calendar/calendar-view.tsx",
  "/timeline": "src/features/memories/memory-timeline.tsx",
  "/trips": "src/features/trips/trip-list.tsx",
  "/activity": "src/features/activity/activity-feed.tsx",
  "/library": "src/features/library/library-page.tsx",
  "/rides": "src/features/rides/ride-history.tsx",
};

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

for (const [route, file] of Object.entries(TAB_SCREENS)) {
  test(`màn ${route} tự báo cho tấm khởi động`, () => {
    const src = read(file);
    assert.ok(src.includes(HOOK), `${file} không gọi ${HOOK} — mở app ở ${route} sẽ gỡ tấm che khi còn khung xương`);
    // Phải báo theo trạng thái truy vấn, không phải báo cứng ngay khi mount.
    assert.match(src, new RegExp(`${HOOK}\\(!\\w+\\.isPending\\)`),
      `${file} gọi ${HOOK} nhưng không theo truy vấn nào`);
  });
}

test("danh sách tab trong bài này khớp thanh điều hướng thật", () => {
  /*
   * Bảng trên là viết tay, nên nó tự trôi khỏi thực tế — trừ khi có bài gác.
   * `/map` cố tình đứng ngoài: nó có màn chờ riêng đã dựng sẵn trong HTML đầu
   * tiên (map-loading-veil), không phải khung xương.
   */
  const nav = read("src/components/layout/nav-items.ts");
  /** Tab hiện trên điện thoại: có `href`, không mang `mobileHidden`. */
  const phoneTabs = [...nav.matchAll(/\{\s*href:\s*"([^"]+)"[^}]*\}/g)]
    .filter((m) => !m[0].includes("mobileHidden"))
    .map((m) => m[1]);
  assert.ok(phoneTabs.length >= 6, `chỉ đọc được ${phoneTabs.length} tab — regex đã lệch khỏi cấu trúc file`);
  /*
   * Phủ THIẾU mới là lỗi. Bảng có thêm route ngoài thanh dưới (`/rides` nằm
   * trong sheet "Mục khác") là phủ rộng hơn — app vẫn tải lại được ở đó.
   */
  assert.deepEqual(
    phoneTabs.filter((h) => h !== "/map" && !(h in TAB_SCREENS)), [],
    "thanh điều hướng có tab mà bảng TAB_SCREENS chưa biết — nối useAppReady cho nó",
  );
});

test("danh sách route của tấm khởi động khớp bảng trên", () => {
  /*
   * Hai nguồn phải trùng: `BOOT_READY_ROUTES` quyết định lúc chạy, bảng
   * TAB_SCREENS ở trên quyết định file nào bị soi. Lệch nhau là một màn được
   * đợi mà không bao giờ báo, hoặc báo mà không được đợi.
   */
  const src = read("src/components/layout/boot-ready-routes.ts");
  const listed = [...src.matchAll(/^\s*"(\/[a-z-]+)",$/gm)].map((m) => m[1]);
  assert.deepEqual(listed.sort(), Object.keys(TAB_SCREENS).sort());
});

test("quyết định dựa vào ĐƯỜNG DẪN, không dựa vào cờ đặt lúc hydrate", () => {
  /*
   * Đã thử bản để màn tự bật cờ trong `useEffect`: trên mạng chậm mốc `load`
   * tới TRƯỚC hydrate, cờ chưa kịp bật, `/home` gỡ tấm che sớm — bài e2e "màn
   * còn khung xương thì tấm phủ vẫn che kín" đỏ ngay. Đường dẫn thì đọc được
   * từ khung hình đầu tiên.
   */
  const src = read("src/components/layout/boot-veil-dismiss.tsx");
  assert.ok(src.includes("reportsAppReady(window.location.pathname)"),
    "tấm che không còn hỏi đường dẫn — cẩn thận bản dùng cờ lúc chạy");
  assert.ok(!src.includes("__vivuAppWillReport"), "cờ đặt lúc hydrate đã quay lại");
});
