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
        defaultOptions: { queries: { staleTime: 30_000 } },
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
