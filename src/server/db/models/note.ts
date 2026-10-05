import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Chỗ một bình luận được treo vào. KHÁC `REACTION_TARGET_TYPES`, vốn còn có
 * `note` để thả cảm xúc lên chính bình luận — xem ghi chú ở đó.
 */
export const NOTE_TARGET_TYPES = ["memory"] as const;
export type NoteTargetType = (typeof NOTE_TARGET_TYPES)[number];

/** Bình luận gốc là cấp 1; sâu nhất là cấp 3. */
export const NOTE_MAX_DEPTH = 3;

/** Max characters in one note — a short reply, not an essay. */
export const NOTE_MAX_LENGTH = 500;

/**
 * A short note one partner leaves on a shared object.
 *
 * CÓ phân cấp, tối đa `NOTE_MAX_DEPTH` cấp. Trước đây chỗ này ghi "deliberately
 * FLAT — there never should be", lý do là một space chỉ có hai người nên trả
 * lời chẳng để phân biệt với ai. Chủ repo chốt ngược lại (05/10/2026): dưới một
 * kỷ niệm có thể có hàng chục bình luận, và "đang trả lời cái nào" là thứ cần
 * phân biệt kể cả khi chỉ có hai người.
 *
 * Giới hạn 3 cấp là có chủ ý, không phải tuỳ tiện: trả lời cho một bình luận
 * cấp 3 vẫn được, nhưng nó treo vào chính cấp 3 đó nên luồng không thụt lề vô
 * tận trên màn điện thoại.
 */
const noteSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    targetType: { type: String, required: true, enum: [...NOTE_TARGET_TYPES] },
    targetId: { type: String, required: true },
    /*
     * Bình luận cha, hoặc `null` nếu là bình luận gốc.
     *
     * Độ sâu KHÔNG lưu ở đây — nó suy ra được và một trường thừa là một trường
     * sẽ lệch. Máy chủ đi ngược lên cây lúc ghi để chặn quá 3 cấp.
     */
    parentId: { type: String, default: null },
    userId: { type: String, required: true },
    body: { type: String, required: true, maxlength: NOTE_MAX_LENGTH },
    /*
     * Ai được nhắc tên trong ghi chú này.
     *
     * Lưu id chứ không dò lại tên từ `body` lúc đọc: người ta đổi tên hiển
     * thị, và một ghi chú cũ vẫn phải nhớ nó đã nhắc ai. Bốn là dư cho một
     * không gian hai người.
     */
    mentions: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Batched `$in` lookup per target, already ordered oldest → newest so the
// chronological read needs no in-memory sort.
noteSchema.index({ spaceId: 1, targetType: 1, targetId: 1, createdAt: 1 });
// Xoá một bình luận phải quét được cả nhánh con của nó.
noteSchema.index({ spaceId: 1, parentId: 1 });

export type Note = InferSchemaType<typeof noteSchema>;

export const NoteModel = models.Note ?? model("Note", noteSchema);
