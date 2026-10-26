/*
 * Xoay ngang trình phát — toàn màn hình, nằm ngang, và ĐỨNG YÊN ở đó.
 *
 * Chủ repo báo 26/10: trên điện thoại, toàn màn hình của YouTube giữ nguyên màn
 * dọc. Muốn ngang thì phải bật xoay tự động của máy, mà bật lên thì nó xoay theo
 * mỗi lần lắc máy chứ không xoay một lần rồi đứng yên.
 *
 * Nút toàn màn hình nằm TRONG iframe của YouTube, ngoài tầm tay của app, nên app
 * có chế độ xoay ngang của riêng nó, áp lên chính khung phát đang chạy (không
 * dựng iframe mới — dựng lại là video chạy lại từ đầu):
 *
 *   - Android: cho khung lên toàn màn hình thật rồi `screen.orientation.lock`.
 *     Khoá được thì máy nằm ngang thật, bất kể cảm biến.
 *   - iPhone (Safari không có lock, không cho toàn màn hình phần tử thường) hay
 *     khi khoá thất bại: xoay khung 90° bằng CSS cho phủ kín màn dọc. Không dựa
 *     vào cảm biến nên cũng không xoay theo tay.
 *
 * Trạng thái là biến module như photo-viewer-state: nút bấm ở trang phát, khung
 * ở dock, nút back ở BackButtonGuard — ba nơi, một sự thật.
 */

type OrientationWithLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

let open = false;
let target: HTMLElement | null = null;
/** True while the fullscreen on screen is the one this module asked for. */
let ownFullscreen = false;
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((fn) => fn());

export function subscribePlayerLandscape(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function isPlayerLandscapeOpen(): boolean {
  return open;
}

/** The element to put fullscreen: the player panel, registered by the dock. */
export function registerPlayerLandscapeTarget(el: HTMLElement | null): void {
  target = el;
}

/**
 * Turn it on. Call it straight from the tap's handler: fullscreen is only
 * granted inside the gesture, and an await before it would lose it.
 */
export function enterPlayerLandscape(): void {
  if (open) return;
  open = true;
  emit();
  // BackButtonGuard pushes a history mark, so the back button leaves this mode rather than the page.
  window.dispatchEvent(new Event("player-landscape-open"));
  const el = target;
  if (!el?.requestFullscreen || document.fullscreenElement) return;
  el.requestFullscreen({ navigationUI: "hide" })
    .then(() => {
      ownFullscreen = true;
      return (screen.orientation as OrientationWithLock | undefined)?.lock?.("landscape");
    })
    // Refused anywhere along the way: the CSS rotation is already on screen.
    .catch(() => {})
    .finally(emit);
}

/**
 * Turn it off. `fromBack` when the back button already consumed the history
 * mark — popping it again would leave the page.
 */
export function exitPlayerLandscape({ fromBack = false }: { fromBack?: boolean } = {}): void {
  if (!open) return;
  open = false;
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* No lock to release. */
  }
  if (ownFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  ownFullscreen = false;
  if (!fromBack) window.dispatchEvent(new Event("player-landscape-close"));
  emit();
}

/**
 * The system took our fullscreen away (Android's back gesture, the app going
 * to the background): leave the mode altogether rather than fall back to the
 * rotated box the person was just trying to get out of.
 */
export function onFullscreenLost(): void {
  if (ownFullscreen && !document.fullscreenElement) {
    ownFullscreen = false;
    exitPlayerLandscape();
  }
}

/**
 * The box the player fills in this mode, for a viewport of `vw` × `vh`.
 *
 * Already landscape (the lock worked, or the phone is on its side): the whole
 * viewport. Portrait: a box as wide as the screen is tall, turned 90° clockwise
 * about its top-left corner and slid right by the screen's width, so it covers
 * the portrait screen exactly — the picture's top edge along the right side of
 * the phone, which is how a phone is held when its top is turned to the left.
 */
export function landscapeBox(vw: number, vh: number): {
  width: number;
  height: number;
  rotated: boolean;
  /** Horizontal shift applied after the rotation, in px. */
  shiftX: number;
} {
  if (vw >= vh) return { width: vw, height: vh, rotated: false, shiftX: 0 };
  return { width: vh, height: vw, rotated: true, shiftX: vw };
}
