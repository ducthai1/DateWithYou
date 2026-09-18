/*
 * Vá ngược những link TikTok đã lưu bằng dạng rút gọn.
 *
 * Chia sẻ từ app TikTok ra `vm.tiktok.com/XXXX/`, mà dạng đó không mang id bài
 * viết — nên các hàng lưu trước bản sửa này không phát được, và client không
 * thể tự chữa: id đơn giản là không có trong dữ liệu. Phải đi hỏi TikTok một
 * lần cho mỗi hàng, và đó là việc của script này chứ không phải của lúc hiển
 * thị.
 *
 * Chạy:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env \
 *     --import ./tests/alias-hook.mjs scripts/backfill-tiktok-links.ts [--apply]
 *
 * Không có `--apply` thì chỉ in ra dự định, không ghi gì. Cố ý: script này
 * chạy trên dữ liệu thật, nên mặc định phải là không làm gì cả.
 */

import mongoose from "mongoose";
import { MemoryModel } from "../src/server/db/models/memory";
import { MediaItemModel } from "../src/server/db/models/media-item";
import { resolveEmbed } from "../src/server/lib/resolve-embed";
import { tiktokPostId } from "../src/lib/embed";

const APPLY = process.argv.includes("--apply");

/** Hàng cần vá: nhãn TikTok, nhưng `url` không moi ra được id. */
function needsFix(e: { provider?: string | null; url?: string | null }): boolean {
  return e.provider === "tiktok" && !tiktokPostId(e.url);
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Thiếu MONGODB_URI");
  await mongoose.connect(uri);
  const dbName = mongoose.connection.name;
  console.log(`Database: ${dbName}  ·  chế độ: ${APPLY ? "GHI THẬT" : "chỉ xem"}\n`);

  let scanned = 0, fixed = 0, failed = 0;

  // --- Kỷ niệm: embed nằm trong mảng con, phải vá từng phần tử ---
  const memories = await MemoryModel.find({ "embeds.provider": "tiktok" });
  for (const m of memories) {
    let touched = false;
    for (const e of m.embeds as { provider?: string; url?: string; embedId?: string; embedUrl?: string; thumbnailUrl?: string; title?: string }[]) {
      if (!needsFix(e) || !e.url) continue;
      scanned++;
      const r = await resolveEmbed(e.url);
      if (!r.embedUrl) { failed++; console.log(`  ✗ kỷ niệm ${m._id}: không giải được ${e.url}`); continue; }
      e.url = r.url; e.embedId = r.embedId ?? undefined; e.embedUrl = r.embedUrl;
      e.thumbnailUrl = r.thumbnailUrl ?? e.thumbnailUrl; e.title = r.title ?? e.title;
      touched = true; fixed++;
      console.log(`  ✓ kỷ niệm ${m._id}: → ${r.url}`);
    }
    if (touched && APPLY) { m.markModified("embeds"); await m.save(); }
  }

  // --- Bộ sưu tập / video nấu ăn / công thức ---
  const items = await MediaItemModel.find({ provider: "tiktok" });
  for (const it of items) {
    if (!needsFix(it as { provider?: string; url?: string }) || !it.url) continue;
    scanned++;
    const r = await resolveEmbed(it.url);
    if (!r.embedUrl) { failed++; console.log(`  ✗ mục ${it._id}: không giải được ${it.url}`); continue; }
    it.url = r.url; it.embedId = r.embedId ?? undefined; it.embedUrl = r.embedUrl;
    it.thumbnailUrl = r.thumbnailUrl ?? it.thumbnailUrl;
    fixed++;
    console.log(`  ✓ mục ${it._id}: → ${r.url}`);
    if (APPLY) await it.save();
  }

  console.log(`\nSoát ${scanned} link · vá được ${fixed} · chịu thua ${failed}`);
  if (!APPLY && fixed > 0) console.log("Chạy lại kèm --apply để ghi xuống.");
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
