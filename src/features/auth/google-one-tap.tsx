"use client";

import { useEffect, useRef } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { POST_LOGIN_REDIRECT } from "@/components/layout/nav-items";

/**
 * Shows the Google One Tap prompt app-wide whenever no one is signed in.
 * Renders nothing — it just fires the prompt once per mount. On success Better
 * Auth signs the user in and redirects to POST_LOGIN_REDIRECT, where SpaceGuard
 * decides between the app and /onboarding (same path as the Google button).
 */
export function GoogleOneTap() {
  const { data: session, isPending } = useSession();
  const fired = useRef(false);

  useEffect(() => {
    // Wait for the session check; skip if signed in, already fired, or the
    // public client id isn't configured (prompt can't init without it).
    if (isPending || session || fired.current) return;
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return;

    fired.current = true;
    // One Tap silently no-ops when dismissed, on cooldown, or unsupported
    // (e.g. some incognito sessions) — swallow so it never surfaces an error.
    authClient.oneTap({ callbackURL: POST_LOGIN_REDIRECT }).catch(() => {});
  }, [session, isPending]);

  return null;
}
