"use client";

import { useSyncExternalStore } from "react";
import { isPlayerLandscapeOpen, subscribePlayerLandscape } from "@/lib/player-landscape";

/** Whether the player is in its landscape mode — see `@/lib/player-landscape`. */
export function usePlayerLandscape(): boolean {
  return useSyncExternalStore(subscribePlayerLandscape, isPlayerLandscapeOpen, () => false);
}
