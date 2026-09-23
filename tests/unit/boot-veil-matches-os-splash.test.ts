import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * Tấm khởi động phải TRÙNG KHÍT ảnh splash của hệ điều hành.
 *
 * Người dùng nhìn thấy hai cái liên tiếp nhau trong một lần mở app, nên lệch
 * cỡ hay lệch chỗ là thành một cú giật — báo về đúng bằng câu "2 cái khác nhau
 * không đồng bộ xíu nào". Bản trước đặt cứng logo 120px, hoá ra gấp 1,5 lần.
 *
 * Số dưới đây tách từ video quay máy thật, đơn vị là pixel của khung video.
 * Không có cái nào ước lượng; muốn đo lại thì quay màn lúc mở app rồi lấy hộp
 * bao của phần khác màu nền navy.
 */
const SCREEN_W = 478;
const SCREEN_H = 1066;
const STATUS_BAR_H = 40; // dải trên, nằm NGOÀI khung web
const NAV_BAR_H = 49; // dải dưới, ẩn hiện được

/** Hộp bao của DẤU HIỆU trên splash (nền tile cùng màu navy nên không đo được tile). */
const MARK = { x0: 200, x1: 278, y0: 474, y1: 547 };
/** Hộp bao của chữ "Vivu No Plan". */
const WORDMARK = { x0: 177, x1: 299, y0: 936, y1: 956 };
/** Dấu chiếm bao nhiêu bề ngang file icon — đo ở public/icon-512.png. */
const MARK_RATIO_IN_FILE = 0.799;

/*
 * `100vh` là khung LỚN: cao bằng màn trừ thanh trạng thái, và KHÔNG đổi khi
 * thanh điều hướng ẩn hiện. Đó chính là lý do tấm che dùng `height: 100vh` —
 * trước đó nó theo khung động nên chữ nhảy mỗi lần thanh dưới biến mất.
 */
const VEIL_BOX_H = SCREEN_H - STATUS_BAR_H;

/** Bề ngang tile phải đặt, tính theo % bề ngang màn. */
const wantTileVw = ((MARK.x1 - MARK.x0 + 1) / MARK_RATIO_IN_FILE / SCREEN_W) * 100;
/** Tâm dấu và tâm chữ, quy từ toạ độ màn về toạ độ khung web. */
const centreInBox = (y0: number, y1: number) =>
  (((y0 + y1) / 2 - STATUS_BAR_H) / VEIL_BOX_H) * 100;

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const veil = css.slice(css.indexOf("#boot-veil-inner img"));

function number(pattern: RegExp, what: string): number {
  const m = veil.match(pattern);
  assert.ok(m, `không đọc được ${what} trong globals.css — luật đã đổi cấu trúc?`);
  return Number(m[1]);
}

test("dấu hiệu to đúng bằng dấu trên splash hệ điều hành", () => {
  const got = number(/width:\s*clamp\([^,]+,\s*([\d.]+)vw/, "bề ngang dấu");
  assert.ok(
    Math.abs(got - wantTileVw) < 0.3,
    `CSS đặt ${got}vw, splash đo được ${wantTileVw.toFixed(2)}vw`,
  );
});

test("dấu hiệu nằm đúng chỗ của dấu trên splash", () => {
  const got = number(/#boot-veil-inner img\s*\{[^}]*?top:\s*([\d.]+)%/, "tâm dấu");
  const want = centreInBox(MARK.y0, MARK.y1);
  assert.ok(Math.abs(got - want) < 0.6, `CSS đặt ${got}%, splash đo được ${want.toFixed(2)}%`);
});

test("chữ nằm đúng chỗ của chữ trên splash", () => {
  const got = number(/#boot-veil-inner p\s*\{[^}]*?top:\s*([\d.]+)%/, "tâm chữ");
  const want = centreInBox(WORDMARK.y0, WORDMARK.y1);
  assert.ok(Math.abs(got - want) < 0.6, `CSS đặt ${got}%, splash đo được ${want.toFixed(2)}%`);
});

test("khung của tấm che là khung LỚN, không phải khung động", () => {
  // Chữ nhảy khi thanh điều hướng ẩn đi là vì trước đây nó theo khung động.
  assert.match(css.slice(css.indexOf("#boot-veil {")), /height:\s*100vh/);
});

test("nền tấm che trùng nền manifest và 24 ảnh khởi động iOS", () => {
  const manifest = readFileSync(new URL("../../src/app/manifest.ts", import.meta.url), "utf8");
  const ground = manifest.match(/background_color:\s*"(#[0-9A-Fa-f]{6})"/)?.[1];
  assert.ok(ground);
  assert.ok(
    css.includes(`background: ${ground.toLowerCase()}`) || css.includes(`background: ${ground}`),
    `manifest dùng ${ground} mà tấm che dùng màu khác`,
  );
});

/*
 * 24 ảnh khởi động iOS là cái splash THỨ BA của cùng một app, và trước đây nó
 * vẽ dấu rộng 51,8% không kèm chữ — khác hẳn hai cái kia. Nay dùng chung bộ số
 * này; bài dưới gác bộ sinh, còn splash-table-matches-files gác việc có đủ file.
 *
 * Mẫu số KHÁC nhau và phải giữ khác: ảnh iOS phủ CẢ MÀN nên quy theo 1066,
 * còn tấm che nằm trong khung web nên quy theo 1026. Kéo hai bên về một số là
 * lệch mất một thanh trạng thái.
 */
const gen = readFileSync(new URL("../../scripts/make-splash.mjs", import.meta.url), "utf8");
const genNumber = (name: string) => {
  const m = gen.match(new RegExp(`const ${name} = ([\\d.]+);`));
  assert.ok(m, `không đọc được ${name} trong make-splash.mjs`);
  return Number(m[1]);
};

test("ảnh khởi động iOS vẽ dấu cùng cỡ với splash hệ điều hành", () => {
  const got = genNumber("MARK_WIDTH_RATIO") * 100;
  assert.ok(Math.abs(got - wantTileVw) < 0.3, `bộ sinh dùng ${got}%, đo được ${wantTileVw.toFixed(2)}%`);
});

test("ảnh khởi động iOS đặt dấu và chữ đúng chỗ, tính theo CẢ MÀN", () => {
  const markWant = ((MARK.y0 + MARK.y1) / 2 / SCREEN_H) * 100;
  const labelWant = ((WORDMARK.y0 + WORDMARK.y1) / 2 / SCREEN_H) * 100;
  assert.ok(Math.abs(genNumber("MARK_CENTRE_Y") * 100 - markWant) < 0.3, `dấu: đo được ${markWant.toFixed(2)}%`);
  assert.ok(Math.abs(genNumber("LABEL_CENTRE_Y") * 100 - labelWant) < 0.3, `chữ: đo được ${labelWant.toFixed(2)}%`);
});

test("HTML dựng ảnh khởi động phải khai viewport", () => {
  /*
   * Thiếu thẻ này thì Chrome ở chế độ mobile dựng trang ở bề rộng mặc định
   * 980px, và mọi giá trị `px` co lại 2,5 lần — ảnh vẫn sinh ra bình thường,
   * chỉ là dấu bé tí. Đã dính đúng một lần.
   */
  assert.match(gen, /<meta name="viewport" content="width=device-width/);
});

test("nav bar ẩn hiện không được làm nhảy chữ", () => {
  // Khung động thì chữ tụt xuống mỗi lần thanh dưới biến mất — người dùng báo
  // đúng triệu chứng đó. `100vh` là khung lớn nên đứng yên.
  assert.ok(!/#boot-veil\s*\{[^}]*height:\s*100dvh/.test(css));
});

test("khung tấm che KHÔNG trừ thanh điều hướng", () => {
  /*
   * Đây là chỗ dễ "sửa nhầm cho đúng" nhất. Thanh điều hướng ẩn hiện được, nên
   * nếu quy mốc theo khung NHỎ (đã trừ nó) thì lúc nó ẩn đi mọi thứ tụt xuống
   * — chính là lỗi người dùng báo. `100vh` giữ khung lớn, và bộ số ở trên phải
   * được quy theo khung lớn ấy, không phải khung nhỏ.
   */
  const smallBox = SCREEN_H - STATUS_BAR_H - NAV_BAR_H;
  assert.equal(VEIL_BOX_H, SCREEN_H - STATUS_BAR_H);
  const perSmallBox = (((WORDMARK.y0 + WORDMARK.y1) / 2 - STATUS_BAR_H) / smallBox) * 100;
  assert.ok(
    Math.abs(perSmallBox - centreInBox(WORDMARK.y0, WORDMARK.y1)) > 3,
    "hai cách quy đang cho cùng kết quả — bài này hết tác dụng, xem lại số đo",
  );
});
