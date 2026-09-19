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

/** Nền và tỉ lệ dấu hiệu, đo lại từ chính các ảnh đang có trong repo. */
const GROUND = "#1E3A5F";
const MARK_WIDTH_RATIO = 0.518; // dấu rộng 51.8% bề ngang, căn giữa

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

const page1 = (mark) => `<!doctype html><html><body style="margin:0;background:${GROUND};height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden">
<img src="${mark}" style="width:${MARK_WIDTH_RATIO * 100}vw;height:auto;display:block">
</body></html>`;

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
  const html = page1(markDataUri());
  try {
    for (const r of todo) {
      // Ngang thì hoán đổi hai chiều: iOS đòi đúng số pixel của chiều đó.
      const lw = r.orient === "landscape" ? r.h : r.w;
      const lh = r.orient === "landscape" ? r.w : r.h;
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
