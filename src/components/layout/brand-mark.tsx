/**
 * The Vivu "V" lettermark (with a small wander sparkle), drawn in currentColor
 * so it pairs with the accent wordmark in the header / sidebar. This is the same
 * glyph as the app icon (src/app/icon.svg) so the brand reads consistently from
 * the browser tab to inside the app.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path
        d="M17 18 L32 47 L47 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M48 11.5 C48 14.8 49.2 16 52.5 16 C49.2 16 48 17.2 48 20.5 C48 17.2 46.8 16 43.5 16 C46.8 16 48 14.8 48 11.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
