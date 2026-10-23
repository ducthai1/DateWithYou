/**
 * Where the page's scroll box was when the tab last left a page, so a reload
 * can put it back.
 *
 * The browser restores the WINDOW's scroll on reload, but no screen here
 * scrolls the window: PageShell gives each one its own scroll box, which the
 * browser knows nothing about, so every reload landed at the top. Pure so node
 * can test the decision; `@/components/layout/scroll-memory` does the DOM part.
 */

export type SavedScroll = { href: string; top: number };

export function parseSavedScroll(raw: string | null): SavedScroll | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedScroll>;
    return typeof v.href === "string" && typeof v.top === "number" && Number.isFinite(v.top)
      ? { href: v.href, top: v.top }
      : null;
  } catch {
    return null;
  }
}

/**
 * The scrollTop to restore, or null to leave the page at the top.
 *
 * Only a reload of the very same address restores. Arriving by a link, by the
 * nav or by typing the URL is a fresh visit and starts at the top, and a saved
 * position from another page or another tab of this one means nothing here.
 */
export function scrollToRestore(
  saved: SavedScroll | null,
  href: string,
  navigationType: string | undefined,
): number | null {
  if (navigationType !== "reload" || !saved || saved.href !== href) return null;
  return saved.top > 0 ? saved.top : null;
}
