import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { LiveLocationModel } from "@/server/db/models/live-location";
import { sendPushToUser, type PushPayload } from "@/server/lib/push";
import { authorDisplayName } from "@/server/lib/notify-mentions";

/**
 * Telling the other person something about this one — "đã về nhà", "Nhanh
 * lên!", "hai bạn đã gặp nhau" — when their phone may be in a pocket.
 */

/** The app writes every 2.5 s while on screen; a row fresher than this means it is open. */
const APP_OPEN_MS = 10_000;

export async function partnerOf(spaceId: string, userId: string): Promise<string | null> {
  await connectToDatabase();
  const space = await SpaceModel.findById(spaceId).select("members").lean<{ members: string[] }>();
  return space?.members.find((m) => m !== userId) ?? null;
}

/**
 * Their app is on screen right now. It shows the moment itself (the banner,
 * the meeting flare), and a notification on top would be the same news twice.
 */
export async function appIsOpen(spaceId: string, userId: string, now = Date.now()): Promise<boolean> {
  const row = await LiveLocationModel.findOne({
    spaceId,
    userId,
    source: "app",
    updatedAt: { $gt: new Date(now - APP_OPEN_MS) },
  })
    .select("_id")
    .lean();
  return row !== null;
}

/**
 * Push to `toUserId`, naming `aboutUserId` the way the space shows them.
 * Best-effort like every push here: a failure is logged and swallowed, never
 * allowed to fail the write that caused it.
 */
export async function alertMember(
  spaceId: string,
  toUserId: string,
  aboutUserId: string,
  build: (name: string) => PushPayload,
  { skipIfAppOpen = true }: { skipIfAppOpen?: boolean } = {},
): Promise<boolean> {
  try {
    if (skipIfAppOpen && (await appIsOpen(spaceId, toUserId))) return false;
    const name = (await authorDisplayName(aboutUserId, spaceId)) ?? "Người ấy";
    const res = await sendPushToUser(toUserId, build(name));
    return res.reason === "sent";
  } catch (err) {
    console.error("partner alert failed", err);
    return false;
  }
}

/** "17:42" in Vietnam, whatever the host's timezone says. */
export function vnClock(at: number): string {
  const d = new Date(at + 7 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
