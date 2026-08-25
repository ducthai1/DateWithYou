"use client";

import Link from "next/link";
import { Search } from "lucide-react";

/**
 * Entry point to search from the app's hub.
 *
 * Search lives in the desktop sidebar, but the mobile top bar already carries
 * four 40px targets next to the wordmark — a fifth would squeeze the brand to
 * nothing at 390px. Putting the affordance here instead is also the better
 * placement: the couple is already on the screen that answers "what now?",
 * and this answers "where did we put that?".
 *
 * Rendered as a link styled like a search field rather than an actual input,
 * so tapping it navigates straight to the real search screen with its own
 * focus handling instead of duplicating the query state in two places.
 */
export function HomeSearchLink() {
  return (
    <Link
      href="/search"
      className="border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground focus-visible:ring-ring/50 flex h-11 w-full items-center gap-2.5 rounded-xl border px-3.5 text-[15px] outline-none transition-colors focus-visible:ring-2"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Tìm kỷ niệm, quán, công thức…</span>
    </Link>
  );
}
