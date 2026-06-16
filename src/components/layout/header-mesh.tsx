// Decorative gradient wash that sits behind a screen title.
// Reads --gradient-from / --gradient-to from the active theme preset so it
// stays automatically in sync with the user's chosen palette — no hardcoded
// colours. Kept pointer-events-none + aria-hidden so it's purely decorative.

interface HeaderMeshProps {
  className?: string;
}

/**
 * Lightweight blurred gradient panel. Place as the first child of your title
 * row's containing div, then position title text above it with `relative z-10`.
 *
 * The wash is intentionally very low-opacity and blurred so it reads as
 * "light" — a soft depth hint, not a bold background block.
 */
export function HeaderMesh({ className }: HeaderMeshProps) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        // Radial gradient from theme preset colours — centre-left weighted.
        background:
          "radial-gradient(ellipse 80% 100% at 20% 50%, var(--gradient-from, hsl(20 60% 90%)) 0%, var(--gradient-to, transparent) 70%)",
        opacity: 0.18,
        filter: "blur(24px)",
        borderRadius: "inherit",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
