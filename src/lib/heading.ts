/**
 * Đang quay mặt về hướng nào, và vẽ cái phễu đó lên bản đồ ra sao.
 *
 * Trước đây chỉ có `coords.heading` của GPS — tức HƯỚNG ĐANG DI CHUYỂN. Đứng
 * yên thì nó là null, nên đúng lúc người ta cần nhất (dừng ở ngã tư, xoay người
 * tìm xem đường nào là đường của mình) thì màn hình không nói gì. La bàn của
 * máy trả lời được câu đó, còn GPS thì không.
 *
 * Bản đầu chỉ tin la bàn khi đứng yên (dưới 3 km/h), còn đang chạy thì quay về
 * hướng GPS, vì la bàn nhiễu bởi từ trường quanh xe. Đổi rồi — xem `pickHeading`.
 */

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
 * Hướng nào để vẽ CÁI PHỄU: của la bàn, hay của GPS.
 *
 * Trả về cả nguồn, vì hai cái nói hai chuyện khác nhau và giao diện nên vẽ khác
 * nhau: hướng di chuyển là một mũi tên đặc, còn hướng nhìn là một cái phễu mở —
 * đúng như Google Maps, và đúng vì la bàn kém chính xác hơn nên không được vẽ
 * như thể nó chắc chắn.
 *
 * ⚠️ Có la bàn thì LUÔN tin la bàn, kể cả đang chạy. Bản trước ưu tiên GPS khi
 * tốc độ ≥ 3 km/h để tránh nhiễu từ trường quanh xe, và cái giá của nó là thứ
 * chủ xe báo lại: "phễu rất lag, không mượt theo hướng quay thực tế". Đúng như
 * vậy — `coords.heading` chỉ đổi mỗi lần có định vị mới, tức khoảng một giây
 * một nhịp, nên phễu giật từng nấc; và nó là hướng ĐANG ĐI, nên xoay người thì
 * phễu đứng im, trong khi cái mũi tên ngay cạnh đã nói hướng đi rồi. La bàn
 * bắn ~60 lần/giây và đã được làm mượt theo thời gian ở `useDeviceHeading`.
 *
 * GPS vẫn là phương án dự phòng: máy không có la bàn, hoặc iOS chưa được cho
 * phép, thì thà một cái phễu giật còn hơn không có gì.
 */
export function pickHeading({
  gpsHeading,
  compassHeading,
}: {
  gpsHeading: number | null | undefined;
  compassHeading: number | null | undefined;
}): { deg: number; source: "gps" | "compass" } | null {
  const gps = typeof gpsHeading === "number" && Number.isFinite(gpsHeading) ? normaliseDeg(gpsHeading) : null;
  const compass =
    typeof compassHeading === "number" && Number.isFinite(compassHeading)
      ? normaliseDeg(compassHeading)
      : null;

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
