"use client";

import { useState } from "react";
import { MotionConfig } from "framer-motion";
import dynamic from "next/dynamic";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ToastProvider } from "@/components/ui/toast";
import { PhotoProvider } from "react-photo-view";

// One Tap is browser-only (Google script + useSession). Load it client-side
// with ssr:false so it never prerenders on the server — useSession throws
// during static generation of pages like /_not-found otherwise.
const GoogleOneTap = dynamic(
  () => import("@/features/auth/google-one-tap").then((m) => m.GoogleOneTap),
  { ssr: false },
);

// SpaceGuard has the same constraint and is mounted here rather than in the
// (server) root layout, which cannot use `ssr: false`. It calls useSession too,
// so server-rendering it threw "Cannot read properties of null (reading
// 'useRef')" — and because it sits in the layout, that error escaped the whole
// tree and every single route answered HTTP 500. It renders null, so skipping
// the server pass costs nothing visually.
const SpaceGuard = dynamic(
  () => import("@/components/layout/space-guard").then((m) => m.SpaceGuard),
  { ssr: false },
);


/*
 * Recovery for the STALE_SPACE refusal.
 *
 * protectedProcedure now refuses outright when the active_space_id cookie names
 * a space the user does not belong to, instead of silently writing into an
 * arbitrary one. That is the correct server behaviour, but on its own it would
 * brick the app: every query and mutation fails at once and nothing clears the
 * bad cookie.
 *
 * Dropping the cookie puts the request back on the "no cookie at all" path,
 * where the server legitimately defaults to a space the user does belong to.
 * One reload then repairs the session. The sessionStorage latch means a
 * PRECONDITION_FAILED coming from anywhere else can never turn into a reload
 * loop — we retry the repair exactly once per tab.
 */
const STALE_SPACE_LATCH = "vivu:stale-space-recovered";

function recoverFromStaleSpace(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  if (!message.includes("STALE_SPACE")) return;

  try {
    if (sessionStorage.getItem(STALE_SPACE_LATCH)) return;
    sessionStorage.setItem(STALE_SPACE_LATCH, "1");
  } catch {
    // Private mode / storage disabled: fall through and still repair once.
    // Worst case is a single extra reload, which is better than a dead app.
  }

  document.cookie = "active_space_id=; path=/; max-age=0";
  window.location.reload();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: recoverFromStaleSpace }),
        mutationCache: new MutationCache({ onError: recoverFromStaleSpace }),
        defaultOptions: {
          queries: {
            // Couple data changes rarely and only from two people, so treat
            // cached data as fresh for a while: re-visiting a screen renders
            // instantly from cache instead of showing a spinner + waiting on a
            // remote-Atlas round-trip. Background refetch still keeps it current.
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            // Don't re-hit the API every time the tab regains focus — on a slow
            // serverless+Atlas path that caused visible reload flicker.
            refetchOnWindowFocus: false,
            // Fail fast: 3 retries on a ~1s call compounds into multi-second
            // stalls. One retry rides out a transient blip without piling up.
            retry: 1,
          },
          // Mutations shouldn't silently retry — optimistic UI already reflects
          // the change; surface errors fast so the optimistic state rolls back.
          mutations: { retry: 0 },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    /*
     * reducedMotion="user" makes every motion.* in the tree honour the
     * operating system's "reduce motion" setting.
     *
     * globals.css already flattens CSS transitions and animations for that
     * setting, but it cannot reach animation driven from JavaScript — and 21
     * of the 23 files using framer-motion never called useReducedMotion, so
     * they kept moving for people who had asked everything to stop. One
     * provider covers all of them.
     */
    <MotionConfig reducedMotion="user">
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PhotoProvider maskOpacity={0.8} speed={() => 300}>
          <SidebarProvider>
            <ToastProvider>
              <GoogleOneTap />
              <SpaceGuard />
              {children}
            </ToastProvider>
          </SidebarProvider>
        </PhotoProvider>
      </QueryClientProvider>
    </trpc.Provider>
    </MotionConfig>
  );
}
