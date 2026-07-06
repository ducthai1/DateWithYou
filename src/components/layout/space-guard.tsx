"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { NAV_HIDDEN_ON } from "./nav-items";
import { useSession } from "@/lib/auth-client";

/**
 * Backstop guard: a signed-in user with no couple space is bounced to
 * /onboarding instead of landing on a feature page where every tRPC call would
 * 403 (NO_SPACE). Runs only on feature routes (those that show app chrome).
 * Renders nothing — it's a side-effect-only component placed in the layout.
 *
 * The query is keyed to the current session user ID so that switching accounts
 * (logout → login) always triggers a fresh fetch instead of serving stale cache
 * from the previous user — that stale hit was the cause of the "flash of full
 * app UI before redirect to onboarding" bug.
 */
export function SpaceGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const needsSpace = !NAV_HIDDEN_ON.includes(pathname);
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const mine = trpc.space.getMine.useQuery(undefined, {
    enabled: needsSpace && !!userId,
    // When the userId changes (account switch), invalidate any stale cache
    // from the previous user. queryKey stays the same (tRPC auto-keys by
    // procedure), but React Query will still serve stale data until refetch
    // completes. `placeholderData` being `undefined` + checking `isFetched`
    // prevents the flash.
  });

  useEffect(() => {
    // Only bounce on a SUCCESSFUL fetch that returned no space. On error,
    // data is undefined too — don't punish a transient failure with a redirect.
    // Also check `isFetched` (not just `isSuccess`) to avoid acting on stale
    // cache from a previous user — `isSuccess` is true for cached data too.
    if (needsSpace && mine.isFetched && mine.isSuccess && mine.data === null) {
      router.replace("/onboarding");
    }
  }, [needsSpace, mine.isFetched, mine.isSuccess, mine.data, router]);

  return null;
}
