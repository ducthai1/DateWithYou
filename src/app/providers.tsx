"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { SidebarProvider } from "@/components/layout/sidebar-context";

// One Tap is browser-only (Google script + useSession). Load it client-side
// with ssr:false so it never prerenders on the server — useSession throws
// during static generation of pages like /_not-found otherwise.
const GoogleOneTap = dynamic(
  () => import("@/features/auth/google-one-tap").then((m) => m.GoogleOneTap),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <GoogleOneTap />
          {children}
        </SidebarProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
