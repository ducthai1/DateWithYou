"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils";
import { SITE_WIDTH } from "@/lib/site-width";

// Client-only: better-auth's useSession throws during server rendering.
const BlogHeaderAccount = dynamic(
  () => import("./blog-header-account").then((m) => m.BlogHeaderAccount),
  { ssr: false, loading: () => <span aria-hidden="true" className="bg-muted h-9 w-28 animate-pulse rounded-full" /> },
);

const NAV = [
  { href: "/", label: "Trang chủ" },
  { href: "/tinh-nang", label: "Tính năng" },
  { href: "/blog", label: "Blog" },
];

/**
 * The way back.
 *
 * The blog is public chrome: no sidebar, no bottom bar. Someone who followed
 * "Xem blog" from inside the app, or landed here from a search, had nothing
 * to press to get anywhere else. This header always offers the landing page
 * and — depending on whether they are signed in — the app or the sign-in.
 * Session is read on the client (see BlogHeaderAccount) so the pages
 * themselves stay static.
 */
export function BlogSiteHeader() {
  const pathname = usePathname();
  const onBlog = pathname === "/blog" || pathname.startsWith("/blog/");

  return (
    <header className="border-border/70 bg-card/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className={`mx-auto flex h-14 w-full ${SITE_WIDTH} items-center gap-3 px-4 sm:h-16`}>
        <Link href="/" aria-label="Về trang chủ Vivu No Plan" className="flex shrink-0 items-center">
          <BrandMark className="h-8 w-[5.5rem] sm:h-9 sm:w-[6.25rem]" />
        </Link>

        <nav aria-label="Trang" className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV.map((n) => {
            const active = n.href === "/blog" ? onBlog : pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BlogHeaderAccount />
        </div>
      </div>
    </header>
  );
}
