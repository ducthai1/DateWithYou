"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { MessageCircle, RotateCw, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MentionField } from "@/components/ui/mention-field";
import { MentionText } from "@/components/ui/mention-text";
import { collectMentions, type MentionMember } from "@/lib/mentions";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type {
  InteractionInput,
  InteractionMember,
  InteractionState,
  NoteRow,
} from "./reaction-bar";

/** Matches NOTE_MAX_LENGTH on the server so the box stops before the API does. */
const MAX_LENGTH = 500;

function Avatar({ member }: { member: InteractionMember | undefined }) {
  const name = member?.name ?? "Người kia";
  if (member?.image) {
    return (
      <img
        src={member.image}
        alt={name}
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      // avatarColor is couple-chosen data; the accent token covers the default.
      style={{ backgroundColor: member?.avatarColor ?? "var(--accent)" }}
    >
      {member?.avatarEmoji ?? name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Flat notes on a shared object — oldest first, collapsed behind a count.
 *
 * There is no threading and there never should be: with exactly two people in
 * a space a reply has nothing to disambiguate. A note *count* is fine — that's
 * content volume, unlike a reaction count.
 */
export function NoteThread({
  targetType,
  targetId,
  queryInput,
  notes,
  members,
  selfId,
  state,
  onRetry,
}: {
  targetType: InteractionInput["targetType"];
  targetId: string;
  queryInput: InteractionInput;
  notes: NoteRow[];
  members: InteractionMember[];
  selfId: string | null;
  state: InteractionState;
  onRetry: () => void;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  /*
   * Mở ra thì phải NHÌN THẤY.
   *
   * Thẻ nằm giữa dòng thời gian, và luồng ghi chú mọc thêm xuống dưới — trên
   * điện thoại nó chui thẳng xuống dưới thanh điều hướng cố định và bị cắt
   * ngang. Chụp màn mới thấy: bấm "1 ghi chú" xong không thấy ghi chú nào,
   * chữ bị dock xén mất một nửa. `block: "nearest"` chỉ cuộn đúng phần thiếu,
   * không giật cả trang khi thẻ vốn đã nằm trọn trong tầm nhìn.
   */
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  /*
   * Ai ĐƯỢC TÍNH là nhắc tên, và ai ĐƯỢC GỢI Ý — hai câu hỏi khác nhau.
   *
   * Trả lời chung một danh sách là một lỗi sờ thấy được: dùng danh sách
   * "chỉ người kia" cho cả hai thì chính tên MÌNH trong ghi chú không thành
   * thẻ, và Backspace ăn từng chữ cái, trong khi tên người kia xoá nguyên
   * cụm. Cùng một dòng chữ, hai hành vi, tuỳ tên của ai.
   */
  const mentionMembers: MentionMember[] = useMemo(
    () =>
      members
        .filter((m) => m.name?.trim())
        .map((m) => ({ id: m.id, name: m.name as string, accountName: m.accountName })),
    [members],
  );
  // Không ai tự gõ "@" để tag chính mình.
  const suggest = useMemo(
    () => mentionMembers.filter((m) => m.id !== selfId),
    [mentionMembers, selfId],
  );

  const addNote = trpc.interaction.addNote.useMutation({
    onSuccess: () => {
      setDraft("");
      /*
       * Làm mới MỌI lô, không riêng lô của mình.
       *
       * Cùng một luồng ghi chú hiện ở hai nơi — thẻ ngoài danh sách đọc theo
       * lô 50 id, modal chi tiết đọc một id — nên hai chỗ có hai query key.
       * Chỉ gọi key của mình thì viết trong modal xong quay ra thẻ vẫn thấy
       * luồng cũ.
       */
      utils.interaction.forTargets.invalidate();
    },
    onError: (err) => toast(readableFormError(err.message, "Chưa gửi được ghi chú"), "error"),
  });

  const removeNote = trpc.interaction.removeNote.useMutation({
    // The row goes now; the server hears about it after. Waiting a round
    // trip before a confirmed delete takes effect reads as a dead button.
    onMutate: async ({ id }) => {
      await utils.interaction.forTargets.cancel(queryInput);
      const prev = utils.interaction.forTargets.getData(queryInput);
      utils.interaction.forTargets.setData(queryInput, (old) => {
        if (!old) return old;
        const next: typeof old = {};
        for (const [target, v] of Object.entries(old)) {
          next[target] = { ...v, notes: v.notes.filter((n) => n.id !== id) };
        }
        return next;
      });
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.interaction.forTargets.setData(queryInput, ctx.prev);
      toast(readableFormError(err.message, "Chưa xoá được ghi chú"), "error");
    },
    // Xoá cũng phải quét cả hai nơi — xem ghi chú ở addNote.
    onSettled: () => utils.interaction.forTargets.invalidate(),
  });

  if (state === "loading") {
    return <Skeleton className="h-8 w-28" />;
  }

  if (state === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-xs">Chưa tải được ghi chú.</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-accent focus-visible:ring-ring/50 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium outline-none focus-visible:ring-2"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          Thử lại
        </button>
      </div>
    );
  }

  const body = draft.trim();

  function submit() {
    if (!body || addNote.isPending) return;
    addNote.mutate({ targetType, targetId, body, mentions: collectMentions(body, mentionMembers) });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "text-muted-foreground hover:bg-muted inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 touch-manipulation",
        )}
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        {notes.length > 0 ? `${notes.length} ghi chú` : "Thêm ghi chú"}
      </button>

      {open && (
        <div ref={panelRef} className="space-y-2">
          {notes.length > 0 ? (
            <ul className="space-y-2">
              {notes.map((n) => {
                const member = members.find((m) => m.id === n.userId);
                return (
                  <li key={n.id} className="flex gap-2">
                    <Avatar member={member} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground truncate text-xs font-medium">
                          {member?.name ?? "Người kia"}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                            locale: vi,
                          })}
                        </span>
                        {selfId === n.userId && (
                          <ConfirmButton
                            idle="Xoá"
                            aria-label="Xoá ghi chú"
                            className="ml-auto min-h-10 shrink-0 px-1 text-[10px]"
                            title="Xoá ghi chú?"
                            description="Ghi chú này sẽ biến mất khỏi kỷ niệm và không khôi phục lại được."
                            confirmText="Xoá ghi chú"
                            disabled={removeNote.isPending}
                            onConfirm={() => removeNote.mutate({ id: n.id })}
                          />
                        )}
                      </div>
                      <p className="text-foreground/90 text-sm break-words whitespace-pre-wrap">
                        <MentionText text={n.body} members={mentionMembers} />
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              Chưa có ghi chú nào — viết vài dòng cho người kia đọc nhé. Gõ{" "}
              <span className="text-accent font-medium">@</span> để nhắc tên.
            </p>
          )}

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="min-w-0 flex-1">
              <MentionField
                value={draft}
                onChange={setDraft}
                members={mentionMembers}
                suggest={suggest}
                maxLength={MAX_LENGTH}
                placeholder="Viết ghi chú…"
                aria-label="Nội dung ghi chú"
                /*
                 * Cao đúng bằng nút gửi bên cạnh (44px, cũng là mức chạm tối
                 * thiểu). Lệch 3px thì hai cái cạnh nhau đọc ra là đặt nhầm
                 * chứ không ai nghĩ là cố ý. Class này rơi vào CẢ hai lớp của
                 * MentionField nên lớp vẽ pill vẫn khít với chữ.
                 */
                /*
                 * Cao đúng bằng nút gửi bên cạnh (44px, cũng là mức chạm tối
                 * thiểu). Lệch 3px thì hai cái cạnh nhau đọc ra là đặt nhầm
                 * chứ không ai nghĩ là cố ý.
                 *
                 * Placeholder NGẮN, không nhét gợi ý "@" vào đây. Đo thật:
                 * chỗ cho chữ còn 224px ở khổ 360 và 184px ở khổ 320, trong
                 * khi câu có gợi ý dài 270px — nó đứt ngang giữa chữ, và
                 * `text-ellipsis` trên `::placeholder` không ăn vì ô này cuộn
                 * ngang. Gợi ý chuyển xuống dòng trạng thái rỗng bên dưới, chỗ
                 * được phép xuống hàng nên không bao giờ bị cắt.
                 */
                className="h-11 py-2.5"
              />
            </div>
            <button
              type="submit"
              aria-label="Gửi ghi chú"
              disabled={!body || addNote.isPending}
              className={cn(
                "bg-accent text-accent-foreground inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all",
                "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 touch-manipulation active:scale-95",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
