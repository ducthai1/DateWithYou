/**
 * Buzz the device, on whichever of the three mechanisms this browser has.
 *
 * `navigator.vibrate` does not exist on iOS and never has — WebKit has declined
 * to ship the Vibration API, so every `navigator.vibrate(...)` call in an iPhone
 * browser is a silent no-op. That is why a ping sent from Android buzzed the
 * other Android phone and only drew a banner on the iPhone.
 *
 * Three layers, tried in order:
 *
 *   1. The Vibration API. Android and desktop Chrome. Exact patterns, no
 *      permission, no gesture needed.
 *   2. iOS's switch haptic. Since iOS 17.4 a checkbox with the `switch`
 *      attribute produces a haptic tap when it toggles, and toggling one from
 *      script produces the same tap. It is the only route to the Taptic Engine
 *      from a web page. The element has to be really in the layout — a
 *      `display:none` control fires nothing — so it lives off-screen at 1x1 and
 *      fully transparent.
 *   3. A short tone. Not a haptic, but it is the one attention signal that works
 *      on every iPhone regardless of version, and a phone in a pocket is
 *      noticed by sound as readily as by vibration. Only used for the urgent
 *      case, and only when neither of the above was available — a beep for
 *      every small ping would be worse than silence.
 *
 * Honest limit: iOS gives a page no reliable way to buzz outside a user
 * gesture. Layer 2 is at its best right after a tap and may do nothing when a
 * ping arrives while the phone is idle. The mechanism iOS does guarantee for
 * that case is a Web Push notification from an installed PWA, which needs a
 * service-worker push handler and VAPID keys — see the note in CLAUDE.md.
 */

import { unlockAudio } from "@/lib/audio-session";

/** Milliseconds: [buzz, pause, buzz, …] — the Vibration API's own shape. */
export type BuzzPattern = number | number[];

let switchLabel: HTMLLabelElement | null = null;

/**
 * The off-screen switch whose toggle iOS answers with a haptic tap.
 *
 * Returns the LABEL, not the input, and that distinction is the whole fix:
 * WebKit produces the haptic from the label's activation behaviour, so a click
 * dispatched straight at the input never reaches the code that buzzes. The page
 * was toggling the switch correctly and getting nothing, which is why every
 * layer above reported success while the phone stayed still.
 */
function iosSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (switchLabel?.isConnected) return switchLabel;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  /*
   * Pushed off-screen rather than made transparent.
   *
   * WebKit produces the haptic as part of the switch's own activation
   * behaviour, and a control it has decided not to paint is the likeliest thing
   * to be skipped. `opacity:0` still occupies the corner of the viewport, so
   * this moves it out of sight while leaving it a real, laid-out control.
   */
  label.style.cssText =
    "position:fixed;left:-9999px;top:0;width:24px;height:24px;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  // Not a React prop and not in the HTML types — the attribute is what iOS reads.
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.body.appendChild(label);
  switchLabel = label;
  return label;
}

/** True when the page is running under WebKit on an Apple touch device. */
function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so the touch-point count is what
  // separates an iPad from a desktop Safari.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

let audioCtx: AudioContext | null = null;

/**
 * Prepare the tone while a gesture is still on the stack.
 *
 * An AudioContext created outside a user gesture starts suspended on iOS and
 * cannot be resumed later, so the one chance to make later sounds possible is
 * during a tap the person has already made. Safe to call as often as you like.
 */
export function primeHaptics(): void {
  if (typeof window === "undefined" || audioCtx) return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    audioCtx = new Ctor();
    void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
  // Toggling the switch once here also gets iOS to accept it later in the visit.
  iosSwitch();
  // Same tap, same one chance: the ringer switch mutes the tone below unless
  // the page has moved itself into a playback audio session.
  unlockAudio();
}

function tone(): boolean {
  if (!audioCtx || audioCtx.state !== "running") return false;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    // Shaped, not switched: a square-edged gain change clicks audibly.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.28);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
    return true;
  } catch {
    return false;
  }
}

/**
 * Buzz, by whatever means this device has.
 *
 * `urgent` allows the audible fallback; leave it off for small confirmations.
 * Returns what actually happened, so a caller can lean harder on its visuals
 * when nothing did.
 */
export function buzz(
  pattern: BuzzPattern,
  { urgent = false }: { urgent?: boolean } = {},
): "vibrate" | "haptic" | "haptic+sound" | "sound" | "none" {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    // Reports false when the page is hidden or the platform refuses.
    if (navigator.vibrate(pattern)) return "vibrate";
  }

  if (isIosLike()) {
    const label = iosSwitch();
    if (label) {
      // One tap per "on" phase of the pattern, at the pattern's own timings.
      const phases = Array.isArray(pattern) ? pattern : [pattern];
      let at = 0;
      phases.forEach((ms, i) => {
        if (i % 2 === 0) {
          const delay = at;
          setTimeout(() => {
            /*
             * The label, and `.click()` and nothing else.
             *
             * Two separate mistakes lived on this line. The first set `checked`
             * by hand before clicking, which cancelled the change the click was
             * about to make — the haptic comes from the state change, not from
             * the call. The second clicked the input directly: WebKit fires the
             * haptic from the LABEL's activation behaviour, so a click aimed at
             * the input toggles the switch and buzzes nothing.
             */
            label.click();
          }, delay);
        }
        at += ms;
      });

      /*
       * Sound as well, not instead.
       *
       * There is no way to ask iOS whether the haptic actually fired, and this
       * function previously returned "haptic" here and so never reached the
       * audible fallback — meaning on an iPhone where the switch trick does
       * nothing (an older iOS, or a ping arriving with no gesture behind it)
       * an urgent signal produced nothing at all. For something meant to reach
       * someone who is not looking at the screen, doing both is the only honest
       * answer.
       */
      if (urgent) {
        const sounded = tone();
        return sounded ? "haptic+sound" : "haptic";
      }
      return "haptic";
    }
  }

  if (urgent && tone()) return "sound";
  return "none";
}
