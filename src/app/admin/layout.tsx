import type { ReactNode } from "react";

/** An opaque ground for the admin area, above the app's landing backdrop —
 *  the same reason the blog has one: forms and lists read better on a calm
 *  surface than on the home-screen texture. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="bg-background relative z-[1] min-h-[100dvh]">{children}</div>;
}
