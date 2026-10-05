import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authorDisplayName, notifyMentions, notifyNewNote } from "@/server/lib/notify-mentions";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { MemoryModel } from "@/server/db/models/memory";
import {
  ReactionModel,
  REACTION_EMOJIS,
  REACTION_TARGET_TYPES,
  type ReactionTargetType,
} from "@/server/db/models/reaction";
import {
  NoteModel,
  NOTE_MAX_LENGTH,
  NOTE_MAX_DEPTH,
  NOTE_TARGET_TYPES,
} from "@/server/db/models/note";

/**
 * Reactions and notes on shared objects (memories first).
 *
 * The content model is otherwise one-directional — `memory.createdBy` records
 * who uploaded and nothing lets the other partner answer. A one-tap reaction is
 * the cheapest reciprocity available and works for the partner who never
 * authors anything.
 */

/** React được lên kỷ niệm VÀ lên từng bình luận. */
const targetTypeInput = z.enum(REACTION_TARGET_TYPES);
/** Còn bình luận thì chỉ treo được vào nội dung, không treo vào bình luận khác. */
const noteTargetTypeInput = z.enum(NOTE_TARGET_TYPES);
const emojiInput = z.enum(REACTION_EMOJIS);

/**
 * Mongo ObjectId hex. Bounded here so a malformed id is a 400 from zod instead
 * of a Mongoose CastError surfacing as a 500.
 */
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "BAD_ID");

/** How many targets one batched read may cover — keeps the `$in` bounded. */
const MAX_TARGETS = 50;

type ReactionRow = { userId: string; emoji: string };
type NoteRow = {
  id: string;
  userId: string;
  body: string;
  mentions: string[];
  createdAt: Date;
  /** `null` là bình luận gốc. */
  parentId: string | null;
  /** Cảm xúc thả lên chính bình luận này. */
  reactions: ReactionRow[];
};
type TargetInteractions = { reactions: ReactionRow[]; notes: NoteRow[] };

/**
 * Which collection backs each target type. A new target type must be added here
 * as well as to REACTION_TARGET_TYPES, so the existence guard below can never
 * be silently skipped for it. `note` có mặt vì cảm xúc thả được lên bình luận.
 */
const TARGET_MODELS = { memory: MemoryModel, note: NoteModel } as const;

/**
 * Tenant guard: returns the subset of `targetIds` that really exists inside
 * `spaceId`. Without it a client could attach reactions/notes to another
 * couple's document id. One query for the whole batch, never one per target.
 */
async function targetsInSpace(
  targetType: ReactionTargetType,
  targetIds: string[],
  spaceId: string,
): Promise<Set<string>> {
  if (!targetIds.length) return new Set();
  const docs = await TARGET_MODELS[targetType]
    .find({ _id: { $in: targetIds }, spaceId })
    .select("_id")
    .lean<{ _id: unknown }[]>()
    .exec();
  return new Set(docs.map((d: { _id: unknown }) => String(d._id)));
}

/**
 * Bình luận cha HỢP LỆ để treo vào, hoặc `null`.
 *
 * Trả lời cho một bình luận đã ở cấp sâu nhất thì treo vào CHÍNH nó chứ không
 * từ chối: người dùng bấm "Trả lời" và phải có chuyện gì đó xảy ra. Facebook
 * làm đúng vậy, và nó giữ luồng phẳng ở cấp 3 thay vì thụt lề mãi.
 */
async function resolveParent(
  input: { targetType: "memory"; targetId: string; parentId?: string | null },
  spaceId: string,
): Promise<string | null> {
  if (!input.parentId) return null;

  /*
   * `chain` đi TỪ CHA NGƯỢC LÊN GỐC: chain[0] là cha, phần tử cuối là bình
   * luận gốc. Nên độ sâu của cha chính là `chain.length`, và tổ tiên ở cấp `k`
   * nằm ở `chain[chain.length - k]`… tính từ phía gốc thì dễ nhầm, nên dưới
   * đây đánh số từ phía cha: tổ tiên cách cha `n` bậc là `chain[n]`.
   */
  const chain: string[] = [];
  let cursor: string | null = input.parentId;
  while (cursor && chain.length < NOTE_MAX_DEPTH) {
    const node: { parentId?: string | null } | null = await NoteModel.findOne({
      _id: cursor,
      spaceId,
      targetType: input.targetType,
      targetId: input.targetId,
    })
      .select("parentId")
      .lean<{ parentId?: string | null }>()
      .exec();
    // Cha không có thật trong đúng space + đúng kỷ niệm ⇒ coi như bình luận gốc.
    if (!node) return chain.length ? input.parentId : null;
    chain.push(cursor);
    cursor = node.parentId ?? null;
  }

  const parentDepth = chain.length;
  if (parentDepth < NOTE_MAX_DEPTH) return input.parentId;
  /*
   * Cha đã ở cấp sâu nhất. Lùi đúng MỘT bậc để con rơi vào cấp sâu nhất chứ
   * không sâu hơn — KHÔNG phải nhảy về gốc, vốn là lỗi bản đầu của hàm này:
   * trả lời một bình luận cấp 3 khi đó văng lên ngang hàng cấp 2 của một nhánh
   * khác hẳn, đọc ra như trả lời nhầm người.
   */
  return chain[1] ?? chain[0] ?? null;
}

/** Current reactions on one target, serialised for the client. */
async function readReactions(
  spaceId: string,
  targetType: ReactionTargetType,
  targetId: string,
): Promise<ReactionRow[]> {
  const rows = await ReactionModel.find({ spaceId, targetType, targetId })
    .select("userId emoji")
    .lean<{ userId: string; emoji: string }[]>();
  return rows.map((r) => ({ userId: r.userId, emoji: r.emoji }));
}

export const interactionRouter = router({
  /**
   * Reactions + notes for a batch of targets. Two collection reads total
   * (plus the tenant guard), all with `$in` — never one round-trip per card.
   * Targets that don't exist in the caller's space are simply absent from the
   * result rather than returning empty shells for someone else's ids.
   */
  forTargets: protectedProcedure
    .input(
      z.object({
        targetType: targetTypeInput,
        targetIds: z.array(objectId).max(MAX_TARGETS),
      }),
    )
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const ids = [...new Set(input.targetIds)];
      const out: Record<string, TargetInteractions> = {};
      if (!ids.length) return out;

      const filter = {
        spaceId: ctx.spaceId,
        targetType: input.targetType,
        targetId: { $in: ids },
      };

      const [valid, reactions, notes] = await Promise.all([
        targetsInSpace(input.targetType, ids, ctx.spaceId),
        ReactionModel.find(filter)
          .select("targetId userId emoji")
          .lean<{ targetId: string; userId: string; emoji: string }[]>(),
        NoteModel.find(filter)
          .sort({ createdAt: 1 })
          .select("targetId userId body mentions createdAt parentId")
          .lean<
            {
              _id: unknown;
              targetId: string;
              userId: string;
              body: string;
              mentions?: string[];
              createdAt: Date;
              parentId?: string | null;
            }[]
          >(),
      ]);

      /*
       * Cảm xúc của CHÍNH các bình luận — một truy vấn cho cả lô, không phải
       * một lượt cho mỗi bình luận.
       *
       * Phải đi sau vì danh sách id bình luận chỉ có sau khi đọc xong notes.
       * Một vòng đi-về thêm cho cả màn là giá đúng; mỗi bình luận một vòng thì
       * một kỷ niệm ba chục bình luận thành ba chục vòng.
       */
      const noteIds = notes.map((n) => String(n._id));
      const noteReactions = noteIds.length
        ? await ReactionModel.find({
            spaceId: ctx.spaceId,
            targetType: "note",
            targetId: { $in: noteIds },
          })
            .select("targetId userId emoji")
            .lean<{ targetId: string; userId: string; emoji: string }[]>()
        : [];
      const byNote = new Map<string, ReactionRow[]>();
      for (const r of noteReactions) {
        const list = byNote.get(r.targetId) ?? [];
        list.push({ userId: r.userId, emoji: r.emoji });
        byNote.set(r.targetId, list);
      }

      for (const id of ids) if (valid.has(id)) out[id] = { reactions: [], notes: [] };
      for (const r of reactions) {
        out[r.targetId]?.reactions.push({ userId: r.userId, emoji: r.emoji });
      }
      for (const n of notes) {
        const id = String(n._id);
        out[n.targetId]?.notes.push({
          id,
          userId: n.userId,
          body: n.body,
          mentions: n.mentions ?? [],
          createdAt: n.createdAt,
          parentId: n.parentId ?? null,
          reactions: byNote.get(id) ?? [],
        });
      }
      return out;
    }),

  /**
   * Toggle semantics: the same emoji twice removes it, a different emoji
   * replaces the existing one, and a first tap creates it.
   *
   * Written as delete-then-upsert rather than read-then-write so two fast taps
   * can't interleave into a lost update. The unique index turns a concurrent
   * double-insert into a duplicate-key error, which is retried as a plain
   * update — never surfaced to the couple.
   */
  react: protectedProcedure
    .input(
      z.object({
        targetType: targetTypeInput,
        targetId: objectId,
        emoji: emojiInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const valid = await targetsInSpace(
        input.targetType,
        [input.targetId],
        ctx.spaceId,
      );
      if (!valid.has(input.targetId))
        throw new TRPCError({ code: "NOT_FOUND", message: "BAD_TARGET" });

      const key = {
        spaceId: ctx.spaceId,
        targetType: input.targetType,
        targetId: input.targetId,
        userId: ctx.userId,
      };

      const removed = await ReactionModel.findOneAndDelete({
        ...key,
        emoji: input.emoji,
      }).lean();

      if (!removed) {
        try {
          await ReactionModel.updateOne(
            key,
            { $set: { emoji: input.emoji } },
            { upsert: true },
          );
        } catch (err) {
          if ((err as { code?: number }).code !== 11000) throw err;
          await ReactionModel.updateOne(key, { $set: { emoji: input.emoji } });
        }
      }

      return {
        targetId: input.targetId,
        reactions: await readReactions(ctx.spaceId, input.targetType, input.targetId),
      };
    }),

  addNote: protectedProcedure
    .input(
      z.object({
        targetType: noteTargetTypeInput,
        targetId: objectId,
        body: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
        /** Id người được nhắc — client tự tách ra từ chính chữ đã gõ. */
        mentions: z.array(z.string().min(1).max(64)).max(4).default([]),
        /** Trả lời bình luận nào; bỏ trống là bình luận gốc. */
        parentId: objectId.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const valid = await targetsInSpace(
        input.targetType,
        [input.targetId],
        ctx.spaceId,
      );
      if (!valid.has(input.targetId))
        throw new TRPCError({ code: "NOT_FOUND", message: "BAD_TARGET" });

      /*
       * Độ sâu do MÁY CHỦ quyết, không tin client.
       *
       * Client có chặn ở giao diện, nhưng một lời gọi thẳng vào API vẫn lồng
       * được vô hạn và khi đó màn hình thụt lề tới mức không đọc nổi. Đi ngược
       * lên cây đúng `NOTE_MAX_DEPTH - 1` bước là biết đủ — không cần quét cả
       * cây, và cũng chặn luôn vòng lặp cha-con nếu dữ liệu từng hỏng.
       */
      const parentId = await resolveParent(input, ctx.spaceId);

      const doc = await NoteModel.create({
        spaceId: ctx.spaceId,
        targetType: input.targetType,
        targetId: input.targetId,
        userId: ctx.userId,
        body: input.body,
        mentions: input.mentions,
        parentId,
      });

      /*
       * Nhắc tên dưới bài là cùng một sự kiện với nhắc tên ở chú thích.
       *
       * Nên nó đi cùng một đường và mang cùng `tag` theo kỷ niệm — một chuỗi
       * năm ghi chú không được biến thành năm cái chuông riêng.
       */
      if (input.targetType === "memory") {
        const memo = await MemoryModel.findOne({ _id: input.targetId, spaceId: ctx.spaceId })
          .select("title")
          .lean<{ title: string }>();
        if (memo) {
          if (input.mentions.length > 0) {
            await notifyMentions({
              memoryId: input.targetId,
              title: memo.title,
              authorId: ctx.userId,
              mentioned: input.mentions,
            });
          }
          /*
           * Và người kia được biết là có ghi chú mới, kể cả khi không bị nhắc tên.
           *
           * Không có cái này thì luồng trò chuyện chỉ chạy được khi hai người
           * tình cờ cùng mở app: viết xong nằm đó, người kia không có cách nào
           * biết. `alreadyNotified` để ai vừa nhận chuông nhắc tên thì thôi —
           * một dòng chữ không rung hai lần.
           */
          await notifyNewNote({
            spaceId: ctx.spaceId,
            memoryId: input.targetId,
            title: memo.title,
            authorId: ctx.userId,
            authorName: await authorDisplayName(ctx.userId, ctx.spaceId),
            alreadyNotified: input.mentions,
          });
        }
      }

      return {
        targetId: input.targetId,
        note: {
          id: String(doc._id),
          userId: ctx.userId,
          body: doc.body as string,
          createdAt: doc.createdAt as Date,
          /*
           * Trả về chỗ bình luận THẬT SỰ rơi vào, không phải chỗ client xin.
           *
           * Hai cái khác nhau khi trả lời một bình luận đã ở cấp sâu nhất:
           * máy chủ lùi nó lên một bậc. Không nói lại thì client vẽ nhầm nhánh
           * cho tới lần làm mới kế tiếp.
           */
          parentId: (doc.parentId as string | null) ?? null,
        },
      };
    }),

  /** Author-only delete, scoped to the caller's space. */
  removeNote: protectedProcedure
    .input(z.object({ id: objectId }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await NoteModel.findOne({ _id: input.id, spaceId: ctx.spaceId })
        .select("userId targetId")
        .lean<{ userId: string; targetId: string } | null>();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      if (doc.userId !== ctx.userId)
        throw new TRPCError({ code: "FORBIDDEN", message: "NOT_AUTHOR" });

      /*
       * Xoá một bình luận là xoá CẢ NHÁNH dưới nó.
       *
       * Để lại con là để lại những câu trả lời treo lơ lửng không còn gì để
       * trả lời — và vì `parentId` của chúng trỏ vào một id đã chết, chúng
       * biến mất khỏi cây lúc dựng mà vẫn nằm trong cơ sở dữ liệu mãi mãi.
       * Cây chỉ sâu 3 cấp nên hai vòng lặp là chạm đáy, không cần đệ quy.
       */
      const doomed = [input.id];
      let level = [input.id];
      for (let depth = 1; depth < NOTE_MAX_DEPTH && level.length; depth++) {
        const kids = await NoteModel.find({ spaceId: ctx.spaceId, parentId: { $in: level } })
          .select("_id")
          .lean<{ _id: unknown }[]>()
          .exec();
        level = kids
          .map((k: { _id: unknown }) => String(k._id))
          .filter((id: string) => !doomed.includes(id));
        doomed.push(...level);
      }

      await NoteModel.deleteMany({ _id: { $in: doomed }, spaceId: ctx.spaceId });
      // Cảm xúc thả lên chính những bình luận đó cũng đi theo, không thành rác.
      await ReactionModel.deleteMany({
        spaceId: ctx.spaceId,
        targetType: "note",
        targetId: { $in: doomed },
      });
      return { ok: true, id: input.id, targetId: doc.targetId, removed: doomed };
    }),
});
