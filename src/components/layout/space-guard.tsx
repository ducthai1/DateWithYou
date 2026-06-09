"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { NAV_HIDDEN_ON } from "./nav-items";

/**
 * Backstop guard: a signed-in user with no couple space is bounced to
 * /onboarding instead of landing on a feature page where every tRPC call would
 * 403 (NO_SPACE). Runs only on feature routes (those that show app chrome).
 * Renders nothing — it's a side-effect-only component placed in the layout.
 */
export function SpaceGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const needsSpace = !NAV_HIDDEN_ON.includes(pathname);

  const mine = trpc.space.getMine.useQuery(undefined, { enabled: needsSpace });

  useEffect(() => {
    // Only bounce on a SUCCESSFUL fetch that returned no space. On error,
    // data is undefined too — don't punish a transient failure with a redirect.
    if (needsSpace && mine.isSuccess && mine.data === null) {
      router.replace("/onboarding");
    }
  }, [needsSpace, mine.isSuccess, mine.data, router]);

  return null;
}
