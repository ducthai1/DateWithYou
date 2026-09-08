"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isPublicChrome } from "@/components/layout/nav-items";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { useNavigationInvitesContext } from "@/features/locations/navigation-invites-context";
import type {
  ListenState,
  ListenTrack,
} from "@/features/locations/use-navigation-invites";

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

/**
 * The tolerance for a moment that is already an interruption — the other
 * person's pause, resume or track change, or a frame that has just come up.
 * Wide enough to absorb the player's own reporting granularity (a reading a
 * few times a second) and the stream's jitter, narrow enough that the two
 * sides are not heard apart afterwards.
 */
export const COMMAND_TOLERANCE_SEC = 0.75;

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
  const toast = useToast();
  /*
   * Declared before the query so the query can read them. A second opinion
   * while waiting: the stream is the fast path, this is the one that cannot
   * be silently dead. If the stream died and the guest accepted, this notices
   * within a few seconds instead of never.
   */
  const [liveId, setLiveId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const current = trpc.listen.current.useQuery(undefined, {
    enabled,
    staleTime: 30_000,
    refetchInterval: waiting && !liveId ? 5_000 : false,
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
  const [localFromHere, setLocalState] = useState<ListenState | null>(null);

  /*
   * Sessions this device has ended or declined. They must never come back.
   *
   * Every source here is a poll or a stream, so news written before the
   * ending can still arrive after it: the stream's first message on a fresh
   * connection announces whatever session it finds, and the load-time query
   * answers with what the server knew a moment ago. Either one used to make
   * the dock say "Đang nghe cùng" again for a second or two after the person
   * had left — and, worse, hand the shared queue back over the track they had
   * just chosen. Ending is remembered by id, so a NEW invite (a new document,
   * hence a new id) is unaffected.
   */
  const left = useRef<Set<string>>(new Set());
  const forget = useCallback((id: string | null | undefined) => {
    if (id) left.current.add(id);
  }, []);

  // Seed from the load-time query, once it answers.
  useEffect(() => {
    const s = current.data;
    if (!s || left.current.has(s.id)) return;
    if (s.status === "inviting") setWaiting(true);
    if (s.status === "live") setLiveId(s.id);
    /*
     * Seeded for BOTH statuses. Found by reloading the host mid-invite: with
     * only "live" seeded, the host came back to no dock at all — the queue is
     * in memory and the page had just been thrown away — and when the guest
     * then accepted there was no track to put on screen, so the accept landed
     * in the database and nowhere visible. The host's own pending invite is
     * as much "the session" as a live one is.
     */
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
    const live = (s: ListenState | null) =>
      s && !left.current.has(s.id) ? s : null;
    const fromStream = live(invites.listenState);
    const localState = live(localFromHere);
    if (!fromStream) return localState;
    if (!localState) return fromStream;
    return fromStream.receivedAt >= localState.receivedAt
      ? fromStream
      : localState;
  }, [invites.listenState, localFromHere]);

  // The stream is authoritative from then on.
  useEffect(() => {
    if (invites.listenLive && !left.current.has(invites.listenLive)) {
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
        const res = await inviteMutation.mutateAsync({
          queue,
          index,
          positionSec,
        });
        void utils.listen.current.invalidate();
        toast(
          res.push && res.push.delivered > 0
            ? "Đã gửi lời mời 🎧"
            : "Đã gửi lời mời — người ấy sẽ thấy khi mở app",
          "success",
        );
        return res;
      } catch (err) {
        /*
         * Said out loud, here, because both callers fire-and-forget this. The
         * first version swallowed the rejection: a refused invite (no partner
         * in the space, a stale space cookie) flashed "Đang chờ…" for a frame
         * and then simply went back to the button, as if nothing had been
         * pressed.
         */
        setWaiting(false);
        const message = err instanceof Error ? err.message : "";
        toast(
          /NO_SPACE|2 người/.test(message)
            ? "Cần có người ấy trong không gian để nghe cùng."
            : "Chưa gửi được lời mời, thử lại nhé.",
          "error",
        );
        return undefined;
      }
    },
    [inviteMutation, utils, toast],
  );

  const respond = useCallback(
    async (accept: boolean) => {
      const invite = invites.listenInvite;
      if (!invite) return null;
      const res = await respondMutation.mutateAsync({
        sessionId: invite.id,
        accept,
      });
      invites.clearListenInvite();
      // A declined session is over for this device as firmly as an ended one.
      if (!accept) forget(invite.id);
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
    [invites, respondMutation, utils, forget],
  );

  const end = useCallback(async () => {
    forget(liveId ?? partnerState?.id ?? current.data?.id ?? null);
    setLiveId(null);
    setWaiting(false);
    setLocalState(null);
    invites.clearListen();
    await endMutation.mutateAsync().catch(() => {
      /* Already gone server-side is the same outcome as ending it. */
    });
    void utils.listen.current.invalidate();
  }, [endMutation, invites, utils, forget, liveId, partnerState, current.data]);

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
  const positionReader = useRef<
    (() => { positionSec: number; isPlaying: boolean; index: number }) | null
  >(null);
  useEffect(() => {
    if (!liveId) return;
    const t = setInterval(() => {
      const r = positionReader.current?.();
      if (!r) return;
      /*
       * The WHOLE state, every time — not just the playhead.
       *
       * Two reasons. The first version wrote the position alone, so a paused
       * side kept announcing a frozen position that the other side read as
       * "still playing, here" — undoing the pause and dragging them back to it
       * every 15 seconds. And a control whose POST was lost on a flaky mobile
       * network (mutations do not retry) was never re-sent; with the full
       * state repeated here, the document converges on the truth within one
       * tick regardless. The stream only forwards what actually CHANGED, so
       * repeating an unchanged state costs the other device nothing.
       */
      controlMutation.mutate({
        positionSec: Math.max(0, r.positionSec),
        isPlaying: r.isPlaying,
        index: r.index,
      });
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
