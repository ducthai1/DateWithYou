import "server-only";
import { findMentionRanges } from "@/lib/mentions";
import { MemoryModel } from "@/server/db/models/memory";
import { NoteModel } from "@/server/db/models/note";

/**
 * Đổi tên một người thì viết lại luôn chữ đã lưu.
 *
 * Thẻ tên được nhận ra bằng CHỮ: chú thích lưu nguyên văn `"@Bé"`. Nếu chỉ đổi
 * tên hiển thị mà để nguyên chữ cũ dưới database thì tên cũ vẫn còn sống ở một
 * chỗ người dùng nhìn thấy được — ô nhập khi mở ra sửa, vì ô đó buộc phải hiện
 * đúng chữ đang lưu để lớp vẽ thẻ khớp từng ký tự.
 *
 * Nên tên cũ không được giữ lại ở đâu cả. Đổi là viết lại.
 *
 * Thay bằng CHÍNH bộ dò mà lúc đọc dùng (`findMentionRanges`), không phải
 * `String.replaceAll`: bộ dò đã lo ranh giới chữ và luật "tên dài thắng tên
 * ngắn", nên `"@An"` không cắn vào giữa `"@An Nhiên"`. Một phép thay chuỗi thô
 * sẽ làm đúng chuyện đó.
 */
export async function renameMentionsInSpace({
  spaceId,
  userId,
  from,
  to,
  others,
}: {
  spaceId: string;
  userId: string;
  /** Mọi thành viên khác, với tên ĐANG dùng — để không cắn nhầm tên họ. */
  others: { id: string; name: string }[];
  /** Tên cũ, đúng như nó đang nằm trong chữ đã lưu. */
  from: string;
  /** Tên mới sẽ hiện ra. */
  to: string;
}): Promise<{ memories: number; notes: number }> {
  const before = from.trim();
  const after = to.trim();
  if (!before || !after || before === after) return { memories: 0, notes: 0 };

  /*
   * Đưa TOÀN BỘ tên vào bộ dò, rồi mới lọc ra người cần đổi.
   *
   * Không được đưa mỗi một cái tên. Luật "tên dài thắng tên ngắn" và phép
   * "nuốt chỗ đã khớp" chỉ hoạt động khi bộ dò nhìn thấy mọi cái tên cùng lúc
   * — ký tự sau "An" trong "@An Nhiên" là dấu cách, vốn qua được kiểm tra ranh
   * giới. Bản đầu của hàm này chỉ truyền một tên, và đổi "An" thành "Bo" đã
   * biến "@An Nhiên" của người kia thành "@Bo Nhiên". Bài kiểm bắt được.
   */
  const everyone = [
    { id: userId, name: before },
    ...others.filter((m) => m.id !== userId && m.name?.trim()).map((m) => ({ id: m.id, name: m.name })),
  ];

  /** Thay từ PHẢI sang TRÁI, để mỗi lần thay không làm lệch các vị trí còn lại. */
  const swap = (text: string): string | null => {
    const hits = findMentionRanges(text, everyone).filter((r) => r.id === userId);
    if (!hits.length) return null;
    let out = text;
    for (const r of [...hits].sort((a, b) => b.start - a.start)) {
      out = out.slice(0, r.start) + `@${after}` + out.slice(r.end);
    }
    return out;
  };

  let memories = 0;
  const memos = await MemoryModel.find({ spaceId }).select("caption photos");
  for (const m of memos) {
    let touched = false;

    const caption = m.get("caption") as string | undefined;
    if (caption) {
      const next = swap(caption);
      if (next !== null) { m.set("caption", next); touched = true; }
    }

    // Chú thích riêng của từng tấm ảnh cũng nhắc tên được.
    const photos = (m.get("photos") ?? []) as { caption?: string }[];
    photos.forEach((p, i) => {
      if (!p?.caption) return;
      const next = swap(p.caption);
      if (next !== null) { m.set(`photos.${i}.caption`, next); touched = true; }
    });

    if (touched) { await m.save(); memories++; }
  }

  let notes = 0;
  const rows = await NoteModel.find({ spaceId }).select("body");
  for (const n of rows) {
    const next = swap(n.get("body") as string);
    if (next === null) continue;
    n.set("body", next);
    await n.save();
    notes++;
  }

  return { memories, notes };
}
