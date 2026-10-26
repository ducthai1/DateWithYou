import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { ListenSessionModel } from "@/server/db/models/listen-session";
import { sendPushToUser } from "@/server/lib/push";
import { refreshAccepted } from "@/lib/listen-delivery";

/**
 * Listening together.
 *
 * The shape of a session, and the rules about it, live here rather than in the
 * dock: two devices have to agree on what is playing and where, and the only
 * thing they both see is this collection.
 *
 * Everything is scoped by `ctx.spaceId` through protectedProcedure, so one
 * couple can never read or drive another couple's session.
 */

const trackInput = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  thumbnailUrl: z.string().nullable().default(null),
  providerLabel: z.string().min(1),
  provider: z.string().min(1),
  embedUrl: z.string().min(1),
});

/** The wire shape both the SSE stream and these procedures hand back. */
export type ListenSessionView = {
  id: string;
  status: "inviting" | "live" | "ended";
  hostId: string;
  guestId: string;
  queue: Array<z.infer<typeof trackInput>>;
  index: number;
  isPlaying: boolean;
  positionSec: number;
  /**
   * How long ago that position was true, in milliseconds, measured on the
   * server.
   *
   * Not a timestamp: the two phones in a space disagree about what time it is,
   * often by minutes, and a follower that added its own clock to a server
   * timestamp would seek somewhere else entirely. An age is the same number on
   * every device.
   */
  stateAgeMs: number;
  updatedBy: string;
  /** Count of commands so far; a refresh must carry the one it was taken in. */
  epoch: number;
  /** Set when a late command was dropped because the other person acted since. */
  stale?: boolean;
};

type SessionDoc = {
  _id: unknown;
  status: "inviting" | "live" | "ended";
  hostId: string;
  guestId: string;
  queue: Array<z.infer<typeof trackInput>>;
  index: number;
  isPlaying: boolean;
  positionSec: number;
  stateAt: Date;
  updatedBy: string;
  epoch?: number;
  commandBy?: string | null;
};

function toView(doc: SessionDoc): ListenSessionView {
  return {
    id: String(doc._id),
    status: doc.status,
    hostId: doc.hostId,
    guestId: doc.guestId,
    queue: doc.queue ?? [],
    index: doc.index ?? 0,
    isPlaying: !!doc.isPlaying,
    positionSec: doc.positionSec ?? 0,
    stateAgeMs: Math.max(0, Date.now() - new Date(doc.stateAt).getTime()),
    updatedBy: doc.updatedBy,
    epoch: doc.epoch ?? 0,
  };
}

/** The other member of a two-person space. */
async function partnerOf(spaceId: string, userId: string): Promise<string> {
  const space = await SpaceModel.findById(spaceId)
    .select("members")
    .lean<{ members: string[] }>();
  if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
  const partnerId = space.members.find((m) => m !== userId);
  if (!partnerId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cần có 2 người trong không gian để nghe cùng nhau.",
    });
  return partnerId;
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

export const listenRouter = router({
  /**
   * The live session, for a client that has just loaded.
   *
   * The SSE stream only pushes on change, so a page opened mid-session would
   * otherwise know nothing until the next time somebody pressed something.
   */
  current: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const doc = await ListenSessionModel.findOne({
      spaceId: ctx.spaceId,
      status: { $in: ["inviting", "live"] },
    }).lean<SessionDoc>();
    return doc ? toView(doc) : null;
  }),

  /** Ask the partner to listen along with what is playing right now. */
  invite: protectedProcedure
    .input(
      z.object({
        queue: z.array(trackInput).min(1),
        index: z.number().int().min(0),
        positionSec: z.number().min(0).default(0),
        /**
         * Whether the inviter is playing right now.
         *
         * False when the invite comes from a card that was never started: the
         * host holds at the beginning until the answer comes, so the two of
         * them start together. It matters on the server as well as on screen,
         * because `respond` adds the waiting time to the playhead of a session
         * that says it is playing — an invite answered a minute later would
         * otherwise open both players a minute into the song.
         */
        isPlaying: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const partnerId = await partnerOf(ctx.spaceId, ctx.userId);
      const index = Math.min(input.index, input.queue.length - 1);

      /*
       * One session per space — replaced, and with a NEW id each time.
       *
       * This used to upsert on {spaceId}, which kept one document (one _id) per
       * space forever. Every event about a session carries its id, and the
       * client treats a repeated id as "nothing new" — so the SECOND time a
       * couple ended or declined a session, the other side never heard about
       * it and sat on "đang chờ" / "đang nghe cùng" indefinitely. Found by
       * three independent reviewers; the harness had missed it because it
       * deleted the document between runs. Delete-then-create gives each
       * session its own identity; the unique index still guarantees at most
       * one per space.
       */
      await ListenSessionModel.deleteMany({ spaceId: ctx.spaceId });
      const doc = (
        await ListenSessionModel.create({
          spaceId: ctx.spaceId,
          hostId: ctx.userId,
          guestId: partnerId,
          status: "inviting",
          queue: input.queue,
          index,
          isPlaying: input.isPlaying,
          positionSec: input.positionSec,
          stateAt: new Date(),
          updatedBy: ctx.userId,
          expiresAt: new Date(Date.now() + SIX_HOURS),
        })
      ).toObject() as SessionDoc;

      /*
       * Reach the phone even when the app is closed — the same reasoning as the
       * navigation invite: an in-app listener only fires for a page that is
       * running. Awaited but never allowed to throw, because the invite exists
       * either way and losing it to a slow push service would be worse.
       */
      const track = input.queue[index];
      const push = await sendPushToUser(partnerId, {
        title: "Nghe cùng nhau nhé? 🎧",
        body: `Đang mở "${track.title}". Mở app để nghe cùng.`,
        url: "/library",
        // One pending invite at a time, so a new one replaces the old on screen.
        tag: "listen-invite",
      }).catch((err): null => {
        console.error("listen.invite: push failed", err);
        return null;
      });

      return { session: toView(doc), push: push ?? null };
    }),

  /** The guest answers. Accepting is what turns the invite into a session. */
  respond: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const pending = await ListenSessionModel.findOne({
        _id: input.sessionId,
        spaceId: ctx.spaceId,
        // Only the person invited can answer, and only while it is unanswered.
        guestId: ctx.userId,
        status: "inviting",
      }).lean<SessionDoc>();
      if (!pending)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lời mời không còn nữa.",
        });

      /*
       * Re-base the playhead before re-stamping.
       *
       * The invite stored "position P, true at T0, playing". Accepting used to
       * write a new stateAt and leave P alone — so the document then claimed P
       * was true NOW, and the host, told about it, was yanked back by however
       * long the guest took to answer. If it was playing, P has moved on.
       */
      const now = Date.now();
      const positionSec = pending.isPlaying
        ? pending.positionSec +
          (now - new Date(pending.stateAt).getTime()) / 1000
        : pending.positionSec;

      const doc = await ListenSessionModel.findOneAndUpdate(
        { _id: pending._id, status: "inviting" },
        {
          $set: {
            status: input.accept ? "live" : "ended",
            updatedBy: ctx.userId,
            /*
             * Accepting is what starts the music. An invite sent from a card
             * that had not been played holds at the beginning — neither side
             * plays while it is pending — so the answer is the moment both
             * players are told to go, from the same point.
             */
            ...(input.accept ? { isPlaying: true, commandBy: ctx.userId } : {}),
            positionSec,
            stateAt: new Date(now),
            // A decline is over; keep it only long enough for both streams to see
            // the change, like `end` does — not the six hours a live session gets.
            expiresAt: new Date(now + (input.accept ? SIX_HOURS : 60 * 1000)),
          },
          // Starting both players is a command like any other.
          ...(input.accept ? { $inc: { epoch: 1 } } : {}),
        },
        { new: true },
      ).lean<SessionDoc>();

      if (!doc)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lời mời không còn nữa.",
        });
      return toView(doc);
    }),

  /**
   * Anything either person does to the playback.
   *
   * Both members may drive a live session — the owner's call — so this takes
   * whichever fields changed and records who did it. A press made after seeing
   * the other person's latest one wins, like a shared remote; of two made
   * without seeing each other, the first to land stands (see `baseEpoch`).
   */
  control: protectedProcedure
    .input(
      z.object({
        isPlaying: z.boolean().optional(),
        positionSec: z.number().min(0).optional(),
        index: z.number().int().min(0).optional(),
        /**
         * A hand on the playback, or the periodic write-down of where it is.
         * Defaults to "command", which is what every call meant before the
         * distinction existed — an installed app still running old code keeps
         * working.
         */
        kind: z.enum(["command", "refresh"]).default("command"),
        /** For a refresh: the epoch of the last command this player followed. */
        epoch: z.number().int().min(0).optional(),
        /** For a refresh: the track this player is on, by id — never an index. */
        trackId: z.string().min(1).optional(),
        /** For a command: the latest epoch this device had seen when the person pressed. */
        baseEpoch: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await ListenSessionModel.findOne({
        spaceId: ctx.spaceId,
        status: "live",
        $or: [{ hostId: ctx.userId }, { guestId: ctx.userId }],
      }).lean<SessionDoc & { queue: unknown[] }>();
      if (!doc) return null;

      const isRefresh = input.kind === "refresh";
      /*
       * A command made without knowing about the other person's latest one.
       *
       * Pressed offline, it arrives late — the client holds it and sends it
       * when the network is back — and a "play" from half a minute ago must not
       * overrule their pause from ten seconds ago. Pressed at the same moment
       * as theirs, one of the two has to win outright: applied both, each phone
       * followed a different one and they played on 117 s apart (measured with
       * two browsers). The first to land stands; this one is handed back as
       * `stale`. A command following this person's OWN earlier one is not
       * stale — two presses queued offline both go through.
       */
      const baseEpoch = isRefresh ? undefined : input.baseEpoch;
      const staleFor = (d: SessionDoc) =>
        baseEpoch !== undefined && (d.epoch ?? 0) > baseEpoch && !!d.commandBy && d.commandBy !== ctx.userId;
      if (staleFor(doc)) return { ...toView(doc), stale: true as const };
      if (isRefresh) {
        /*
         * A refresh writes down WHERE the player is — nothing else, and only
         * from a player that is in step with the session.
         *
         * Out of step is: behind the latest command (see `epoch` on the
         * model), on another track, or paused while the session plays (or the
         * reverse). Two of those were measured with two browsers: a refresh
         * that carried the player's own index — an index into ITS queue, which
         * was not the session's — moved both people to the next song, and one
         * that carried `isPlaying: false` from a player that had not yet
         * reported its state would have paused them both. A refresh can no
         * longer change the track or the playing state at all; only commands
         * can. The caller is handed the state it is out of step with.
         */
        const onTrack = (doc.queue[doc.index] as { id?: string } | undefined)?.id;
        const inStep =
          refreshAccepted(doc.epoch, input.epoch) &&
          (input.trackId === undefined || input.trackId === onTrack) &&
          (input.isPlaying === undefined || input.isPlaying === doc.isPlaying);
        if (!inStep || input.positionSec === undefined) return toView(doc);
      }

      const set: Record<string, unknown> = {
        updatedBy: ctx.userId,
        // Every write re-times the state, because a pause or a skip makes the
        // stored position true as of NOW and not before.
        stateAt: new Date(),
        expiresAt: new Date(Date.now() + SIX_HOURS),
      };
      if (input.positionSec !== undefined) set.positionSec = input.positionSec;
      if (!isRefresh) set.commandBy = ctx.userId;
      if (!isRefresh && input.isPlaying !== undefined) set.isPlaying = input.isPlaying;
      if (!isRefresh && input.index !== undefined) {
        const nextIndex = Math.min(
          input.index,
          Math.max(0, doc.queue.length - 1),
        );
        set.index = nextIndex;
        // A DIFFERENT track starts at its beginning unless told otherwise. The
        // same index re-sent by the periodic full-state write is not a skip.
        if (input.positionSec === undefined && nextIndex !== doc.index)
          set.positionSec = 0;
      }

      const filter: Record<string, unknown> = { _id: doc._id, status: "live" };
      // The epoch check rides in the filter too, so a command landing between
      // the read above and this write still wins.
      if (isRefresh && input.epoch !== undefined)
        filter.$or = [{ epoch: input.epoch }, ...(input.epoch === 0 ? [{ epoch: { $exists: false } }] : [])];
      // The stale check again, in the write itself: the read above can be a
      // moment old, and two presses read the same epoch.
      if (baseEpoch !== undefined)
        filter.$or = [{ epoch: { $lte: baseEpoch } }, { epoch: { $exists: false } }, { commandBy: ctx.userId }, { commandBy: null }];
      const next = await ListenSessionModel.findOneAndUpdate(
        filter,
        isRefresh ? { $set: set } : { $set: set, $inc: { epoch: 1 } },
        { new: true },
      ).lean<SessionDoc>();
      if (next) return toView(next);
      // Lost the race to a command: report where the session is now.
      const now = await ListenSessionModel.findById(doc._id).lean<SessionDoc>();
      if (now && now.status === "live" && staleFor(now)) return { ...toView(now), stale: true as const };
      return now ? toView(now) : null;
    }),

  /**
   * "I have left the player" / "I am back" — another tab, another app, a
   * locked screen, another window. Only for the other person to be told; it
   * changes nothing about the playback, and writes nothing the stream would
   * mistake for a command or a refresh.
   */
  presence: protectedProcedure
    .input(
      z.object({
        away: z.boolean(),
        kind: z.enum(["hidden", "blur"]).optional(),
        /**
         * When the device saw it, in its own clock — only ever compared with
         * the same device's earlier reports. Two reports a few milliseconds
         * apart ("another window" as the page comes back, "here" as it takes
         * focus) travel side by side and can land in either order; landing
         * last must not make the older one the truth. Measured: the person
         * was back, and the other screen said "another window" for good.
         */
        seq: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const path = `presence.${ctx.userId}`;
      const res = await ListenSessionModel.updateOne(
        {
          spaceId: ctx.spaceId,
          status: "live",
          $and: [
            { $or: [{ hostId: ctx.userId }, { guestId: ctx.userId }] },
            ...(input.seq !== undefined
              ? [{ $or: [{ [`${path}.seq`]: { $exists: false } }, { [`${path}.seq`]: { $lt: input.seq } }] }]
              : []),
          ],
        },
        {
          $set: {
            [path]: {
              away: input.away,
              kind: input.away ? (input.kind ?? "hidden") : null,
              at: new Date(),
              ...(input.seq !== undefined ? { seq: input.seq } : {}),
            },
          },
        },
      );
      return { ok: res.matchedCount > 0 };
    }),

  /** Leave. Either person ending it ends it for both — it is one session. */
  end: protectedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    await ListenSessionModel.updateOne(
      {
        spaceId: ctx.spaceId,
        status: { $in: ["inviting", "live"] },
        $or: [{ hostId: ctx.userId }, { guestId: ctx.userId }],
      },
      {
        status: "ended",
        updatedBy: ctx.userId,
        stateAt: new Date(),
        // Let it clear itself out shortly; kept briefly so both clients see
        // the "ended" state once rather than the document vanishing under them.
        expiresAt: new Date(Date.now() + 60 * 1000),
      },
    );
    return { ok: true };
  }),
});
