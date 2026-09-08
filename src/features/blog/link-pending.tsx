"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * The instant answer to a click.
 *
 * A blog page is rendered on the server; on a cold start or a slow line the
 * click did nothing visible for a second or two, and people pressed again and
 * again thinking it had missed. `useLinkStatus` knows a navigation is in
 * flight the moment the link is pressed, so this shows a spinner over the
 * card until the new page takes over. Must sit INSIDE the <Link>.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      role="status"
      aria-label="Đang mở…"
      className={`bg-card/70 pointer-events-none absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px] ${className}`}
    >
      <span className="bg-card text-accent flex h-10 w-10 items-center justify-center rounded-full shadow-md">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </span>
    </span>
  );
}
