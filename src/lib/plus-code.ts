/**
 * Plus code (Open Location Code) — toạ độ nén trong một chuỗi ngắn.
 *
 * Link "Chia sẻ" từ Google Maps trên điện thoại rơi về một URL **không có toạ
 * độ**… trên danh nghĩa. Thực tế phần tên chỗ của nó thường mở đầu bằng một
 * plus code, và plus code CHÍNH LÀ toạ độ:
 *
 *   /maps/place/HX6G+8C4+Trạm+dừng+chân+Thiên+Thảo,+Ninh+Phước,+Khánh+Hòa/data=…
 *
 * Bỏ qua nó rồi đi đoán theo tên quán là cách trôi 76km — đo thật trên một link
 * của chủ repo: đoán tên ra Nha Trang, còn quán ở Ninh Phước.
 *
 * Tự viết thay vì thêm thư viện: cả phép giải chỉ là đổi cơ số 20, và module
 * này không đụng mạng nên kiểm được bằng số thuần.
 */

const A = "23456789CFGHJMPQRVWX";
const BASE = 20;
const SEP = "+";
const SEP_POS = 8;
/** Sau 10 chữ số, mỗi ký tự thêm chia ô thành lưới 4 cột × 5 hàng. */
const GRID_COLS = 4;
const GRID_ROWS = 5;
/**
 * Cỡ ô ứng với số cặp chữ số ĐÃ lấy từ tham chiếu: lược 2 ký tự → còn mơ hồ
 * trong ô 20°, lược 4 → ô 1°, lược 6 → ô 0.05°. Tra nhầm một bậc thì mã vẫn giải
 * ra đúng, nhưng bước chọn-ô-gần-nhất kéo nó trượt sang ô bên cạnh.
 */
const PAIR_RES = [20, 1, 1 / 20];

export type LatLng = { lat: number; lng: number };

/** Mã đầy đủ (có ít nhất 8 ký tự trước dấu +) trông như thế nào. */
const FULL_RE = new RegExp(`^[${A}]{8}\\${SEP}[${A}]*$`);
/** Mã NGẮN: thiếu 2/4/6 ký tự đầu, ví dụ `HX6G+8C4`. */
const SHORT_RE = new RegExp(`^[${A}]{2,6}\\${SEP}[${A}]{2,3}$`);

/** Tìm plus code trong một đoạn văn bản (tên chỗ lấy từ URL). */
export function findPlusCode(text: string): string | null {
  const m = text.toUpperCase().match(new RegExp(`\\b[${A}]{2,8}\\${SEP}[${A}]{2,3}\\b`));
  return m ? m[0] : null;
}

/** Tâm của ô mà mã đầy đủ chỉ tới. */
export function decodePlusCode(code: string): LatLng | null {
  const c = code.toUpperCase();
  if (!FULL_RE.test(c)) return null;
  const digits = c.replace(SEP, "");
  let lat = -90, lng = -180;
  let latRes = BASE, lngRes = BASE;

  const pairs = Math.min(digits.length, 10);
  for (let i = 0; i < pairs; i += 2) {
    const a = A.indexOf(digits[i]);
    const b = A.indexOf(digits[i + 1]);
    if (a < 0 || b < 0) return null;
    lat += a * latRes;
    lng += b * lngRes;
    latRes /= BASE;
    lngRes /= BASE;
  }
  // Ô hiện tại rộng đúng `latRes * BASE` — đã chia thêm một lần ở vòng cuối.
  let latCell = latRes * BASE;
  let lngCell = lngRes * BASE;

  for (let i = 10; i < digits.length; i++) {
    const d = A.indexOf(digits[i]);
    if (d < 0) return null;
    const row = Math.floor(d / GRID_COLS);
    const col = d % GRID_COLS;
    latCell /= GRID_ROWS;
    lngCell /= GRID_COLS;
    lat += row * latCell;
    lng += col * lngCell;
  }
  return { lat: lat + latCell / 2, lng: lng + lngCell / 2 };
}

/** Mã đầy đủ của một điểm, dùng để vá phần đầu bị lược của mã ngắn. */
function encodeFull(lat: number, lng: number, digits = 10): string {
  let la = Math.min(Math.max(lat, -90), 90) + 90;
  let ln = (((lng + 180) % 360) + 360) % 360;
  let latRes = BASE, lngRes = BASE;
  let out = "";
  for (let i = 0; i < digits / 2; i++) {
    const a = Math.min(Math.floor(la / latRes), BASE - 1);
    const b = Math.min(Math.floor(ln / lngRes), BASE - 1);
    out += A[a] + A[b];
    la -= a * latRes;
    ln -= b * lngRes;
    latRes /= BASE;
    lngRes /= BASE;
  }
  return out.slice(0, SEP_POS) + SEP + out.slice(SEP_POS);
}

/**
 * Mã ngắn + một điểm tham chiếu gần → toạ độ.
 *
 * Mã ngắn lược 2/4/6 ký tự đầu, tức nó chỉ đúng **trong một vùng** quanh chỗ
 * người gửi đang đứng. Vá lại bằng phần đầu của điểm tham chiếu, rồi thử dịch
 * một ô sang mỗi phía để lấy ô GẦN tham chiếu nhất — chính chỗ này là lý do
 * phải có tham chiếu, và tham chiếu tốt nhất là tên vùng hành chính đi kèm
 * ngay trong URL (`Ninh Phước, Khánh Hòa`), không phải tên quán.
 */
export function recoverPlusCode(short: string, ref: LatLng): LatLng | null {
  const c = short.toUpperCase();
  if (FULL_RE.test(c)) return decodePlusCode(c);
  if (!SHORT_RE.test(c)) return null;

  const missing = SEP_POS - c.indexOf(SEP);
  if (missing <= 0 || missing % 2 !== 0) return null;
  const res = PAIR_RES[missing / 2 - 1];
  if (!res) return null;

  const prefix = encodeFull(ref.lat, ref.lng).replace(SEP, "").slice(0, missing);
  const digits = (prefix + c.replace(SEP, "")).slice(0, SEP_POS);
  const rest = (prefix + c.replace(SEP, "")).slice(SEP_POS);
  const base = decodePlusCode(digits + SEP + rest);
  if (!base) return null;

  // Ô gần tham chiếu nhất: mã ngắn chỉ phân biệt được trong phạm vi ±nửa ô.
  const near = (v: number, refV: number, step: number) => {
    let x = v;
    while (x - refV > step / 2) x -= step;
    while (refV - x > step / 2) x += step;
    return x;
  };
  return { lat: near(base.lat, ref.lat, res), lng: near(base.lng, ref.lng, res) };
}
