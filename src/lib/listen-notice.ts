/**
 * What the other person just did, in words — and when following them should
 * move this player at all.
 *
 * Chủ repo (26/10): when the other person pauses or seeks, the screen has to
 * say it was THEM — otherwise a pause reads as a hang and a jump reads as the
 * network acting up. And a jump caused by this phone's own lag (catching up)
 * has to be told apart from one the other person made.
 *
 * Pure, so node can test it; the dock shows it.
 */

/** What one shared state says, reduced to what a person would notice changing. */
export type ListenSubstance = {
  isPlaying: boolean;
  index: number;
  epoch: number;
};

export type PartnerAction =
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "seek"; to: number; forward: boolean }
  | { kind: "track"; title: string };

/**
 * The action a newly delivered COMMAND stands for, compared with the last one
 * followed. A track change outranks a pause, and a pause or resume outranks the
 * position that came with it — "Ngọc paused" is what happened, the playhead
 * moving to where they paused is a detail. A command that changes none of the
 * three is a seek; within `SEEK_NOTICE_SEC` of where this player already is,
 * it is not worth a word.
 */
export function partnerAction(
  prev: ListenSubstance | null,
  next: ListenSubstance & { positionSec: number; trackTitle: string },
  myPositionSec: number,
): PartnerAction | null {
  if (!prev || prev.epoch === next.epoch) return null;
  if (prev.index !== next.index) return { kind: "track", title: next.trackTitle };
  if (prev.isPlaying && !next.isPlaying) return { kind: "pause" };
  if (!prev.isPlaying && next.isPlaying) return { kind: "resume" };
  const delta = next.positionSec - myPositionSec;
  if (Math.abs(delta) < SEEK_NOTICE_SEC) return null;
  return { kind: "seek", to: next.positionSec, forward: delta > 0 };
}

/** Below this, a command's position is the same place as far as anyone can hear. */
export const SEEK_NOTICE_SEC = 1.5;

/** "1:05", "12:40", "1:02:03". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function noticeText(action: PartnerAction, name: string): string {
  switch (action.kind) {
    case "pause":
      return `${name} vừa tạm dừng`;
    case "resume":
      return `${name} vừa phát tiếp`;
    case "seek":
      return `${name} vừa ${action.forward ? "tua tới" : "tua lại"} ${clock(action.to)}`;
    case "track":
      return `${name} chuyển sang “${action.title}”`;
  }
}

/**
 * Where to move this player to follow a state, or null to leave it alone.
 *
 * A COMMAND is followed both ways, tightly: the other person chose that point.
 * A REFRESH — the other phone writing down where it is — only ever pulls this
 * player FORWARD. Following it backwards was a tug of war whenever one phone
 * buffered: the slow phone's refresh dragged the fast one back to it, the fast
 * one's refresh then dragged the slow one forward, and both jumped every 15 s.
 * Forward only, they meet at the one that is ahead, and nobody hears a jump
 * backwards that nobody asked for.
 */
export function followTarget(
  myPositionSec: number,
  wantSec: number,
  { command, commandTolerance, driftTolerance }: { command: boolean; commandTolerance: number; driftTolerance: number },
): number | null {
  const behind = wantSec - myPositionSec;
  if (command) return Math.abs(behind) > commandTolerance ? wantSec : null;
  return behind > driftTolerance ? wantSec : null;
}
