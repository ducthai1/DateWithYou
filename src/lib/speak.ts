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

function vietnameseVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = s.getVoices();
  return (
    voices.find((v) => v.lang === "vi-VN") ??
    voices.find((v) => v.lang?.toLowerCase().startsWith("vi")) ??
    null
  );
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
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    // Slightly brisk: instructions land while there is still time to act on them.
    u.rate = 1.05;
    u.pitch = 1;
    const v = vietnameseVoice(s);
    if (v) u.voice = v;
    s.speak(u);
  } catch {
    /* speech is an enhancement; the banner still says it */
  }
}
