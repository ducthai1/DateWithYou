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
  /*
   * Commands retry. A refresh used to re-send the whole state every 15 s,
   * which quietly repaired a pause or a skip whose POST was lost on a flaky
   * network; a refresh may now only write the position (it moved both people
   * to the next song when it carried a stale index), so a lost command has to
   * be delivered by retrying it instead.
   */
  const controlMutation = trpc.listen.control.useMutation({ retry: 3 });
  // A refresh is never retried: a late one describes a moment already gone.
  const refreshMutation = trpc.listen.control.useMutation();
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

  /*
   * The epoch of the last command this device has FOLLOWED — its own, or the
   * other person's once the dock has applied it. The periodic refresh carries
   * it, and the server refuses a refresh from behind the latest command: a
   * player that has not caught up with a seek must not write its old position
   * over that seek. Null until something has been followed, and then no refresh
   * is sent at all.
   */
  const appliedEpoch = useRef<number | null>(null);
  const markApplied = useCallback((epoch: number | undefined) => {
    const e = epoch ?? 0;
    if (appliedEpoch.current === null || e > appliedEpoch.current) appliedEpoch.current = e;
  }, []);
  /*
   * Moments when this device must not speak for the session: while the page is
   * hidden (the OS pausing a backgrounded player is not the person pausing),
   * and while the dock is catching up after coming back. See `quiet`.
   */
  const quietUntil = useRef(0);
  const silent = useCallback(
    () =>
      typeof document !== "undefined" &&
      (document.visibilityState === "hidden" || Date.now() < quietUntil.current),
    [],
  );

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
            epoch: s.epoch,
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

  // An end reported by the stream closes it here too — for good, so the
  // load-time answer still sitting in the cache cannot bring it back.
  useEffect(() => {
    if (!invites.listenEnded) return;
    forget(invites.listenEnded.split("@")[0]);
    setLiveId(null);
    setWaiting(false);
    setLocalState(null);
    void utils.listen.current.invalidate();
  }, [invites.listenEnded, forget, utils]);

  /*
   * Live as of THIS render.
   *
   * `liveId` is set in an effect after the load-time answer arrives, so for one
   * render this hook said "ready, and no session" — and the watch page, which
   * adopts its URL exactly when no session leads, did so in that render. It
   * built the library's queue around the URL's track; the periodic write then
   * sent that queue's index into the session, and both people were moved to
   * the next song. Read straight off the answer, there is no such render.
   */
  const seeded = current.data && !left.current.has(current.data.id) ? current.data : null;
  const liveNow = liveId ?? (seeded?.status === "live" ? seeded.id : null);

  const start = useCallback(
    async (
      queue: ListenTrack[],
      index: number,
      positionSec: number,
      isPlaying = true,
    ) => {
      if (!queue.length) return;
      setWaiting(true);
      try {
        const res = await inviteMutation.mutateAsync({
          queue,
          index,
          positionSec,
          isPlaying,
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
          epoch: res.epoch,
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

  /**
   * Tell the other side what a hand just did here. No-op with no session, and
   * while this device is not speaking for it (see `silent`).
   */
  const report = useCallback(
    (change: { isPlaying?: boolean; positionSec?: number; index?: number }) => {
      if (!liveId || silent()) return;
      controlMutation.mutate(
        { ...change, kind: "command" },
        // Our own command is followed by definition; the stream will not echo it.
        { onSuccess: (view) => view && markApplied(view.epoch) },
      );
    },
    [controlMutation, liveId, markApplied, silent],
  );

  /** Keep this device from speaking for the session for a while — see `silent`. */
  const quiet = useCallback((ms: number) => {
    quietUntil.current = Math.max(quietUntil.current, Date.now() + ms);
  }, []);
  const speak = useCallback(() => {
    quietUntil.current = 0;
  }, []);

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
    (() => { positionSec: number; isPlaying: boolean; index: number; trackId: string | null }) | null
  >(null);
  useEffect(() => {
    if (!liveId) return;
    const t = setInterval(() => {
      /*
       * Nothing written from a page nobody is looking at — its player may be
       * paused by the OS, its playhead frozen — or from one that has not yet
       * followed anything (it would carry no epoch the server accepts).
       */
      if (silent() || appliedEpoch.current === null) return;
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
      // No track id, nothing to vouch for: an index means nothing across queues.
      if (!r.trackId) return;
      refreshMutation.mutate({
        positionSec: Math.max(0, r.positionSec),
        // Not written — the server checks them against the session and refuses
        // a refresh from a player that is out of step.
        isPlaying: r.isPlaying,
        trackId: r.trackId,
        kind: "refresh",
        epoch: appliedEpoch.current,
      });
    }, REPORT_EVERY_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId]);

  return {
    enabled,
    /** True while a session is live for this space. */
    live: liveNow !== null,
    /** True after inviting, until the other person answers. */
    waiting: waiting && liveNow === null,
    /** A pending invite aimed at this user. */
    invite: invites.listenInvite,
    /** The newest known shared state — from the stream, an accept, or a reload. */
    partnerState,
    /** The session as the server last described it, for a fresh page. */
    initial: current.data ?? null,
    /**
     * Whether the load-time answer about the session has come back.
     *
     * Until it has, nobody knows whether a session is live — and a page that
     * acted on its own URL in that moment (the watch page adopting its track)
     * used to end the session for both people when it raced the answer.
     */
    ready: !enabled || !current.isPending,
    /** Ask the server where the session is now — for catching up after a pause in attention. */
    fetchCurrent: () => utils.listen.current.fetch(undefined, { staleTime: 0 }),
    start,
    respond,
    end,
    report,
    markApplied,
    quiet,
    speak,
    /** The dock assigns how to read its playhead, for the periodic report. */
    positionReader,
    isBusy: inviteMutation.isPending || respondMutation.isPending,
  };
}
