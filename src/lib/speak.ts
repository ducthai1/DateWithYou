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
  if (!s || primed) return;
  primed = true;
  try {
    // An empty string is rejected by some engines; a space is spoken as nothing.
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
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
    s.cancel();

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
      s.speak(u);
      // A queue left paused by a previous cancel, or by the tab having been
      // hidden, accepts utterances and never plays them.
      if (s.paused) s.resume();
    };

    /*
     * One tick after the cancel, not in the same one.
     *
     * `cancel()` immediately followed by `speak()` is dropped outright by
     * Chrome — a long-standing quirk where the cancel tears down the queue the
     * new utterance was just put into. Yielding first is the accepted way
     * around it, and at these intervals the delay is imperceptible.
     */
    setTimeout(utter, 0);
  } catch {
    /* speech is an enhancement; the banner still says it */
  }
}
