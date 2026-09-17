"use client";

import { useMemo, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { MentionField } from "@/components/ui/mention-field";
import { MentionText } from "@/components/ui/mention-text";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/lib/trpc";
import { collectMentions, type MentionMember } from "@/lib/mentions";
import { MAX_COMMENT } from "@/lib/memory-limits";
import { cn } from "@/lib/utils";

/**
 * The thread under one memory.
 *
 * Two people share a space, so this is a conversation between exactly two —
 * which is why there are no avatars, no threading and no reactions: at that
 * size they are chrome around two lines of text. What it does carry is the
 * same "@" naming as the caption above it, because the reason to write under
 * a memory at all is usually to say something TO the other person.
 *
 * Deleting is your own line only, enforced on the server. The button is hidden
 * on the other person's line rather than shown and refused — an action offered
 * and then denied reads as a bug.
 */
export function MemoryComments({
  memoryId,
  members,
  selfId,
}: {
  memoryId: string;
  /** Everyone, for reading names out of the text. */
  members: MentionMember[];
  selfId: string | null;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const list = trpc.memory.comments.useQuery({ memoryId });
  const add = trpc.memory.addComment.useMutation();
  const remove = trpc.memory.deleteComment.useMutation();
  const [text, setText] = useState("");

  /* You do not tag yourself; you are still a name the text can contain. */
  const suggest = useMemo(() => members.filter((m) => m.id !== selfId), [members, selfId]);

  const submit = () => {
    const body = text.trim();
    if (!body || add.isPending) return;
    add.mutate(
      { memoryId, text: body, mentions: collectMentions(body, suggest) },
      {
        onSuccess: () => {
          setText("");
          void utils.memory.comments.invalidate({ memoryId });
        },
        onError: () => toast("Chưa gửi được, thử lại nhé", "error"),
      },
    );
  };

  const rows = list.data ?? [];

  return (
    <section className="border-border space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">
        Bình luận{rows.length > 0 ? ` (${rows.length})` : ""}
      </h3>

      {list.isPending ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Đang tải…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Chưa có bình luận nào. Viết gì đó cho người kia đọc nhé.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const mine = c.authorId === selfId;
            return (
              <li
                key={c.id}
                className={cn(
                  "group border-border/70 rounded-xl border px-3 py-2",
                  mine ? "bg-accent-soft/40" : "bg-muted/40",
                )}
              >
                <div className="flex items-start gap-2">
                  {/* wrap-anywhere: a comment can be one 500-character word,
                      and nothing stops somebody pasting a link into it. */}
                  <p className="wrap-anywhere min-w-0 flex-1 text-sm leading-relaxed">
                    <MentionText text={c.text} members={members} />
                  </p>
                  {mine && (
                    <button
                      type="button"
                      aria-label="Xoá bình luận"
                      onClick={() =>
                        remove.mutate(
                          { id: c.id },
                          { onSuccess: () => void utils.memory.comments.invalidate({ memoryId }) },
                        )
                      }
                      className="text-muted-foreground hover:text-destructive -mr-1 shrink-0 rounded-md p-1 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
                {c.createdAt && (
                  <p className="text-muted-foreground/70 mt-0.5 text-[11px]">
                    {new Date(c.createdAt).toLocaleString("vi-VN", {
                      day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-1.5">
        <MentionField
          multiline
          rows={2}
          value={text}
          onChange={setText}
          members={members}
          suggest={suggest}
          maxLength={MAX_COMMENT}
          placeholder="Viết bình luận… gõ @ để nhắc tên"
          className="border-border bg-card focus:border-accent focus:ring-accent/20 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-1"
        />
        <div className="flex items-center justify-between gap-2">
          {/* Only near the end: a counter on an empty box is noise, and this
              one exists to stop somebody losing the tail of a long line. */}
          <span className="text-muted-foreground text-[11px]">
            {text.length > MAX_COMMENT - 80 ? `${text.length}/${MAX_COMMENT}` : ""}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || add.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {add.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Gửi
          </button>
        </div>
      </div>
    </section>
  );
}
