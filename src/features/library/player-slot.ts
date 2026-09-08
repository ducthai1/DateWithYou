"use client";

import { useSyncExternalStore } from "react";

/**
 * Where on the page the player should sit, if anywhere.
 *
 * The YouTube frame lives in one place for the whole session — the floating
 * dock, portalled to <body> — because moving or remounting an iframe reloads
 * it, and a reload restarts the song and breaks a shared listening session.
 * So a page that wants the video "in" its layout does not render a player; it
 * renders an empty box and registers it here, and the dock lays itself over
 * that box for as long as it exists. Unregister (navigate away) and the dock
 * floats again, with the same frame still playing.
 */
let slot: HTMLElement | null = null;
const subscribers = new Set<() => void>();

export function setPlayerSlot(el: HTMLElement | null) {
  if (slot === el) return;
  slot = el;
  subscribers.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function usePlayerSlot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => slot, () => null);
}
