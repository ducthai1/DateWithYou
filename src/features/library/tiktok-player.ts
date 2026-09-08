import { TIKTOK_ORIGIN } from "@/lib/embed";

/**
 * Talking to a TikTok embed frame.
 *
 * TikTok's player answers a postMessage protocol of its own — nothing like
 * YouTube's, which is why this lives apart from use-youtube-playback rather
 * than being folded into it: one envelope shape, one set of event names and
 * one set of error codes each, and a change to either must not be able to
 * disturb the other. Commands and events share the envelope
 * `{ type, value, "x-tiktok-player": true }`.
 *
 * See developers.tiktok.com/doc/embed-player.
 */

/** What the player reports about itself. */
export const TIKTOK_STATE = {
  INIT: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
} as const;

/** The post is gone, or the id was never a post. */
export const TIKTOK_INVALID_VIDEO = 1001;
/**
 * The browser refused to start it. Expected, not exceptional: a page opened
 * from a link has no gesture behind it, and no browser will play sound for a
 * page nobody has touched. The answer is to mute and start again, which is
 * what TikTok's own site does.
 */
export const TIKTOK_AUTOPLAY_BLOCKED = 3002;

/*
 * Commands are not used, and this is the note explaining why.
 *
 * The documented host-to-player commands (play, pause, mute, seekTo) were
 * measured against the live player and are inert: sent as an object and as
 * JSON text, to the exact origin and to "*", once and repeatedly for ten
 * seconds, the video never moved off its first frame and the player answered
 * nothing. `onPlayerReady` never arrives either — only `onPlayerError` does.
 * So playing, muting and looping are set through the URL instead, which is
 * plain HTTP and cannot fail quietly: see tiktokPlayerUrl. The frame is
 * remounted when what it should be doing changes.
 *
 * The event reader below stays, because errors DO arrive and a post that has
 * been taken down must say so rather than spin.
 */

export type TikTokEvent = {
  type: string;
  value: unknown;
};

/**
 * A message from THIS frame, or null.
 *
 * The sender is checked as strictly as the origin, and a missing window is a
 * refusal rather than a pass: a feed has several players alive at once, and
 * treating "I no longer have a window" as "anything from TikTok is mine"
 * attributed one taken-down post's error to every slide, so a whole feed of
 * good videos reported itself as gone.
 */
export function readPlayerEvent(
  e: MessageEvent,
  win: Window | null,
): TikTokEvent | null {
  if (e.origin !== TIKTOK_ORIGIN) return null;
  if (!win || e.source !== win) return null;
  /*
   * The envelope arrives as JSON text, not as an object — measured, and worth
   * saying because the documented example only ever shows the object form. A
   * reader that trusted the docs dropped every event silently: no ready, no
   * state, and an unplayable post sat on a spinner for ever instead of saying
   * so. Both shapes are accepted; a string that is not JSON is not for us.
   */
  const raw = e.data;
  let data: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    if (!raw.startsWith("{")) return null;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (raw && typeof raw === "object") {
    data = raw as Record<string, unknown>;
  }
  if (!data) return null;
  if (data["x-tiktok-player"] !== true) return null;
  const type = data.type;
  if (typeof type !== "string") return null;
  return { type, value: data.value };
}

export function playerErrorCode(value: unknown): number | null {
  const code = (value as { errorCode?: unknown } | null)?.errorCode;
  return typeof code === "number" ? code : null;
}
