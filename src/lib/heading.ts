/**
 * Đang quay mặt về hướng nào, và vẽ cái phễu đó lên bản đồ ra sao.
 *
 * Trước đây chỉ có `coords.heading` của GPS — tức HƯỚNG ĐANG DI CHUYỂN. Đứng
 * yên thì nó là null, nên đúng lúc người ta cần nhất (dừng ở ngã tư, xoay người
 * tìm xem đường nào là đường của mình) thì màn hình không nói gì. La bàn của
 * máy trả lời được câu đó, còn GPS thì không.
 *
 * Ngược lại, la bàn nhiễu khi đang chạy — từ trường quanh xe, rung. Nên: đang
 * chạy thì tin GPS, đứng yên thì tin la bàn. Đó cũng là cách Google Maps làm.
 */

/** Dưới ngưỡng này coi như đứng yên, km/h. */
export const STILL_KMH = 3;

/** Đưa một góc bất kỳ về [0, 360). */
export function normaliseDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Chênh lệch ngắn nhất giữa hai góc, trong [-180, 180].
 *
 * Cần nó vì 359° và 1° chỉ cách nhau 2°, không phải 358° — làm mượt mà trừ
 * thẳng thì mỗi lần đi qua hướng bắc cái phễu lại quay nguyên một vòng.
 */
export function deltaDeg(from: number, to: number): number {
  const d = normaliseDeg(to - from + 180) - 180;
  return d === -180 ? 180 : d;
}

/**
 * Làm mượt theo đường ngắn nhất.
 *
 * `alpha` là mức tin vào số đo mới. La bàn điện thoại nhảy vài độ liên tục;
 * không làm mượt thì cái phễu rung như đèn nháy và không ai đọc được nó.
 */
export function smoothHeading(prev: number | null, next: number, alpha = 0.25): number {
  if (prev === null || !Number.isFinite(prev)) return normaliseDeg(next);
  return normaliseDeg(prev + deltaDeg(prev, next) * alpha);
}

/**
 * Hướng nào để vẽ: của GPS hay của la bàn.
 *
 * Trả về cả nguồn, vì hai cái nói hai chuyện khác nhau và giao diện nên vẽ khác
 * nhau: hướng di chuyển là một mũi tên đặc, còn hướng nhìn là một cái phễu mở —
 * đúng như Google Maps, và đúng vì la bàn kém chính xác hơn nên không được vẽ
 * như thể nó chắc chắn.
 */
export function pickHeading({
  gpsHeading,
  compassHeading,
  speedKmh,
}: {
  gpsHeading: number | null | undefined;
  compassHeading: number | null | undefined;
  speedKmh: number | null | undefined;
}): { deg: number; source: "gps" | "compass" } | null {
  const moving = typeof speedKmh === "number" && speedKmh >= STILL_KMH;
  const gps = typeof gpsHeading === "number" && Number.isFinite(gpsHeading) ? normaliseDeg(gpsHeading) : null;
  const compass =
    typeof compassHeading === "number" && Number.isFinite(compassHeading)
      ? normaliseDeg(compassHeading)
      : null;

  if (moving && gps !== null) return { deg: gps, source: "gps" };
  if (compass !== null) return { deg: compass, source: "compass" };
  if (gps !== null) return { deg: gps, source: "gps" };
  return null;
}

/**
 * Góc phải xoay phần tử trên màn hình.
 *
 * Bản đồ tự xoay khi đang bám theo, nên một cái phễu vẽ theo góc tuyệt đối sẽ
 * bị cộng hai lần và chỉ ngay ngắn vào đúng lúc bản đồ hướng bắc. Trừ đi góc
 * xoay của bản đồ là cách duy nhất để nó đúng ở cả hai chế độ — và `rotation={0}`
 * của bản cũ chính là trường hợp đặc biệt vô tình đúng khi bám theo.
 */
export function screenRotation(headingDeg: number, mapBearingDeg: number | null | undefined): number {
  const bearing = typeof mapBearingDeg === "number" && Number.isFinite(mapBearingDeg) ? mapBearingDeg : 0;
  return normaliseDeg(headingDeg - bearing);
}

/**
 * Hướng la bàn từ một sự kiện deviceorientation, hoặc null.
 *
 * iOS không có `alpha` theo chuẩn mà có `webkitCompassHeading`, vốn đã là góc
 * so với bắc thật và quay THEO chiều kim đồng hồ. `alpha` của chuẩn W3C thì
 * ngược chiều, nên phải lấy 360 trừ đi — quên chỗ này là cái phễu chỉ đúng khi
 * quay mặt về bắc hoặc nam, và sai gương ở mọi hướng khác.
 */
export function compassFromEvent(e: {
  alpha?: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number | null;
}): number | null {
  const webkit = e.webkitCompassHeading;
  if (typeof webkit === "number" && Number.isFinite(webkit)) return normaliseDeg(webkit);
  if (typeof e.alpha === "number" && Number.isFinite(e.alpha) && e.absolute !== false) {
    return normaliseDeg(360 - e.alpha);
  }
  return null;
}
