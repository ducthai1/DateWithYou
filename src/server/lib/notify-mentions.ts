import { sendPushToUser } from "@/server/lib/push";
import { SpaceModel } from "@/server/db/models/space";
import { connectToDatabase } from "@/server/db/connect";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";
import { noteRecipients } from "@/lib/note-recipients";

/**
 * Báo cho người vừa bị nhắc tên trong một kỷ niệm.
 *
 * Dùng chung cho chú thích và cho bình luận dưới bài — nhắc tên là một sự
 * kiện, không phải hai, nên nó phải đi cùng một đường và mang cùng một `tag`.
 */
export async function notifyMentions({
  memoryId,
  title,
  authorId,
  mentioned,
}: {
  memoryId: string;
  title: string;
  authorId: string;
  mentioned: string[];
}): Promise<void> {
  const targets = [...new Set(mentioned)].filter((id) => id && id !== authorId);
  if (targets.length === 0) return;
  await Promise.all(
    targets.map((id) =>
      sendPushToUser(id, {
        title: "Bạn vừa được nhắc tên 💬",
        body: `Trong kỷ niệm "${title}"`,
        // Straight to the entry, not to the timeline and good luck.
        url: `/timeline?memory=${memoryId}`,
        // One per memory: editing a caption twice should not stack two.
        tag: `mention-${memoryId}`,
      }).catch((err) => console.error("memory: mention push failed", err)),
    ),
  );
}

/**
 * Báo cho người kia rằng có ghi chú mới dưới một kỷ niệm.
 *
 * Tách khỏi `notifyMentions` vì hai cái là hai sự kiện khác nhau về mức độ:
 * bị nhắc đích danh thì đáng gọi tên, còn có người viết gì đó dưới bài chung
 * thì chỉ cần biết. Ai đã nhận thông báo nhắc tên rồi thì **không** nhận thêm
 * cái này — một dòng chữ không được rung hai lần.
 */
export async function notifyNewNote({
  spaceId,
  memoryId,
  title,
  authorId,
  authorName,
  alreadyNotified,
}: {
  spaceId: string;
  memoryId: string;
  title: string;
  authorId: string;
  authorName: string | null;
  alreadyNotified: string[];
}): Promise<void> {
  await connectToDatabase();
  const space = await SpaceModel.findById(spaceId).select("members").lean<{ members: string[] }>();
  if (!space) return;

  const targets = noteRecipients({ members: space.members, authorId, alreadyNotified });
  if (targets.length === 0) return;

  const who = authorName?.trim() || "Người kia";
  await Promise.all(
    targets.map((id) =>
      sendPushToUser(id, {
        title: `${who} vừa viết gì đó ✍️`,
        body: `Dưới kỷ niệm "${title}"`,
        url: `/timeline?memory=${memoryId}`,
        /*
         * Một cái chuông cho mỗi kỷ niệm, không phải mỗi dòng.
         *
         * Người ta viết liền ba dòng là chuyện thường; ba thông báo xếp chồng
         * cho cùng một cuộc trò chuyện thì chỉ làm người kia tắt thông báo đi.
         */
        tag: `note-${memoryId}`,
      }).catch((err) => console.error("note: new-note push failed", err)),
    ),
  );
}

/**
 * Tên để xưng trong thông báo: biệt danh cặp đôi đặt, nếu không thì tên tài khoản.
 *
 * Cùng thứ tự ưu tiên với `space.members` — thông báo mà gọi tên khác với tên
 * đang hiện trên màn thì người nhận không biết đó là ai.
 */
export async function authorDisplayName(
  userId: string,
  spaceId: string,
): Promise<string | null> {
  await connectToDatabase();
  const space = await SpaceModel.findById(spaceId)
    .select("memberProfiles")
    .lean<{ memberProfiles?: { userId: string; nickname?: string }[] }>();
  const nickname = space?.memberProfiles?.find((p) => p.userId === userId)?.nickname;
  if (nickname?.trim()) return nickname.trim();
  const [profile] = await resolveMemberProfiles([userId]);
  return profile?.name?.trim() || null;
}
