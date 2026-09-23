/*
 * Sinh ảnh khởi động iOS từ CHÍNH bảng mà component dùng.
 *
 * Trước đây bảng và thư mục ảnh là hai thứ viết tay ở hai commit khác nhau:
 * thêm một dòng mà quên ảnh, hoặc đổi màu thương hiệu mà quên dựng lại ảnh,
 * đều hỏng IM LẶNG — iOS bỏ qua một `<link>` không khớp đúng kích thước và
 * không báo gì, nên "máy này không được hỗ trợ" và "chúng ta gõ sai một số"
 * trông y hệt nhau.
 *
 * Dựng bằng Chrome đã có sẵn trên máy: đặt viewport đúng kích thước logic và
 * `deviceScaleFactor` đúng dpr, rồi chụp — ra đúng số pixel vật lý mà iOS đòi,
 * không cần thêm thư viện xử lý ảnh nào.
 *
 *   node scripts/make-splash.mjs            # chỉ dựng những ảnh còn THIẾU
 *   node scripts/make-splash.mjs --all      # dựng lại tất cả
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChrome, openPage } from "./e2e/cdp.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "public/splash");

/*
 * Bố cục: CHÉP ĐÚNG splash mà hệ điều hành tự dựng, không tự bịa một cái khác.
 *
 * Trước đây file này vẽ dấu rộng 51,8% bề ngang và không có chữ, trong khi
 * splash Android vẽ dấu 20,4% kèm chữ ở gần đáy — ba cái splash cho một app,
 * và người dùng thấy đúng như thế: "2 cái khác nhau không đồng bộ xíu nào".
 *
 * Số lấy từ video quay máy thật, cùng bộ số mà
 * tests/unit/boot-veil-matches-os-splash.test.ts đang gác. Tính theo CẠNH NGẮN
 * để ảnh nằm ngang không phóng dấu to bằng cả màn.
 */
const GROUND = "#1E3A5F";
const MARK_WIDTH_RATIO = 0.204; // tile dấu, tính theo cạnh ngắn
const MARK_CENTRE_Y = 0.479; // tâm dấu, tính theo chiều cao ảnh
const LABEL_CENTRE_Y = 0.887; // tâm chữ, tính theo chiều cao ảnh
const LABEL_SIZE_RATIO = 0.0407; // cỡ chữ, tính theo cạnh ngắn

/** Đọc tên site từ nguồn duy nhất, để ảnh không bao giờ lệch tên với manifest. */
function readSiteName() {
  const src = readFileSync(join(ROOT, "src/lib/site.ts"), "utf8");
  const m = src.match(/SITE_NAME\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("không đọc được SITE_NAME");
  return m[1];
}

/** Đọc bảng từ component, để không bao giờ có hai nguồn sự thật. */
function readTable() {
  const src = readFileSync(join(ROOT, "src/components/layout/apple-splash-links.tsx"), "utf8");
  const rows = [...src.matchAll(
    /\{\s*w:\s*(\d+),\s*h:\s*(\d+),\s*dpr:\s*(\d+),\s*orient:\s*"(portrait|landscape)",\s*file:\s*"([^"]+)"/g,
  )];
  if (!rows.length) throw new Error("không đọc được bảng splash — cấu trúc component đã đổi?");
  return rows.map((m) => ({
    w: Number(m[1]), h: Number(m[2]), dpr: Number(m[3]), orient: m[4], file: m[5],
  }));
}

const markDataUri = () => {
  const b = readFileSync(join(ROOT, "public/icon-512.png"));
  return `data:image/png;base64,${b.toString("base64")}`;
};

const page1 = (mark, name, shortSide) => {
  const markPx = Math.round(MARK_WIDTH_RATIO * shortSide);
  const fontPx = (LABEL_SIZE_RATIO * shortSide).toFixed(2);
  /*
   * Thẻ viewport là BẮT BUỘC, không phải trang trí.
   *
   * `Emulation.setDeviceMetricsOverride` bật cờ mobile, và trang mobile không
   * khai viewport thì Chrome dựng ở bề rộng mặc định 980px — mọi giá trị `px`
   * bên dưới co lại theo tỉ lệ 393/980 và dấu hiệu ra nhỏ 2,5 lần. Bản trước
   * dùng `vw` nên không lộ ra lỗi này; đổi sang `px` thì nó lộ ngay.
   */
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${GROUND};height:100vh;overflow:hidden;position:relative;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
<img src="${mark}" style="position:absolute;top:${MARK_CENTRE_Y * 100}%;left:50%;width:${markPx}px;height:auto;transform:translate(-50%,-50%);display:block">
<p style="position:absolute;top:${LABEL_CENTRE_Y * 100}%;left:0;right:0;margin:0;text-align:center;color:#fff;font-size:${fontPx}px;letter-spacing:0.02em;transform:translateY(-50%)">${name}</p>
</body></html>`;
};

async function main() {
  const all = process.argv.includes("--all");
  const table = readTable();
  const todo = all ? table : table.filter((r) => !existsSync(join(OUT, r.file)));
  if (!todo.length) {
    console.log("Không thiếu ảnh nào. Dùng --all nếu muốn dựng lại tất cả.");
    return;
  }
  const chrome = await launchChrome("/tmp/vivu-splash-chrome", 9801, { width: 400, height: 800 });
  const page = await openPage(9801);
  const mark = markDataUri();
  const name = readSiteName();
  try {
    for (const r of todo) {
      // Ngang thì hoán đổi hai chiều: iOS đòi đúng số pixel của chiều đó.
      const lw = r.orient === "landscape" ? r.h : r.w;
      const lh = r.orient === "landscape" ? r.w : r.h;
      const html = page1(mark, name, Math.min(lw, lh));
      await page.viewport(lw, lh, true, r.dpr);
      await page.goto(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
      await new Promise((res) => setTimeout(res, 250));
      const { data } = await page.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(OUT, r.file), Buffer.from(data, "base64"));
      console.log(`  ${r.file}  ${lw * r.dpr}x${lh * r.dpr}`);
    }
  } finally {
    page.close();
    chrome.kill();
  }
  console.log(`Xong ${todo.length} ảnh.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
