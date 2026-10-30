import { LiveLocationModel } from "@/server/db/models/live-location";
import { MeetingStateModel } from "@/server/db/models/meeting-state";
import { TrackerLinkModel } from "@/server/db/models/tracker-link";
import { calculateDistance } from "@/lib/maps";
import { stepMeeting, type MeetFix } from "@/lib/meeting-detect";
import { alertMember, partnerOf, vnClock } from "@/server/lib/partner-alerts";

/**
 * "Hai bạn đã gặp nhau" with a phone in a pocket. Rules in src/lib/meeting-detect.ts.
 *
 * Run on tracker fixes only: when both screens are open the page's own
 * MeetingFlare already celebrates, and that is also why a member whose app is
 * on screen gets no notification here.
 */

/** Two meetings closer than this: the second is the same afternoon. */
const MEET_REPEAT_MS = 30 * 60_000;
/** Meeting at home is coming home, and the home circle already said so. */
const HOME_M = 150;

export async function watchMeeting(
  spaceId: string,
  userId: string,
  fix: MeetFix,
  now: number,
): Promise<boolean> {
  const partnerId = await partnerOf(spaceId, userId);
  if (!partnerId) return false;
  const row = await LiveLocationModel.findOne({ spaceId, userId: partnerId })
    .select("lat lng accuracy updatedAt")
    .lean<{ lat: number; lng: number; accuracy: number | null; updatedAt: Date }>();
  if (!row) return false;
  const partner: MeetFix = { lat: row.lat, lng: row.lng, accuracy: row.accuracy, at: new Date(row.updatedAt).getTime() };

  const stored = await MeetingStateModel.findOne({ spaceId }).lean<{
    together: boolean | null;
    at: Date | null;
    announcedAt: Date | null;
  }>();
  const { state, met } = stepMeeting(
    { together: stored?.together ?? null, at: stored?.at ? new Date(stored.at).getTime() : null },
    fix,
    partner,
    now,
  );
  // Stale or in the in-between band: nothing learned.
  if (state.at === null || (stored?.at && state.at === new Date(stored.at).getTime())) return false;

  const set: Record<string, unknown> = { together: state.together, at: new Date(state.at) };
  let announce = met;
  const last = stored?.announcedAt ? new Date(stored.announcedAt).getTime() : null;
  if (announce && last !== null && now - last < MEET_REPEAT_MS) announce = false;
  if (announce) {
    const homes = await TrackerLinkModel.find({ spaceId, home: { $ne: null } }).select("home").lean<Array<{ home: { lat: number; lng: number } }>>();
    if (homes.some((h) => calculateDistance(h.home, fix) <= HOME_M)) announce = false;
  }
  if (announce) set.announcedAt = new Date(now);
  await MeetingStateModel.updateOne({ spaceId }, { $set: set }, { upsert: true });
  if (!announce) return false;

  const clock = vnClock(now);
  const payload = (name: string) => ({
    title: "🤝 Hai bạn đã gặp nhau",
    body: `Bạn và ${name} gặp nhau lúc ${clock}.`,
    url: "/map",
    tag: "met",
  });
  await Promise.all([
    alertMember(spaceId, partnerId, userId, payload),
    alertMember(spaceId, userId, partnerId, payload),
  ]);
  return true;
}
