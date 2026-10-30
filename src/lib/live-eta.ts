/**
 * Thời gian còn lại khi đang chạy.
 *
 * Bản đầu là phép chia tỉ lệ `còn lại / tổng × tổng thời gian`: đứng giữa đám
 * kẹt hay chạy bon trên đường trống, con số vẫn đếm xuống y hệt.
 *
 * Bản thứ hai sửa bằng cửa sổ trượt năm phút — và lấy tốc độ của năm phút đó
 * nhân cho CẢ quãng còn lại. Đi thật 29/10/2026 qua cầu Sài Gòn: Google báo
 * còn 51 phút, app báo 32 và tụt nhanh hơn đồng hồ, tới chân cầu thì vọt lên
 * 56. Đúng dấu của phép ngoại suy ấy: sau một đoạn thoáng 30 km/h thì, chẳng
 * hạn, 16 km còn lại thành 32 phút; vào đoạn kẹt thì cũng 16 km ấy thành gần
 * một tiếng. Năm phút đường thoáng không nói gì về mười mấy cây số phía trước.
 * Bài "qua cầu Sài Gòn" trong tests/unit/live-eta.test.ts chạy lại chuyện đó.
 *
 * Bây giờ quãng còn lại được chia hai:
 *
 *   - ĐOẠN GẦN (NEAR_M đầu tiên) theo nhịp năm phút vừa rồi — thứ nhịp gần đây
 *     đoán được: đang kẹt thì vài trăm mét tới vẫn kẹt.
 *   - PHẦN XA theo ước tính của tuyến (đã tính giờ cao điểm, xem ride-speed.ts),
 *     nhân một hệ số học dần từ quãng đã đi (nhạt dần sau chừng mười lăm phút)
 *     và kéo mạnh về 1. Hệ số là TỈ LỆ thời gian thật / thời gian tuyến hứa,
 *     nên sang tuyến mới (đi lệch rồi vẽ lại) vẫn dùng tiếp được.
 *
 * Thoát kẹt thì con số vẫn co lại ngay (đoạn gần), như người dùng đã yêu cầu ở
 * bản trước; chỉ là không còn co về "cả quãng sẽ thoáng như năm phút vừa rồi".
 *
 * Con số hiển thị là GIỜ ĐẾN được làm mượt rồi trừ đi bây giờ: giờ đến đứng yên
 * thì số phút tự đếm lùi đều, và một lần đo lệch hay một lần vẽ lại đường chỉ
 * kéo giờ đến dịch dần chứ không làm con số nhảy.
 */

export type ProgressSample = {
  /** Mốc thời gian của lần đo, ms. */
  at: number;
  /** Quãng đường còn lại lúc đó, mét — đã snap vào tuyến. */
  remainingM: number;
};

/** Nhịp "gần đây": đủ để lọc nhiễu, đủ ngắn để quên một vụ kẹt đã qua. */
export const ETA_WINDOW_MS = 5 * 60_000;

/** Đoạn phía trước đi theo nhịp gần đây; phần còn lại theo tuyến. */
export const NEAR_M = 1_000;

/**
 * Sức nặng của ước tính tuyến khi học hệ số cả chuyến, tính bằng giây chạy.
 * Ba mươi phút: phải đi chừng đó mới ngang bằng lời hứa của tuyến, nên mười
 * phút đường thoáng đầu chuyến không đủ để hứa cả quãng sau cũng thoáng.
 * (Với trí nhớ 15 phút ở dưới, bằng chứng không bao giờ vượt quá chừng ấy, nên
 * tuyến luôn giữ ít nhất hai phần ba sức nặng.)
 */
export const TRIP_PRIOR_S = 30 * 60;

/**
 * Hệ số cả chuyến cũng QUÊN, chỉ chậm hơn cửa sổ: mười lăm phút. Người dùng đã
 * nói rõ ở bản trước — trung bình cộng dồn "nhớ mãi mười lăm phút đứng yên" và
 * phạt người ta suốt quãng còn lại. Không quên thì thoát kẹt năm phút con số
 * chỉ co 18%; quên theo nhịp này thì co hơn 20% như bài kiểm yêu cầu.
 */
export const TRIP_MEMORY_MS = 15 * 60_000;

/** Làm mượt giờ đến: hằng số thời gian. */
const ARRIVAL_TAU_MS = 30_000;

/** Cửa sổ ngắn hơn thế này chưa nói được gì về nhịp; đủ thế này thì tin hẳn. */
const MIN_WINDOW_S = 30;
const FULL_WINDOW_S = 180;

/** Rút ngắn nhanh hơn thế này là vị trí khớp nhảy trên tuyến, không phải chạy. */
const MAX_PLAUSIBLE_MPS = 90 / 3.6;
/** Lùi quá chừng này một lần cũng là khớp nhảy. */
const MAX_BACKWARD_M = 150;
/** Xa tuyến hơn thế này thì thời gian đang trôi không thuộc về tuyến. */
const ON_ROUTE_M = 60;
/** Chưa đi được chừng này thì vẫn là đứng chờ ở chỗ xuất phát. */
const DEPART_M = 100;

/** Hệ số = thời gian thật / thời gian tuyến hứa. */
const F_MIN = 0.5;
const F_MAX_NEAR = 4;
const F_MAX_TRIP = 2.5;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Cắt bớt những mẫu đã ra ngoài cửa sổ. Trả về mảng mới, không sửa tại chỗ. */
export function trimSamples(samples: ProgressSample[], now: number): ProgressSample[] {
  const floor = now - ETA_WINDOW_MS;
  const out = samples.filter((s) => s.at >= floor);
  // Luôn giữ lại ít nhất một mẫu cũ để còn có gì mà so.
  if (out.length === 0 && samples.length > 0) return [samples[samples.length - 1]];
  return out;
}

export type EtaTracker = {
  /** Cửa sổ trượt, chỉ của tuyến đang đi: "còn lại" của tuyến khác là thang đo khác. */
  samples: ProgressSample[];
  /** "Còn lại" lúc bắt đầu chờ trên tuyến này, để biết đã thật sự lăn bánh chưa. */
  anchorM: number | null;
  departed: boolean;
  /** Cả chuyến (nhạt dần theo TRIP_MEMORY_MS), qua mọi lần vẽ lại đường: thời gian thật và thời gian tuyến hứa. */
  elapsedS: number;
  plannedS: number;
  /** Giờ đến đã làm mượt, ms — null trước lần đo đầu. */
  arrivalAt: number | null;
  stepAt: number | null;
};

export function newEtaTracker(): EtaTracker {
  return { samples: [], anchorM: null, departed: false, elapsedS: 0, plannedS: 0, arrivalAt: null, stepAt: null };
}

/** Một tuyến mới (đi lệch rồi vẽ lại, đổi tuyến khác): quên cửa sổ, giữ những gì đã học. */
export function onNewRoute(t: EtaTracker): EtaTracker {
  return { ...t, samples: [], anchorM: null };
}

/** Hệ số cả chuyến, kéo về 1 cho tới khi đã chạy đủ lâu. */
export function tripFactor(t: Pick<EtaTracker, "elapsedS" | "plannedS">): number {
  return clamp((t.elapsedS + TRIP_PRIOR_S) / (t.plannedS + TRIP_PRIOR_S), F_MIN, F_MAX_TRIP);
}

/**
 * Hệ số của đoạn gần, từ cửa sổ. Đứng yên hẳn cũng là bằng chứng — đang kẹt —
 * nên không đi được mét nào thì ra mức trần, không phải "chưa biết".
 */
export function nearFactor(samples: ProgressSample[], secPerM: number, fallback: number): number {
  if (samples.length < 2) return fallback;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const windowS = (last.at - first.at) / 1000;
  if (windowS < MIN_WINDOW_S) return fallback;
  const covered = first.remainingM - last.remainingM;
  const raw = covered > 0 ? windowS / (covered * secPerM) : F_MAX_NEAR;
  const w = Math.min(1, windowS / FULL_WINDOW_S);
  return w * clamp(raw, F_MIN, F_MAX_NEAR) + (1 - w) * fallback;
}

/** Giây còn lại, chưa làm mượt. */
export function rawEtaSeconds(t: EtaTracker, remainingM: number, secPerM: number): number {
  const fTrip = tripFactor(t);
  const fNear = t.departed ? nearFactor(t.samples, secPerM, fTrip) : fTrip;
  const near = Math.min(remainingM, NEAR_M);
  return (near * fNear + (remainingM - near) * fTrip) * secPerM;
}

/**
 * Một lần định vị: cập nhật những gì đã học, trả về giây còn lại để hiển thị.
 *
 * `secPerM` là nhịp của tuyến đang đi (tổng thời gian / tổng quãng đường);
 * `deviationM` là khoảng cách từ vị trí tới tuyến.
 */
export function stepEta(
  t: EtaTracker,
  { at, remainingM, deviationM, secPerM }: { at: number; remainingM: number; deviationM: number; secPerM: number },
): { tracker: EtaTracker; seconds: number | null } {
  if (!(remainingM >= 0) || !(secPerM > 0) || !Number.isFinite(secPerM)) return { tracker: t, seconds: null };

  const fix = { at, remainingM };
  let { samples, anchorM, departed, elapsedS, plannedS } = t;
  const prev = samples[samples.length - 1];
  if (!prev) {
    samples = [fix];
  } else {
    const dt = (at - prev.at) / 1000;
    const gain = prev.remainingM - remainingM;
    if (!(dt > 0) || gain < -MAX_BACKWARD_M || gain / dt > MAX_PLAUSIBLE_MPS) {
      // Vị trí khớp nhảy dọc tuyến: đo lại từ đây, đừng để cú nhảy thành "tốc độ".
      samples = [fix];
    } else {
      samples = trimSamples([...samples, fix], at);
      /*
       * Đèn đỏ và kẹt xe vẫn là thời gian của chuyến, nên đứng yên cũng cộng.
       * Quãng tuyến hứa cộng theo độ rút ngắn CÓ DẤU: GPS rung qua lại lúc
       * đứng yên thì cộng rồi trừ, không dồn thành quãng đường ma.
       */
      if (departed && deviationM <= ON_ROUTE_M) {
        const keep = Math.exp(-(dt * 1000) / TRIP_MEMORY_MS);
        elapsedS = elapsedS * keep + dt;
        plannedS = Math.max(0, plannedS * keep + gain * secPerM);
      }
    }
  }
  if (!departed) {
    // Mở dẫn đường rồi đứng chờ người kia: chưa phải là chạy chậm.
    if (anchorM == null) anchorM = remainingM;
    else if (anchorM - remainingM >= DEPART_M) departed = true;
  }

  const next: EtaTracker = { ...t, samples, anchorM, departed, elapsedS, plannedS };
  const target = at + rawEtaSeconds(next, remainingM, secPerM) * 1000;
  const arrivalAt =
    t.arrivalAt == null || t.stepAt == null || at <= t.stepAt
      ? target
      : t.arrivalAt + (target - t.arrivalAt) * (1 - Math.exp(-(at - t.stepAt) / ARRIVAL_TAU_MS));
  return {
    tracker: { ...next, arrivalAt, stepAt: at },
    seconds: Math.max(0, Math.round((arrivalAt - at) / 1000)),
  };
}
