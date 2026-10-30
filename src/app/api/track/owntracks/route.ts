import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/server/db/connect";
import { LiveLocationModel } from "@/server/db/models/live-location";
import { TrackerLinkModel } from "@/server/db/models/tracker-link";
import { checkTrackerPassword, readBasicAuth } from "@/server/lib/tracker-token";
import {
  parseOwnTracksLocation,
  parseOwnTracksStatus,
  parseOwnTracksTransition,
  type TrackerFix,
} from "@/lib/owntracks";
import { feedFences, regionsToSend, type FenceLink } from "@/server/lib/tracker-fences";
import { watchMeeting } from "@/server/lib/meeting-watch";
import { closeTrips, recordTrackPoint } from "@/server/lib/tracker-trips";

/**
 * Where OwnTracks posts while the phone is in a pocket.
 *
 * A fix lands in the same LiveLocation row the app's own pings write, so the
 * partner's stream, map and "người kia đang ở đâu" work unchanged. See
 * src/lib/owntracks.ts for why a native tracker is in the picture at all.
 *
 * Outside the auth middleware (it matches nothing under /api/): there is no
 * session cookie here, only the tracker's Basic credentials.
 */

export const dynamic = "force-dynamic";

/** Older than this and it is history being flushed from a queue, not where they are. */
const LIVE_MAX_AGE_MS = 2 * 60_000;
/** The app on screen writes every 2.5 s with a better fix; within this, it wins. */
const APP_WINS_MS = 10_000;
/** How often to ask the tracker which permissions it has. */
const STATUS_EVERY_MS = 30 * 60_000;

/** OwnTracks counts any 2xx as delivered and reads the body as an array of messages. */
const reply = (messages: unknown[] = [], status = 200) => Response.json(messages, { status });

type Link = FenceLink & { lastFixAt?: Date | null; statusAskedAt?: Date | null; health?: { at?: Date } | null };

async function writeLive(link: Link, fix: TrackerFix, now: number) {
  try {
    await LiveLocationModel.updateOne(
      {
        spaceId: link.spaceId,
        userId: link.userId,
        // Never over a fix the app itself wrote a moment ago.
        $or: [{ source: "tracker" }, { updatedAt: { $lt: new Date(now - APP_WINS_MS) } }],
      },
      {
        $set: {
          lat: fix.lat,
          lng: fix.lng,
          heading: fix.heading,
          speedKmH: fix.speedKmH,
          accuracy: fix.accuracy,
          ...(fix.battery != null ? { batteryLevel: fix.battery, batteryAt: new Date(fix.at) } : {}),
          // The tracker knows nothing of routes; the partner's screen estimates instead.
          remainingMeters: null,
          remainingSeconds: null,
          source: "tracker",
          updatedAt: new Date(now),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    // The filter missed because the app's row is fresh, and the upsert then hit
    // the unique (spaceId, userId) index: exactly the case to skip.
    if ((err as { code?: number }).code !== 11000) throw err;
    /*
     * The app keeps the position, but not the battery: Safari cannot read an
     * iPhone's, so the app sends none, and the tracker's is the only one there is.
     */
    if (fix.battery != null) {
      await LiveLocationModel.updateOne(
        { spaceId: link.spaceId, userId: link.userId },
        { $set: { batteryLevel: fix.battery, batteryAt: new Date(fix.at) } },
      );
    }
  }
}

export async function POST(request: Request) {
  const creds = readBasicAuth(request.headers.get("authorization"));
  if (!creds || !isValidObjectId(creds.user) || !checkTrackerPassword(creds.user, creds.pass)) return reply([], 401);

  await connectToDatabase();
  const link = await TrackerLinkModel.findById(creds.user).lean<Link>();
  // Unlinked from the app: refuse, so the tracker shows an error instead of
  // silently sending a position nobody will ever see.
  if (!link) return reply([], 401);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // OwnTracks sends an empty body for a removed friend; nothing to do.
    return reply();
  }

  const now = Date.now();
  const set: Record<string, unknown> = { lastSeenAt: new Date(now) };
  const out: unknown[] = [];

  const fix = parseOwnTracksLocation(body);
  if (fix) {
    set.battery = fix.battery;
    if (fix.monitoring !== null) set.monitoring = fix.monitoring;
    const newer = !link.lastFixAt || fix.at > new Date(link.lastFixAt).getTime();
    const live = now - fix.at < LIVE_MAX_AGE_MS && fix.at - now < 60_000;
    // Kept even when late: a queue flushed after a tunnel is still the trip.
    if (fix.at - now < 60_000) await recordTrackPoint(link, fix);
    if (newer) {
      set.lastFixAt = new Date(fix.at);
      if (live) await writeLive(link, fix, now);
      await feedFences(link, { kind: "fix", lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, at: fix.at }, now);
      if (live) await watchMeeting(link.spaceId, link.userId, { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, at: fix.at }, now);
    }
    await closeTrips(link._id, now);
    /*
     * Ask which permissions it has, now and then. The answer comes back as a
     * `status` message on its next post — the only way to see from here
     * whether it is allowed to keep running with the screen off.
     */
    const asked = link.statusAskedAt ? new Date(link.statusAskedAt).getTime() : 0;
    if (now - asked > STATUS_EVERY_MS) {
      out.push({ _type: "cmd", action: "status" });
      set.statusAskedAt = new Date(now);
    }
  }

  const health = parseOwnTracksStatus(body);
  if (health) set.health = { ...health, at: new Date(now) };

  const transition = parseOwnTracksTransition(body);
  if (transition) {
    await feedFences(link, { kind: "transition", event: transition.event, at: transition.at }, now, transition.region);
  }

  // "Nhà" and today's meeting point, installed on the phone so it can tell us
  // the moment it crosses one, asleep or not.
  const regions = regionsToSend(link, now);
  if (regions) {
    out.push(regions.command);
    set.regionsSent = regions.hash;
    set.regionsSentAt = new Date(now);
  }

  await TrackerLinkModel.updateOne({ _id: link._id }, { $set: set });
  return reply(out);
}
