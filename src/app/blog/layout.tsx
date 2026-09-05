import type { ReactNode } from "react";

/**
 * A clean, opaque surface for the blog, above the app's landing backdrop.
 *
 * The backdrop is mounted app-wide and reads as texture behind the home
 * screens; behind long-form article text it is noise. This lays a solid ground
 * over it for the whole blog section, so a reader gets plain contrast and the
 * cards/hero still sit on something calm.
 */
export default function BlogLayout({ children }: { children: ReactNode }) {
  return <div className="bg-background relative z-[1] min-h-[100dvh]">{children}</div>;
}
