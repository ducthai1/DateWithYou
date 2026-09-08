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
/*
 * "A slot is on its way": set by the card the moment Phát is pressed, before
 * the watch page has mounted. Without it the dock appeared floating in the
 * corner for the few hundred milliseconds the navigation took and then slid
 * into place — a flash of the wrong thing before the right one. While this is
 * set and no slot exists yet, the dock stays invisible. It clears when a slot
 * registers, or on a timer if the page never arrives (offline, an error), so
 * the music is never stuck in an invisible player.
 */
let expecting = false;
let expectTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

export function setPlayerSlot(el: HTMLElement | null) {
  if (el && expecting) {
    expecting = false;
    if (expectTimer) clearTimeout(expectTimer);
    expectTimer = null;
  }
  if (slot === el) return;
  slot = el;
  notify();
}

export function expectPlayerSlot(withinMs = 4000) {
  expecting = true;
  if (expectTimer) clearTimeout(expectTimer);
  expectTimer = setTimeout(() => {
    expecting = false;
    expectTimer = null;
    notify();
  }, withinMs);
  notify();
}

export function usePlayerSlotExpected(): boolean {
  return useSyncExternalStore(subscribe, () => expecting, () => false);
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
