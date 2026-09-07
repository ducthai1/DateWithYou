import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { connectToDatabase } from "@/server/db/connect";
import { CycleLogModel } from "@/server/db/models/cycle-log";
import { SpaceModel } from "@/server/db/models/space";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";
import { predictNextStart } from "@/lib/cycle-prediction";
import { cycleReminderCopy, shortDateLabel } from "@/lib/cycle-copy";
import { daysBetweenKeys, todayKey } from "@/lib/date-keys";
import { sendPushToUser } from "@/server/lib/push";

/**
 * The daily nudge behind the gentle day.
 *
 * A push has to arrive on a schedule, and nothing in the app runs on one — so
 * this is a Vercel Cron target (declared in vercel.json) rather than something
 * triggered by a page. It runs once a day and decides, per space, whether today
 * is one of the two moments the couple asked for.
 *
 * Each member gets copy written for THEM: he is nudged to look after her, she
 * is nudged to look after herself. That is the entire reason the app asks who
 * is who — one shared sentence would be wrong for one of them.
 */

/** The two moments: a heads-up two days out, then the day itself. */
const LEAD_DAYS = [2, 0];

// Reads the database and sends, so nothing about it may be cached or
// pre-rendered at build time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  /*
   * Fail closed. An unset secret refuses everything rather than leaving a
   * public endpoint that can be curled to spam two people's phones. Vercel
   * Cron sends the value as a bearer token.
   */
  const secret = env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const today = todayKey();

  const logs = await CycleLogModel.find({ "periodStarts.1": { $exists: true } })
    .select("spaceId periodStarts lastRemindedKey")
    .lean<
      Array<{
        _id: unknown;
        spaceId: string;
        periodStarts?: string[];
        lastRemindedKey?: string;
      }>
    >();

  let notified = 0;
  let skipped = 0;
  let delivered = 0;

  for (const log of logs) {
    const prediction = predictNextStart(log.periodStarts ?? [], today);
    if (!prediction) {
      skipped++;
      continue;
    }
    const daysAhead = daysBetweenKeys(today, prediction.nextStart);
    if (!LEAD_DAYS.includes(daysAhead)) {
      skipped++;
      continue;
    }

    /*
     * Said once per moment, and keyed on the date as well as the lead.
     *
     * The date is in the key so that correcting an entry — which moves the
     * prediction — is allowed to speak again, while the same date on the same
     * lead never repeats no matter how often the cron runs.
     */
    const momentKey = `${prediction.nextStart}:${daysAhead}`;
    if (log.lastRemindedKey === momentKey) {
      skipped++;
      continue;
    }

    const space = await SpaceModel.findById(log.spaceId)
      .select("members")
      .lean<{ members?: string[] }>();
    const members = space?.members ?? [];
    if (members.length > 0) {
      const profiles = await resolveMemberProfiles(members);
      const dateLabel = shortDateLabel(prediction.nextStart);
      const results = await Promise.all(
        profiles.map((person) =>
          sendPushToUser(person.id, {
            ...cycleReminderCopy(person.gender, daysAhead, dateLabel),
            url: "/calendar",
            // One notification of this kind at a time — the heads-up should be
            // replaced by the day-of one, not stacked beneath it.
            tag: "cycle-reminder",
          }),
        ),
      );
      delivered += results.reduce((sum, r) => sum + r.delivered, 0);
    }

    /*
     * Marked as said even when a device was unreachable. A phone that was off
     * is not a reason to try again tomorrow with a message about a date that
     * has moved on — and repeating this particular reminder is worse than
     * missing it.
     */
    await CycleLogModel.updateOne({ _id: log._id }, { $set: { lastRemindedKey: momentKey } });
    notified++;
  }

  return NextResponse.json({ ok: true, today, notified, skipped, delivered });
}
