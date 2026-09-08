"use client";

import { useSyncExternalStore } from "react";

/**
 * "Stop the music" — one page asking the floating player to pause.
 *
 * The TikTok feed needs it: it plays sound of its own, and two things playing
 * at once is not a feature. It cannot simply reach into the player, because
 * the frame belongs to the dock and only the dock can talk to it — so this is
 * a request, counted rather than flagged, so that a second request while the
 * dock is already paused is still a distinct event and the dock can tell the
 * difference between "asked once" and "asked again".
 *
 * Deliberately one-way. Resuming afterwards is not offered: coming back from a
 * feed to music that starts itself is startling, and the dock's play button is
 * right there.
 */
let ticket = 0;
const subscribers = new Set<() => void>();

export function requestPlayerPause(): void {
  ticket += 1;
  subscribers.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function usePlayerPauseTicket(): number {
  return useSyncExternalStore(
    subscribe,
    () => ticket,
    () => 0,
  );
}
