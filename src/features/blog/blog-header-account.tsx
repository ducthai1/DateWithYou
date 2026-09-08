"use client";

import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { useSession } from "@/lib/auth-client";

/**
 * The right-hand side of the blog header: the app for a signed-in reader, the
 * doors in for a guest. Its own file because `useSession` cannot run during
 * server rendering (see the note on SpaceGuard in providers.tsx) — the header
 * loads this with `ssr: false` and keeps a same-sized placeholder meanwhile.
 */
export function BlogHeaderAccount() {
  const { data: session, isPending } = useSession();
  if (isPending) return <span aria-hidden="true" className="bg-muted h-9 w-28 animate-pulse rounded-full" />;
  if (session) {
    return (
      <Link
        href="/home"
        className="bg-accent inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-px"
      >
        Mở ứng dụng <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }
  return (
    <>
      <Link
        href="/sign-in"
        className="text-muted-foreground hover:text-foreground hidden h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium sm:inline-flex"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" /> Đăng nhập
      </Link>
      <Link
        href="/sign-up"
        className="bg-accent inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-px"
      >
        Tạo tài khoản
      </Link>
    </>
  );
}
