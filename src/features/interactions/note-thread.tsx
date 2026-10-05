"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { CornerDownRight, MessageCircle, RotateCw, Send, SmilePlus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MentionField } from "@/components/ui/mention-field";
import { MentionText } from "@/components/ui/mention-text";
import { appendMention, collectMentions, type MentionMember } from "@/lib/mentions";
import { DEFAULT_REACTION_BAR, REACTION_LABEL, type ReactionEmoji } from "@/lib/reactions";
import {
  buildNoteTree,
  countNotes,
  replyParentId,
  type NoteNode,
} from "./note-tree";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { clipBoundsFor, shiftIntoBounds } from "@/lib/clip-bounds";
import type {
  InteractionInput,
  InteractionMember,
  InteractionState,
  NoteRow,
  NoteTargetType,
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
 * Một bình luận và cả nhánh con của nó.
 *
 * Thụt lề bằng `ml-*` trên `<ul>` con chứ không phải padding trên từng hàng:
 * đường kẻ dọc phải chạy liền từ bình luận cha xuống hết nhánh, và nó vẽ bằng
 * `border-l` của chính `<ul>` đó. Thụt theo hàng thì mỗi hàng một đoạn kẻ rời.
 *
 * Chỉ thụt tối đa `MAX_DEPTH` cấp — xem `replyParentId`, bên máy chủ có cùng
 * luật. Trên khổ 390px, ba cấp đã ăn 2×16px của bề ngang; sâu hơn thì chữ
 * thành một cột hẹp không đọc được.
 */
function NoteItem({
  node,
  targetId,
  queryInput,
  members,
  mentionMembers,
  selfId,
  removing,
  onRemove,
  onReply,
}: {
  node: NoteNode<NoteRow>;
  targetId: string;
  queryInput: InteractionInput;
  members: InteractionMember[];
  mentionMembers: MentionMember[];
  selfId: string | null;
  removing: boolean;
  onRemove: (id: string) => void;
  onReply: (node: NoteNode<NoteRow>) => void;
}) {
  const member = members.find((m) => m.id === node.userId);
  return (
    <li className="flex gap-2">
      <Avatar member={member} />
      <div className="min-w-0 flex-1">
        {/*
          Dòng tên cao ĐÚNG BẰNG avatar (24px) và căn giữa, nên tên luôn ngang
          tâm avatar bên trái dù có nút xoá hay không. Trước đây dòng này cao
          theo phần tử cao nhất trong nó — nút xoá `min-h-10` là 40px — nên ở
          bình luận của chính mình, tên và cả đoạn chữ bên dưới bị đẩy tụt 8px
          so với avatar, còn bình luận của người kia thì lại nhỉnh lên 4px.
        */}
        <div className="flex min-h-6 items-center gap-2">
          <span className="text-foreground truncate text-xs font-medium">
            {member?.name ?? "Người kia"}
          </span>
          <span className="text-muted-foreground shrink-0 text-[10px]">
            {formatDistanceToNow(new Date(node.createdAt), { addSuffix: true, locale: vi })}
          </span>
          {selfId === node.userId && (
            <ConfirmButton
              idle="Xoá"
              aria-label="Xoá bình luận"
              /* Vẫn 40px để chạm được, nhưng `-my-2` cắt phần thừa ra khỏi
                 phép tính chiều cao: ô chạm giữ nguyên, dòng vẫn 24px. */
              className="ml-auto -my-2 min-h-10 shrink-0 px-1 text-[10px]"
              title="Xoá bình luận?"
              description={
                node.children.length > 0
                  ? "Bình luận này VÀ mọi câu trả lời bên dưới nó sẽ biến mất, không khôi phục lại được."
                  : "Bình luận này sẽ biến mất khỏi kỷ niệm và không khôi phục lại được."
              }
              confirmText="Xoá bình luận"
              disabled={removing}
              onConfirm={() => onRemove(node.id)}
            />
          )}
        </div>
        <p className="text-foreground/90 text-sm break-words whitespace-pre-wrap">
          <MentionText text={node.body} members={mentionMembers} />
        </p>
        <div className="relative -ml-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onReply(node)}
            className={cn(
              "text-muted-foreground hover:bg-muted inline-flex min-h-8 items-center gap-1 rounded-full px-1.5 text-xs transition-colors",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 touch-manipulation",
            )}
          >
            <CornerDownRight className="h-3.5 w-3.5" aria-hidden />
            Trả lời
          </button>
          <NoteReactions
            note={node}
            memoryTargetId={targetId}
            queryInput={queryInput}
            selfId={selfId}
          />
        </div>
        {node.children.length > 0 && (
          <ul className="border-border/70 mt-2 space-y-2 border-l pl-3">
            {node.children.map((child) => (
              <NoteItem
                key={child.id}
                node={child}
                targetId={targetId}
                queryInput={queryInput}
                members={members}
                mentionMembers={mentionMembers}
                selfId={selfId}
                removing={removing}
                onRemove={onRemove}
                onReply={onReply}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Cảm xúc thả lên MỘT bình luận.
 *
 * Không dùng lại `ReactionBar`: bản vá lạc quan của nó ghi vào
 * `old[targetId]`, tức khoá theo id kỷ niệm, nên một cảm xúc trên bình luận sẽ
 * không tìm thấy ô nào để sửa và nút nhấp nháy về trạng thái cũ. Ở đây phải đi
 * vào mảng `notes` rồi tìm đúng bình luận.
 *
 * Cũng cố ý gọn hơn: chỉ sáu emoji mặc định, không có nhấn-giữ mở bảng lớn.
 * Dưới một bình luận thì đây là nút phụ, không phải nhân vật chính.
 */
function NoteReactions({
  note,
  memoryTargetId,
  queryInput,
  selfId,
}: {
  note: NoteRow;
  memoryTargetId: string;
  queryInput: InteractionInput;
  selfId: string | null;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [picking, setPicking] = useState(false);
  const paletteRef = useRef<HTMLSpanElement | null>(null);
  const [shift, setShift] = useState(0);

  /*
   * Kéo bảng vào trong khung sau khi nó đã nằm xuống.
   *
   * Neo `left-0` theo hàng nút là đủ cho bình luận gốc, nhưng mỗi cấp thụt
   * thêm 45px nên ở cấp 3 bảng rộng 238px tràn 19px qua mép phải modal — đo
   * được, trong khi ảnh chụp bình luận gốc thì sạch. Không có cách thuần CSS
   * nào biết được điều đó, nên đo rồi dịch.
   */
  useLayoutEffect(() => {
    if (!picking) {
      setShift(0);
      return;
    }
    const el = paletteRef.current;
    if (!el) return;
    // Đo ở vị trí CHƯA dịch, nếu không mỗi lần mở lại cộng dồn thêm một lần.
    el.style.transform = "";
    const box = el.getBoundingClientRect();
    setShift(shiftIntoBounds(box, clipBoundsFor(el)));
  }, [picking]);

  const react = trpc.interaction.react.useMutation({
    onMutate: async (vars) => {
      if (!selfId) return { prev: undefined };
      await utils.interaction.forTargets.cancel(queryInput);
      const prev = utils.interaction.forTargets.getData(queryInput);
      utils.interaction.forTargets.setData(queryInput, (old) => {
        if (!old) return old;
        const entry = old[memoryTargetId];
        if (!entry) return old;
        const notes = entry.notes.map((n) => {
          if (n.id !== vars.targetId) return n;
          const mine = n.reactions.find((r) => r.userId === selfId);
          const next = !mine
            ? [...n.reactions, { userId: selfId, emoji: vars.emoji }]
            : mine.emoji === vars.emoji
              ? n.reactions.filter((r) => r.userId !== selfId)
              : n.reactions.map((r) => (r.userId === selfId ? { ...r, emoji: vars.emoji } : r));
          return { ...n, reactions: next };
        });
        return { ...old, [memoryTargetId]: { ...entry, notes } };
      });
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.interaction.forTargets.setData(queryInput, ctx.prev);
      toast(readableFormError(err.message, "Chưa gửi được cảm xúc"), "error");
    },
    onSettled: () => utils.interaction.forTargets.invalidate(),
  });

  const mine = selfId ? note.reactions.find((r) => r.userId === selfId) : undefined;
  // Gộp theo emoji để hiện "❤️ 2" thay vì hai trái tim rời.
  const grouped = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of note.reactions) m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1);
    return [...m.entries()];
  }, [note.reactions]);

  function toggle(emoji: ReactionEmoji) {
    setPicking(false);
    react.mutate({ targetType: "note", targetId: note.id, emoji });
  }

  return (
    <span className="inline-flex items-center gap-1">
      {grouped.map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => toggle(emoji as ReactionEmoji)}
          aria-label={`${REACTION_LABEL[emoji as ReactionEmoji] ?? emoji}${mine?.emoji === emoji ? " — bỏ cảm xúc" : ""}`}
          className={cn(
            "inline-flex min-h-8 items-center gap-0.5 rounded-full px-1.5 text-xs transition-colors",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 touch-manipulation",
            mine?.emoji === emoji ? "bg-accent/15 text-accent-ink" : "hover:bg-muted",
          )}
        >
          <span aria-hidden>{emoji}</span>
          {count > 1 && <span className="tabular-nums">{count}</span>}
        </button>
      ))}
      <button
        type="button"
        aria-label="Thả cảm xúc"
        aria-expanded={picking}
        onClick={() => setPicking((v) => !v)}
        className={cn(
          "text-muted-foreground hover:bg-muted inline-flex min-h-8 items-center rounded-full px-1.5 transition-colors",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 touch-manipulation",
        )}
      >
        <SmilePlus className="h-3.5 w-3.5" aria-hidden />
      </button>
      {picking && (
        <>
          {/* Chạm ra ngoài là đóng — không cần nghe sự kiện toàn cục. */}
          <span
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setPicking(false)}
          />
          <span
            ref={paletteRef}
            role="group"
            aria-label="Chọn cảm xúc"
            style={shift ? { transform: `translateX(${shift}px)` } : undefined}
            /*
             * Mở LÊN TRÊN, và neo theo mép trái của HÀNG NÚT.
             *
             * Lên trên vì hàng nút nằm dưới cùng mỗi bình luận, còn bình luận
             * cuối thì sát ô soạn — mở xuống là rơi đúng vào ô soạn.
             *
             * Neo theo hàng chứ không theo cái nút: nút cảm xúc đứng sau nút
             * "Trả lời" nên nó lệch sang phải, và một bảng 238px mọc từ đó
             * chạy quá mép phải modal — ảnh chụp thấy mặt cười cuối bị cắt mất
             * một nửa, trong khi mọi phép đo theo chiều dọc đều báo sạch.
             */
            className="border-border bg-card shadow-elev-float absolute bottom-full left-0 z-50 mb-1 flex gap-0.5 rounded-xl border px-1.5 py-1"
          >
            {DEFAULT_REACTION_BAR.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => toggle(emoji)}
                aria-label={REACTION_LABEL[emoji] ?? emoji}
                className="hover:bg-muted inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-base transition-transform active:scale-90"
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </span>
        </>
      )}
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
  /*
   * Nơi TREO bình luận. Hẹp hơn `InteractionInput["targetType"]`, vốn còn có
   * "note" để thả cảm xúc lên chính bình luận — một bình luận không treo vào
   * một bình luận khác, nó dùng `parentId`.
   */
  targetType: NoteTargetType;
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
  const [replyTo, setReplyTo] = useState<NoteNode<NoteRow> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

  const tree = useMemo(() => buildNoteTree(notes), [notes]);
  const total = useMemo(() => countNotes(tree), [tree]);

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
        .map((m) => ({ id: m.id, name: m.name as string, accountName: m.accountName, aliases: m.aliases })),
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
      setReplyTo(null);
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
    onError: (err) => toast(readableFormError(err.message, "Chưa gửi được bình luận"), "error"),
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
      toast(readableFormError(err.message, "Chưa xoá được bình luận"), "error");
    },
    // Xoá cũng phải quét cả hai nơi — xem ghi chú ở addNote.
    onSettled: () => utils.interaction.forTargets.invalidate(),
  });

  /**
   * Bấm "Trả lời": mở ô soạn, điền sẵn `@tên`, đưa con trỏ ra cuối.
   *
   * Điền bằng `appendMention` chứ không nối chuỗi tay — nó là cùng một hàm mà
   * chip gợi ý dùng, nên cái tên vừa chèn khớp y hệt thứ `findMentionRanges`
   * đọc ra sau này. Nối tay thiếu một dấu cách là cái tên không thành thẻ, và
   * người được nhắc không nhận được chuông.
   */
  function startReply(node: NoteNode<NoteRow>) {
    setOpen(true);
    setReplyTo(node);
    const name = members.find((m) => m.id === node.userId)?.name?.trim();
    // Không tự tag chính mình khi trả lời bình luận của chính mình.
    setDraft((d) => (name && node.userId !== selfId ? appendMention(d, name) : d));
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      composerRef.current?.querySelector<HTMLElement>("[aria-label='Nội dung bình luận']")?.focus();
    });
  }

  if (state === "loading") {
    return <Skeleton className="h-8 w-28" />;
  }

  if (state === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-xs">Chưa tải được bình luận.</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-accent-ink focus-visible:ring-ring/50 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium outline-none focus-visible:ring-2"
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
    addNote.mutate({
      targetType,
      targetId,
      body,
      mentions: collectMentions(body, mentionMembers),
      // Máy chủ vẫn tự kiểm độ sâu; đây chỉ là ý định của client.
      parentId: replyTo ? replyParentId(replyTo) : null,
    });
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
        {total > 0 ? `${total} bình luận` : "Thêm bình luận"}
      </button>

      {open && (
        <div ref={panelRef} className="space-y-2">
          {tree.length > 0 ? (
            <ul className="space-y-2">
              {tree.map((node) => (
                <NoteItem
                  key={node.id}
                  node={node}
                  targetId={targetId}
                  queryInput={queryInput}
                  members={members}
                  mentionMembers={mentionMembers}
                  selfId={selfId}
                  removing={removeNote.isPending}
                  onRemove={(id) => removeNote.mutate({ id })}
                  onReply={startReply}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              Chưa có bình luận nào — viết vài dòng cho người kia đọc nhé. Gõ{" "}
              <span className="text-accent-ink font-medium">@</span> để nhắc tên.
            </p>
          )}

          <div ref={composerRef} className="space-y-1.5">
            {replyTo && (
              /*
               * Phải NHÌN THẤY mình đang trả lời ai.
               *
               * Chỉ điền sẵn "@tên" vào ô là không đủ: người ta xoá cái tên đi
               * rồi gõ tiếp là mất hết dấu vết, nhưng bình luận vẫn treo vào
               * nhánh cũ. Dòng này là thứ duy nhất nói đúng chỗ nó sắp rơi vào.
               */
              <div className="bg-muted/60 text-muted-foreground flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs">
                <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">
                  Đang trả lời{" "}
                  <span className="text-foreground font-medium">
                    {members.find((m) => m.id === replyTo.userId)?.name ?? "Người kia"}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Huỷ trả lời"
                  onClick={() => setReplyTo(null)}
                  className="hover:bg-muted focus-visible:ring-ring/50 ml-auto -my-1 inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
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
                placeholder={replyTo ? "Viết câu trả lời…" : "Viết bình luận…"}
                aria-label="Nội dung bình luận"
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
              aria-label={replyTo ? "Gửi câu trả lời" : "Gửi bình luận"}
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
        </div>
      )}
    </div>
  );
}
