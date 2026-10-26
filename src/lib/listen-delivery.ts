/**
 * Whether a stream connection should tell its client about the shared
 * playback, and what it remembers afterwards — one poll's decision, pure, so
 * node can test it.
 *
 * Two kinds of write reach the session document. A COMMAND (a pause, a resume,
 * a seek, a skip done by a hand) bumps `epoch` and names `commandBy`. A REFRESH
 * (the position each phone writes down every 15 s) changes `stateAt` and
 * `updatedBy` only, and the server refuses one taken before the latest command.
 *
 * Commands used to be recognised by their substance — playing or not, which
 * track — and a seek changes neither. So a seek was only delivered if nothing
 * else had been written in between, and the other phone's refresh usually had
 * been: the seek never arrived, and the phone that made it was then dragged
 * back to the other's old position. Keying on the epoch makes every command
 * news, a seek included.
 */

export type ListenTracker = {
  /** The epoch this connection last accounted for; null on a fresh connection. */
  epoch: number | null;
  /** The `stateAt` (ms) of the last write accounted for. */
  stateAt: number;
};

export type ListenWrite = {
  epoch?: number | null;
  commandBy?: string | null;
  updatedBy: string;
  stateAtMs: number;
};

export const FRESH_TRACKER: ListenTracker = { epoch: null, stateAt: 0 };

export function listenDelivery(
  prev: ListenTracker,
  doc: ListenWrite,
  userId: string,
): { send: boolean; next: ListenTracker } {
  const epoch = doc.epoch ?? 0;
  // A session written before epochs existed knows only who wrote last.
  const commander = doc.commandBy ?? doc.updatedBy;
  const next = { epoch, stateAt: Math.max(prev.stateAt, doc.stateAtMs) };

  if (epoch !== prev.epoch) {
    /*
     * A command this client has not been told about. The partner's goes out;
     * the client's own is absorbed — echoing a command back to whoever gave it
     * is how a seek war starts: their own position arrives a beat late, they
     * jump back to it, that is a new command, and so on.
     */
    return { send: commander !== userId, next };
  }
  if (doc.stateAtMs > prev.stateAt) {
    // A refresh. The partner's playhead is how a follower notices drift; a
    // client's own refresh is nothing it does not already know.
    return { send: doc.updatedBy !== userId, next };
  }
  return { send: false, next: prev };
}

/**
 * Whether a refresh may be written over the session.
 *
 * Only by someone who has already followed the latest command: a refresh
 * stamped with an older epoch was read off a player that has not heard about
 * that command yet, and writing it would undo the command for both people.
 * A client that predates epochs sends none, and keeps the old behaviour.
 */
export function refreshAccepted(docEpoch: number | null | undefined, refreshEpoch: number | undefined): boolean {
  return refreshEpoch === undefined || refreshEpoch === (docEpoch ?? 0);
}

/** Whether the other person is looking at the player, as the stream tells it. */
export type PartnerPresence = { away: boolean; kind: "hidden" | "blur" | null };

/**
 * Whether a stream connection should pass on the other person's presence, and
 * what it remembers. Every change goes out once; a fresh connection (no `prev`)
 * passes on whatever is recorded, so a page opened while the other person is
 * away learns it straight away. Nothing recorded, nothing said.
 */
export function presenceDelivery(
  prev: string | null,
  entry: unknown,
): { send: PartnerPresence | null; key: string | null } {
  const e = entry as { away?: unknown; kind?: unknown; at?: unknown } | null | undefined;
  if (!e || typeof e.away !== "boolean") return { send: null, key: prev };
  const kind = e.kind === "hidden" || e.kind === "blur" ? e.kind : null;
  const at = e.at ? new Date(e.at as string | Date).getTime() : 0;
  const key = `${e.away}:${kind}:${at}`;
  if (key === prev) return { send: null, key };
  return { send: { away: e.away, kind: e.away ? (kind ?? "hidden") : null }, key };
}
