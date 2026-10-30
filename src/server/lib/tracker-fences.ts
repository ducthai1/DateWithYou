import { TrackerLinkModel } from "@/server/db/models/tracker-link";
import { LiveLocationModel } from "@/server/db/models/live-location";
import { calculateDistance } from "@/lib/maps";
import { EMPTY_FENCE, shouldAnnounce, stepFence, type FenceInput } from "@/lib/geofence";
import { REGION_RADIUS_M, setWaypointsCommand, type RegionKey, type TrackerRegion } from "@/lib/owntracks";
import { alertMember, partnerOf, vnClock } from "@/server/lib/partner-alerts";

/**
 * "Đã về nhà", "vừa rời nhà", "đã tới quán" — from the tracker, with the screen off.
 * The rules are in src/lib/geofence.ts; this is the storage and the telling.
 */

type StoredFence = { inside?: boolean | null; at?: Date | null; announcedAt?: Date | null } | null;

export type FenceLink = {
  _id: unknown;
  spaceId: string;
  userId: string;
  home?: { lat: number; lng: number } | null;
  meet?: { lat: number; lng: number; name: string; until: Date } | null;
  homeFence?: StoredFence;
  meetFence?: StoredFence;
  regionsSent?: string | null;
  regionsSentAt?: Date | null;
};

/** Re-send the regions this often anyway, in case a reply carrying them was lost. */
const REGIONS_RESEND_MS = 24 * 3600_000;
/** Partner this close to the home being arrived at: they are there together, nothing to tell. */
const SAME_PLACE_M = 150;
const PARTNER_FRESH_MS = 3 * 60_000;

export function activeRegions(link: FenceLink, now: number): TrackerRegion[] {
  const out: TrackerRegion[] = [];
  if (link.home) out.push({ key: "home", lat: link.home.lat, lng: link.home.lng });
  if (link.meet && new Date(link.meet.until).getTime() > now)
    out.push({ key: "meet", lat: link.meet.lat, lng: link.meet.lng });
  return out;
}

/** The setWaypoints command, when the phone does not have these regions yet. */
export function regionsToSend(link: FenceLink, now: number) {
  const regions = activeRegions(link, now);
  if (!regions.length) return null;
  const hash = JSON.stringify(regions.map((r) => [r.key, r.lat.toFixed(5), r.lng.toFixed(5)]));
  const sentAt = link.regionsSentAt ? new Date(link.regionsSentAt).getTime() : 0;
  if (hash === link.regionsSent && now - sentAt < REGIONS_RESEND_MS) return null;
  return { command: setWaypointsCommand(regions), hash };
}

const toState = (f: StoredFence) =>
  f ? { inside: f.inside ?? null, at: f.at ? new Date(f.at).getTime() : null } : EMPTY_FENCE;

async function partnerAt(spaceId: string, partnerId: string, now: number) {
  const row = await LiveLocationModel.findOne({
    spaceId,
    userId: partnerId,
    updatedAt: { $gt: new Date(now - PARTNER_FRESH_MS) },
  })
    .select("lat lng")
    .lean<{ lat: number; lng: number }>();
  return row ?? null;
}

/**
 * Run one piece of evidence through the circles it concerns: every active one
 * for a fix, only the named one for a transition. Returns what was announced,
 * for the tests.
 */
export async function feedFences(
  link: FenceLink,
  input: FenceInput,
  now: number,
  only?: RegionKey,
): Promise<Array<{ region: RegionKey; event: "enter" | "leave" }>> {
  const told: Array<{ region: RegionKey; event: "enter" | "leave" }> = [];
  for (const region of activeRegions(link, now)) {
    if (only && region.key !== only) continue;
    const field = region.key === "home" ? "homeFence" : "meetFence";
    const stored = link[field] ?? null;
    const { state, event } = stepFence(toState(stored), { ...region, radiusM: REGION_RADIUS_M }, input);
    if (state.at === toState(stored).at) continue;

    const announcedAt = stored?.announcedAt ? new Date(stored.announcedAt).getTime() : null;
    let announce = event !== null && shouldAnnounce(input.at, announcedAt, now);
    // Leaving a café is not news; arriving is.
    if (region.key === "meet" && event === "leave") announce = false;

    const partnerId = announce ? await partnerOf(link.spaceId, link.userId) : null;
    if (announce && partnerId && region.key === "home" && event === "enter") {
      const p = await partnerAt(link.spaceId, partnerId, now);
      if (p && calculateDistance(p, region) <= SAME_PLACE_M) announce = false;
    }

    const next = { inside: state.inside, at: state.at ? new Date(state.at) : null, announcedAt: stored?.announcedAt ?? null };
    if (announce && partnerId && event) {
      next.announcedAt = new Date(now);
      const clock = vnClock(input.at);
      const meetName = link.meet?.name ?? "điểm hẹn";
      await alertMember(
        link.spaceId,
        partnerId,
        link.userId,
        (name) =>
          region.key === "meet"
            ? { title: `📍 ${name} đã tới ${meetName}`, body: `Tới lúc ${clock}.`, url: "/map", tag: "arrive-meet" }
            : event === "enter"
              ? { title: `🏠 ${name} đã về nhà`, body: `Về tới lúc ${clock}.`, url: "/map", tag: "home" }
              : { title: `🛵 ${name} vừa rời nhà`, body: `Đi lúc ${clock}.`, url: "/map", tag: "home" },
        // Nothing on the map screen says this, open or not.
        { skipIfAppOpen: false },
      );
      told.push({ region: region.key, event });
    }
    link[field] = next;
    await TrackerLinkModel.updateOne({ _id: link._id }, { $set: { [field]: next } });
  }
  return told;
}

/**
 * Where a trip both accepted is headed, on both members' trackers — or null to
 * take it down when the trip ends. Lapses on its own at `until` regardless.
 */
export async function setMeetPoint(
  spaceId: string,
  meet: { lat: number; lng: number; name: string; until: Date } | null,
) {
  await TrackerLinkModel.updateMany({ spaceId }, { $set: { meet, meetFence: null } });
}
