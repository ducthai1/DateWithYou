import mongoose from "mongoose";
import { SpaceModel } from "@/server/db/models/space";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";

/**
 * A birthday belongs to the person, not to the space.
 *
 * It used to be one SpecialDate row in whichever space you happened to have
 * open when you typed it — so a second space never heard of it, and leaving
 * and rejoining lost it. Now the date itself lives on the user (like gender),
 * and the calendar rows that the countdown, the grid and /home read are
 * DERIVED from it: one per space you belong to, rewritten whenever the date
 * changes, and seeded the moment you join or create a space. Readers change
 * nothing.
 */

const objectIdOf = (id: string) => new mongoose.Types.ObjectId(id);

/**
 * Read the person's birthday off their account.
 *
 * With a fallback for accounts from before it lived there: those have only the
 * calendar row in whichever space they typed it in. Reading that row once and
 * writing it onto the account (and into their other spaces) is the migration —
 * done lazily, on first read, so nobody's settings screen comes up empty for a
 * birthday they entered last month.
 */
export async function readUserBirthday(userId: string): Promise<string | null> {
  const user = await mongoose.connection
    .collection("user")
    .findOne({ _id: objectIdOf(userId) }, { projection: { birthday: 1 } });
  const b = (user as { birthday?: unknown } | null)?.birthday;
  if (typeof b === "string" && b) return b;

  const legacy = await SpecialDateModel.findOne({ birthdayOf: userId })
    .sort({ updatedAt: -1 })
    .select("date")
    .lean<{ date?: string }>();
  if (!legacy?.date) return null;
  await setUserBirthday(userId, legacy.date);
  return legacy.date;
}

/** Write it, and rewrite the derived row in every space the person is in. */
export async function setUserBirthday(userId: string, date: string | null): Promise<void> {
  await mongoose.connection
    .collection("user")
    .updateOne({ _id: objectIdOf(userId) }, date ? { $set: { birthday: date } } : { $unset: { birthday: "" } });

  if (!date) {
    await SpecialDateModel.deleteMany({ birthdayOf: userId });
    return;
  }
  const spaces = await SpaceModel.find({ members: userId })
    .select("_id")
    .lean<{ _id: unknown }[]>();
  await Promise.all(spaces.map((s) => seedBirthdayRow(String(s._id), userId, date)));
}

/**
 * The calendar row for one person in one space.
 *
 * The title carries the name — the nickname used in THAT space if there is
 * one — so two people's birthdays are tellable apart on the calendar, and so
 * the same person can be "Sinh nhật Bé" in one space and "Sinh nhật Minh" in
 * another. Idempotent: called on every save and on every join.
 */
export async function seedBirthdayRow(spaceId: string, userId: string, date?: string | null): Promise<void> {
  const birthday = date ?? (await readUserBirthday(userId));
  if (!birthday) return;
  const [me] = await resolveMemberProfiles([userId]);
  const space = await SpaceModel.findById(spaceId)
    .select("memberProfiles")
    .lean<{ memberProfiles?: { userId: string; nickname?: string }[] }>();
  const nickname = (space?.memberProfiles ?? []).find((p) => p.userId === userId)?.nickname;
  await SpecialDateModel.updateOne(
    { spaceId, birthdayOf: userId },
    {
      $set: { title: birthdayTitle(nickname || me?.name), date: birthday, recurYearly: true, icon: "cake" },
      $setOnInsert: { spaceId, birthdayOf: userId, createdBy: userId },
    },
    { upsert: true },
  );
}

/** Một chỗ dựng chuỗi, để nơi ghi và nơi đọc không bao giờ lệch nhau. */
export function birthdayTitle(who: string | null | undefined): string {
  return `Sinh nhật ${who?.trim() || "bạn"}`;
}

/**
 * Dựng lại tiêu đề dòng sinh nhật từ HỒ SƠ HIỆN TẠI, ngay lúc đọc.
 *
 * Tiêu đề dòng sinh nhật mang tên nằm NGAY TRONG chuỗi đã lưu. Ghi lại lúc đổi
 * biệt danh là cần, nhưng không đủ: mọi dòng viết TRƯỚC bản sửa ấy vẫn đọc ra
 * tên cũ mãi mãi, và chủ repo gặp đúng thế trên production — lịch và màn Hôm
 * nay vẫn gọi tên cũ sau khi đã đổi. Một lần dọn dữ liệu chỉ chữa được quá khứ
 * đã biết; dựng lại lúc đọc thì không bao giờ lệch được nữa, kể cả với dòng do
 * bản cũ ghi hay do một đường ghi nào chưa nghĩ tới.
 *
 * Không tốn thêm vòng đi-về nào khi không có dòng sinh nhật nào trong tay —
 * đây nằm trên đường đi của màn hình đầu tiên, và một truy vấn thừa ở đó là
 * 130ms thật (xem `activity.unreadCount`).
 */
export async function withCurrentBirthdayNames<
  T extends { title: string; birthdayOf?: string | null },
>(spaceId: string, rows: T[], profiles?: MemberNickname[] | null): Promise<T[]> {
  const ids = [...new Set(rows.map((r) => r.birthdayOf).filter((v): v is string => Boolean(v)))];
  if (!ids.length) return rows;

  const [space, accounts] = await Promise.all([
    profiles
      ? null
      : SpaceModel.findById(spaceId)
          .select("memberProfiles")
          .lean<{ memberProfiles?: MemberNickname[] } | null>(),
    resolveMemberProfiles(ids),
  ]);
  const nick = new Map(
    (profiles ?? space?.memberProfiles ?? []).map((p) => [p.userId, p.nickname]),
  );
  const account = new Map(accounts.map((a) => [a.id, a.name]));
  return rows.map((r) =>
    r.birthdayOf
      ? { ...r, title: birthdayTitle(nick.get(r.birthdayOf) || account.get(r.birthdayOf)) }
      : r,
  );
}

export type MemberNickname = { userId: string; nickname?: string };
