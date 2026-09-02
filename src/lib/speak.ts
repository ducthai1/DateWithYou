/**
 * Vietnamese turn-by-turn voice, through the browser's own speech engine.
 *
 * `speechSynthesis` rather than pre-recorded clips, because the useful half of
 * a spoken instruction is the part that cannot be recorded: the street name and
 * the distance right now. A clip library can say "rẽ phải" but never "rẽ phải
 * vào Nguyễn Thị Minh Khai", and stitching numbers out of fragments is how
 * satnavs of twenty years ago sounded. It is also free, offline, and already
 * installed on both platforms this app runs on.
 *
 * iOS needs the engine started inside a user gesture, exactly like audio — the
 * first `speak()` outside one is dropped and, on some versions, the queue stays
 * stuck afterwards. `primeSpeech()` gets that out of the way on the first tap.
 */

import { unlockAudio } from "@/lib/audio-session";

const STORAGE_KEY = "dwy:navVoice";

let primed = false;
let enabled = true;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/** Reads the saved preference. Defaults to on: a satnav that is silent by default is a map. */
export function loadVoicePreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function setVoiceEnabled(next: boolean): void {
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    /* a refused write only costs the preference, not the feature */
  }
  if (!next) synth()?.cancel();
}

export function isVoiceEnabled(): boolean {
  return enabled;
}

/** Start the engine while a gesture is still on the stack. Safe to call often. */
export function primeSpeech(): void {
  const s = synth();
  // The ringer switch mutes the speech engine too, so the session category has
  // to be dealt with on this same tap or the voice is silent for the whole ride.
  unlockAudio();
  if (!s || primed) return;
  primed = true;
  try {
    /*
     * A space at FULL volume, not a silent one.
     *
     * The first version used `volume = 0` on the theory that the unlock is
     * about having spoken at all. On a platform that decides whether to open
     * the audio route by looking at what is being asked for, an utterance that
     * asks for no sound is a poor thing to ask first. A single space produces
     * no audible output anyway — there is nothing in it to pronounce — so full
     * volume costs the rider nothing and asks the question properly.
     */
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 1;
    u.lang = "vi-VN";
    s.speak(u);
  } catch {
    primed = false;
  }
}

/*
 * The voice list, cached, because asking for it is not synchronous.
 *
 * `getVoices()` returns an EMPTY ARRAY until the engine has finished loading its
 * voices and fired `voiceschanged` — reliably so on a cold page in Chrome. Asked
 * for the Vietnamese voice at the moment of the first instruction, it therefore
 * answered "there isn't one", and the first turns of every ride were read out by
 * whatever English voice was default. Vietnamese read with English phonology is
 * not accented, it is unintelligible.
 *
 * So the list is captured on load and refreshed on the event, and `speak` uses
 * whatever is known by then.
 */
let voices: SpeechSynthesisVoice[] = [];

/*
 * What the engine last did, so a device can be asked instead of guessed about.
 *
 * There is no way to detect the ringer switch from a page, and a muted
 * utterance still reports start and end normally — so this cannot prove sound
 * came out. What it does separate is "the engine refused or errored" from "the
 * engine ran and something after it swallowed the sound", which is the fork
 * that decides whether to look at the code or at the side of the phone.
 */
export type SpeechAttempt = {
  requested: boolean;
  started: boolean;
  ended: boolean;
  error: string | null;
  voiceName: string | null;
};
let lastAttempt: SpeechAttempt = {
  requested: false, started: false, ended: false, error: null, voiceName: null,
};
export function lastSpeechAttempt(): SpeechAttempt {
  return { ...lastAttempt };
}

function refreshVoices(): void {
  const s = synth();
  if (!s) return;
  try {
    const list = s.getVoices();
    if (list.length) voices = list;
  } catch {
    /* leave the previous list in place */
  }
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

function vietnameseVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) refreshVoices();
  return (
    voices.find((v) => v.lang === "vi-VN") ??
    voices.find((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("vi")) ??
    null
  );
}

/**
 * Whether this device can actually pronounce Vietnamese.
 *
 * Worth knowing separately from "can it speak at all": a device with no
 * Vietnamese voice will still happily read the text in an English voice, which
 * sounds like nonsense rather than like a mistake, so the UI can say so instead
 * of leaving the rider wondering.
 */
export function hasVietnameseVoice(): boolean {
  return vietnameseVoice() != null;
}

/**
 * Say one instruction, replacing anything still queued.
 *
 * Replacing rather than queueing is the point: instructions go stale in seconds,
 * and a queue that reads out the turn before last while the junction goes past
 * is worse than saying nothing. There is only ever one current instruction.
 */
export function speak(text: string): void {
  const s = synth();
  if (!s || !enabled || !text) return;
  try {
    const busy = s.speaking || s.pending;
    if (busy) s.cancel();

    const utter = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "vi-VN";
      // Slightly brisk: instructions land while there is still time to act.
      u.rate = 1.05;
      u.pitch = 1;
      // Full volume. This is competing with an engine and traffic.
      u.volume = 1;
      const v = vietnameseVoice();
      if (v) u.voice = v;
      lastAttempt = {
        requested: true, started: false, ended: false, error: null,
        voiceName: v?.name ?? null,
      };
      u.onstart = () => { lastAttempt = { ...lastAttempt, started: true }; };
      u.onend = () => { lastAttempt = { ...lastAttempt, ended: true }; };
      u.onerror = (e) => {
        lastAttempt = { ...lastAttempt, error: e.error || "unknown" };
      };
      s.speak(u);
      // A queue left paused by a previous cancel, or by the tab having been
      // hidden, accepts utterances and never plays them.
      if (s.paused) s.resume();
    };

    /*
     * Deferred ONLY when something was actually cancelled.
     *
     * `cancel()` immediately followed by `speak()` is dropped outright by
     * Chrome — the cancel tears down the queue the new utterance was just put
     * into — so a yield is needed there. But it used to yield unconditionally,
     * and that is what kept iOS silent: iOS wants the FIRST utterance of a
     * visit spoken while a user gesture is still on the stack, and a
     * `setTimeout` is by definition after it. So the very announcement that
     * would have opened the audio route — the one fired by the tap that starts
     * the ride — was the one guaranteed to arrive too late.
     *
     * Nothing queued means nothing to cancel, means no reason to yield.
     */
    if (busy) setTimeout(utter, 0);
    else utter();
  } catch {
    /* speech is an enhancement; the banner still says it */
  }
}
