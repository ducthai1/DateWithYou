"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { MessageCircle, RotateCw, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
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
  const name = member?.name ?? "Người ấy";
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

  const addNote = trpc.interaction.addNote.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.interaction.forTargets.invalidate(queryInput);
    },
    onError: (err) => toast(err.message || "Chưa gửi được ghi chú", "error"),
  });

  const removeNote = trpc.interaction.removeNote.useMutation({
    onSuccess: () => utils.interaction.forTargets.invalidate(queryInput),
    onError: (err) => toast(err.message || "Chưa xoá được ghi chú", "error"),
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
    addNote.mutate({ targetType, targetId, body });
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
        <div className="space-y-2">
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
                          {member?.name ?? "Người ấy"}
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
                        {n.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              Chưa có ghi chú nào — viết vài dòng cho người ấy đọc nhé.
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
              <Input
                value={draft}
                maxLength={MAX_LENGTH}
                placeholder="Viết một ghi chú…"
                aria-label="Nội dung ghi chú"
                onChange={(e) => setDraft(e.target.value)}
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
