"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isPublicChrome } from "@/components/layout/nav-items";
import { trpc } from "@/lib/trpc";
import { useNavigationInvitesContext } from "@/features/locations/navigation-invites-context";
import type { ListenState, ListenTrack } from "@/features/locations/use-navigation-invites";

/**
 * The shared-listening session, from the client's side.
 *
 * Everything that needs a server round trip or the SSE stream lives here, so
 * the dock is left with what it is actually good at: driving one iframe.
 *
 * The transport is the stream the app already runs for "Cùng khởi hành"
 * (/api/navigation-invites/stream). Nothing new was opened — a second
 * EventSource per tab would have doubled the connections for a feature that
 * fits in the one already there.
 */

/**
 * Where a follower should be right now.
 *
 * Two clocks are deliberately absent from this: the server said how OLD its
 * reading was rather than when it was taken, and the only local clock used is
 * the difference between two `Date.now()` readings on the same device. Two
 * phones in one space routinely disagree by minutes, and an implementation
 * that added a server timestamp to a local clock would seek to a completely
 * different part of the song.
 */
export function targetPosition(state: ListenState, now = Date.now()): number {
  if (!state.isPlaying) return state.positionSec;
  const sinceReading = state.stateAgeMs + Math.max(0, now - state.receivedAt);
  return state.positionSec + sinceReading / 1000;
}

/**
 * How far out of step is worth correcting, in seconds.
 *
 * Small enough that neither person can tell they are apart, large enough that
 * ordinary jitter — a poll landing 300ms late, a buffer hiccup — does not make
 * the audio jump. A seek is audible; being half a second apart is not.
 */
export const DRIFT_TOLERANCE_SEC = 2.5;

/** How often a live session writes its position down, in ms. */
const REPORT_EVERY_MS = 15_000;

export type ListenTogether = ReturnType<typeof useListenTogether>;

export function useListenTogether() {
  const pathname = usePathname();
  // No session, no space, nothing to listen together with — and the marketing
  // pages must not fire an authed query on every visit.
  const enabled = !isPublicChrome(pathname);

  const invites = useNavigationInvitesContext();
  const utils = trpc.useUtils();
  const current = trpc.listen.current.useQuery(undefined, {
    enabled,
    staleTime: 30_000,
  });

  const inviteMutation = trpc.listen.invite.useMutation();
  const respondMutation = trpc.listen.respond.useMutation();
  const controlMutation = trpc.listen.control.useMutation();
  const endMutation = trpc.listen.end.useMutation();

  /*
   * Live-ness comes from three places and they have to agree: the query that
   * ran on load, the stream while the page is open, and this device's own
   * actions. Held as one piece of state rather than derived, so an accept can
   * take effect immediately instead of waiting for the next poll.
   */
  const [liveId, setLiveId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  /*
   * A state this device learned WITHOUT the stream telling it.
   *
   * Two moments need it, and both would otherwise be silent. Accepting an
   * invite makes the guest the last actor, so the server correctly does not
   * echo the state back to them — yet they are the one who needs to know where
   * to start. And a page reloaded mid-session has to resume from what the
   * session says, not from nothing.
   *
   * Folded into the same slot the stream writes to, so the dock has one code
   * path for "go to this point" rather than three.
   */
  const [localState, setLocalState] = useState<ListenState | null>(null);

  // Seed from the load-time query, once it answers.
  useEffect(() => {
    const s = current.data;
    if (!s) return;
    if (s.status === "inviting") setWaiting(true);
    if (s.status !== "live") return;
    setLiveId(s.id);
    // Only as a starting point: anything the stream says afterwards is newer.
    setLocalState((prev) =>
      prev
        ? prev
        : {
            id: s.id,
            queue: s.queue,
            index: s.index,
            isPlaying: s.isPlaying,
            positionSec: s.positionSec,
            stateAgeMs: s.stateAgeMs,
            updatedBy: s.updatedBy,
            receivedAt: Date.now(),
          },
    );
  }, [current.data]);

  /**
   * The newest thing known about the shared playback, whatever told us.
   *
   * Compared on when this device received it, not on the server's reading age —
   * a message that arrived later describes a later truth even if it was
   * measured slightly earlier.
   */
  const partnerState = useMemo(() => {
    const fromStream = invites.listenState;
    if (!fromStream) return localState;
    if (!localState) return fromStream;
    return fromStream.receivedAt >= localState.receivedAt ? fromStream : localState;
  }, [invites.listenState, localState]);

  // The stream is authoritative from then on.
  useEffect(() => {
    if (invites.listenLive) {
      setLiveId(invites.listenLive);
      setWaiting(false);
    }
  }, [invites.listenLive]);

  // An end reported by the stream closes it here too.
  useEffect(() => {
    if (!invites.listenEnded) return;
    setLiveId(null);
    setWaiting(false);
    setLocalState(null);
  }, [invites.listenEnded]);

  const start = useCallback(
    async (queue: ListenTrack[], index: number, positionSec: number) => {
      if (!queue.length) return;
      setWaiting(true);
      try {
        const res = await inviteMutation.mutateAsync({ queue, index, positionSec });
        void utils.listen.current.invalidate();
        return res;
      } catch (err) {
        setWaiting(false);
        throw err;
      }
    },
    [inviteMutation, utils],
  );

  const respond = useCallback(
    async (accept: boolean) => {
      const invite = invites.listenInvite;
      if (!invite) return null;
      const res = await respondMutation.mutateAsync({ sessionId: invite.id, accept });
      invites.clearListenInvite();
      if (accept) {
        setLiveId(res.id);
        // The accepting device is the last actor, so the server will not echo
        // this back to it — it starts from what respond() returned.
        setLocalState({
          id: res.id,
          queue: res.queue,
          index: res.index,
          isPlaying: res.isPlaying,
          positionSec: res.positionSec,
          stateAgeMs: res.stateAgeMs,
          updatedBy: res.updatedBy,
          receivedAt: Date.now(),
        });
      }
      void utils.listen.current.invalidate();
      return res;
    },
    [invites, respondMutation, utils],
  );

  const end = useCallback(async () => {
    setLiveId(null);
    setWaiting(false);
    setLocalState(null);
    invites.clearListen();
    await endMutation.mutateAsync().catch(() => {
      /* Already gone server-side is the same outcome as ending it. */
    });
    void utils.listen.current.invalidate();
  }, [endMutation, invites, utils]);

  /** Tell the other side what just happened here. No-op with no session. */
  const report = useCallback(
    (change: { isPlaying?: boolean; positionSec?: number; index?: number }) => {
      if (!liveId) return;
      controlMutation.mutate(change);
    },
    [controlMutation, liveId],
  );

  /**
   * Write the position down every so often while playing.
   *
   * Not for the other device — it is already in step — but for the NEXT one:
   * a reload, or a phone picked up an hour later, resumes from the last thing
   * written here. Without it a session would always resume from whenever
   * somebody last pressed something.
   */
  /*
   * A ref, not state: `setState(fn)` treats a function as an updater, so
   * handing a reader in through a setter would have CALLED it instead of
   * storing it.
   */
  const positionReader = useRef<(() => number) | null>(null);
  useEffect(() => {
    if (!liveId) return;
    const t = setInterval(() => {
      const at = positionReader.current?.();
      if (at && at > 0) controlMutation.mutate({ positionSec: at });
    }, REPORT_EVERY_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId]);

  return {
    enabled,
    /** True while a session is live for this space. */
    live: liveId !== null,
    /** True after inviting, until the other person answers. */
    waiting: waiting && liveId === null,
    /** A pending invite aimed at this user. */
    invite: invites.listenInvite,
    /** The newest known shared state — from the stream, an accept, or a reload. */
    partnerState,
    /** The session as the server last described it, for a fresh page. */
    initial: current.data ?? null,
    start,
    respond,
    end,
    report,
    /** The dock assigns how to read its playhead, for the periodic report. */
    positionReader,
    isBusy: inviteMutation.isPending || respondMutation.isPending,
  };
}
