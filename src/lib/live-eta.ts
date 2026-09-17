/**
 * Thời gian còn lại, tính theo tốc độ ĐANG đi chứ không theo ước tính lúc xuất phát.
 *
 * Bản cũ chỉ là một phép chia tỉ lệ: `còn lại / tổng × tổng thời gian`. Nghĩa là
 * dù đang đứng yên giữa đám kẹt hay đang chạy bon trên đường trống, con số vẫn
 * đếm xuống y như nhau — nó không bao giờ biết chuyện gì đang xảy ra ngoài kia.
 *
 * Điểm quan trọng nhất ở đây là **cửa sổ trượt**, không phải trung bình từ đầu
 * chuyến. Người dùng nói rõ: thoát khỏi vùng kẹt thì thời gian phải được tính
 * lại. Trung bình cộng dồn không làm được — nó nhớ mãi mười lăm phút đứng yên
 * và tiếp tục phạt người ta suốt quãng còn lại. Cửa sổ trượt thì quên, nên vừa
 * ra khỏi chỗ tắc là con số tự co lại.
 */

export type ProgressSample = {
  /** Mốc thời gian của lần đo, ms. */
  at: number;
  /** Quãng đường còn lại lúc đó, mét — đã snap vào tuyến. */
  remainingM: number;
};

/** Chỉ nhớ chừng này: đủ để lọc nhiễu, đủ ngắn để quên một vụ kẹt đã qua. */
export const ETA_WINDOW_MS = 5 * 60_000;

/** Dưới ngần này thì chưa đủ bằng chứng để nói gì về tốc độ. */
const MIN_EVIDENCE_M = 150;
const MIN_EVIDENCE_MS = 30_000;

/** Ngoài dải này là lỗi đo, không phải người ta đi thế. */
const MIN_KMH = 3;
const MAX_KMH = 80;

/** Cắt bớt những mẫu đã ra ngoài cửa sổ. Trả về mảng mới, không sửa tại chỗ. */
export function trimSamples(samples: ProgressSample[], now: number): ProgressSample[] {
  const floor = now - ETA_WINDOW_MS;
  const out = samples.filter((s) => s.at >= floor);
  // Luôn giữ lại ít nhất một mẫu cũ để còn có gì mà so.
  if (out.length === 0 && samples.length > 0) return [samples[samples.length - 1]];
  return out;
}

/**
 * Tốc độ thực trong cửa sổ, km/h — hoặc null khi chưa đủ căn cứ.
 *
 * Đo bằng ĐỘ GIẢM của quãng đường còn lại, không phải bằng `coords.speed` của
 * thiết bị: `coords.speed` là tốc độ tức thời, nên dừng đèn đỏ một cái là nó về
 * 0 và thời gian còn lại nhảy lên vô cực. Quãng đường đã rút ngắn được trong
 * năm phút vừa rồi mới là thứ nói đúng cả đèn đỏ lẫn đoạn chạy được.
 */
export function observedKmh(samples: ProgressSample[]): number | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const coveredM = first.remainingM - last.remainingM;
  const elapsedMs = last.at - first.at;
  // Lùi lại (vẽ lại đường, hoặc đi nhầm rồi quay đầu) thì không tính.
  if (coveredM < MIN_EVIDENCE_M || elapsedMs < MIN_EVIDENCE_MS) return null;
  const kmh = (coveredM / 1000) / (elapsedMs / 3_600_000);
  if (!Number.isFinite(kmh) || kmh < MIN_KMH || kmh > MAX_KMH) return null;
  return kmh;
}

/**
 * Giây còn lại.
 *
 * Trộn nhịp của tuyến với nhịp đo được, và trọng số tăng dần theo lượng bằng
 * chứng: ba trăm mét đầu chưa đủ để lật đổ ước tính của bộ định tuyến, nhưng
 * một cây số rưỡi trong cửa sổ thì đủ. Ramp chứ không phải công tắc — bật/tắt
 * đột ngột làm con số nhảy một phát mấy phút, và người ta sẽ không tin nó nữa.
 */
export function liveEtaSeconds({
  remainingM,
  routeTotalM,
  routeTotalS,
  samples,
}: {
  remainingM: number;
  routeTotalM: number;
  routeTotalS: number;
  samples: ProgressSample[];
}): number | null {
  if (!(remainingM >= 0) || !(routeTotalM > 0) || !(routeTotalS > 0)) return null;
  const routeSecPerM = routeTotalS / routeTotalM;

  const kmh = observedKmh(samples);
  if (kmh === null) return Math.round(remainingM * routeSecPerM);

  const observedSecPerM = 3600 / (kmh * 1000);
  const coveredM = samples[0].remainingM - samples[samples.length - 1].remainingM;
  const w = Math.min(1, Math.max(0, coveredM / 1500));
  const secPerM = observedSecPerM * w + routeSecPerM * (1 - w);
  return Math.round(remainingM * secPerM);
}
