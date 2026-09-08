/**
 * How wide the public site's content column is allowed to get.
 *
 * One string, used by the blog pages, their loading skeletons, the blog header
 * and the site footer, so every one of them lines up on the same left and
 * right edge. Kept as a literal (Tailwind scans source text, so the arbitrary
 * values here are generated) rather than assembled at runtime.
 *
 * It grows in two steps above the standard breakpoints because at 2560px a
 * 72rem column left ~520px of empty page on each side, and the side column —
 * the contents rail, "Đọc nhiều" — was truncating and wrapping titles while
 * that space went unused. The article's own measure stays readable: the extra
 * width goes to the side column (see the grid definitions on each page), not
 * into longer lines of prose.
 */
export const SITE_WIDTH = "max-w-6xl xl:max-w-[82rem] 2xl:max-w-[94rem]";
