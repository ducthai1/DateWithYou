"use client";

import { useEffect, useRef, useState } from "react";
import { readableFormError } from "@/lib/form-error";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/root";
import { trpc } from "@/lib/trpc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Plus, RotateCw } from "lucide-react";

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Exact input the timeline used for its batched `forTargets` fetch — reused as
 *  the react-query cache key so the optimistic patch lands on the right entry. */
export type InteractionInput = RouterInputs["interaction"]["forTargets"];
export type InteractionState = "loading" | "error" | "ready";

type TargetInteractions = RouterOutputs["interaction"]["forTargets"][string];
export type ReactionRow = TargetInteractions["reactions"][number];
export type NoteRow = TargetInteractions["notes"][number];
export type InteractionMember = RouterOutputs["space"]["members"][number];

type ReactionEmoji = RouterInputs["interaction"]["react"]["emoji"];

/**
 * Mirrors REACTION_EMOJIS on the server. `satisfies` fails the type-check if
 * the two ever drift — the server enum stays the single authority, this array
 * only exists so the picker doesn't have to import Mongoose into the browser.
 */
const PALETTE = ["❤️", "😍", "🥹", "😂", "🔥", "👏"] as const satisfies readonly ReactionEmoji[];

/** Vietnamese label per emoji — screen readers get words, not codepoints. */
const EMOJI_LABEL: Record<ReactionEmoji, string> = {
  "❤️": "Thương",
  "😍": "Mê quá",
  "🥹": "Xúc động",
  "😂": "Cười",
  "🔥": "Cháy",
  "👏": "Vỗ tay",
};

const DEFAULT_EMOJI: ReactionEmoji = "❤️";
const LONG_PRESS_MS = 450;

/**
 * One-tap reciprocity on a shared object.
 *
 * Shows the emoji each partner actually chose, ringed in that person's avatar
 * colour — never a count. At n=2 a number says nothing the two faces don't
 * already say, and "và 1 người khác" is meaningless.
 */
export function ReactionBar({
  targetType,
  targetId,
  queryInput,
  reactions,
  members,
  selfId,
  state,
  onRetry,
}: {
  targetType: InteractionInput["targetType"];
  targetId: string;
  queryInput: InteractionInput;
  reactions: ReactionRow[];
  members: InteractionMember[];
  selfId: string | null;
  state: InteractionState;
  onRetry: () => void;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Long-press opens the picker; the click that follows the press must not also
  // fire the default toggle, so it is suppressed once.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    [],
  );

  const react = trpc.interaction.react.useMutation({
    // Optimistic: patch the batched cache entry so the tap lands instantly,
    // then reconcile on settle. Mirrors the server's toggle/replace rules.
    onMutate: async (vars) => {
      if (!selfId) return { prev: undefined };
      await utils.interaction.forTargets.cancel(queryInput);
      const prev = utils.interaction.forTargets.getData(queryInput);
      utils.interaction.forTargets.setData(queryInput, (old) => {
        if (!old) return old;
        const entry = old[vars.targetId];
        if (!entry) return old;
        const mine = entry.reactions.find((r) => r.userId === selfId);
        const next = !mine
          ? [...entry.reactions, { userId: selfId, emoji: vars.emoji }]
          : mine.emoji === vars.emoji
            ? entry.reactions.filter((r) => r.userId !== selfId)
            : entry.reactions.map((r) =>
                r.userId === selfId ? { ...r, emoji: vars.emoji } : r,
              );
        return { ...old, [vars.targetId]: { ...entry, reactions: next } };
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.interaction.forTargets.setData(queryInput, ctx.prev);
      toast(readableFormError(err.message, "Chưa gửi được cảm xúc"), "error");
    },
    onSettled: () => utils.interaction.forTargets.invalidate(),
  });

  const mine = selfId ? reactions.find((r) => r.userId === selfId) : undefined;

  function toggle(emoji: ReactionEmoji) {
    react.mutate({ targetType, targetId, emoji });
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-1.5" aria-hidden>
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-20" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-xs">Chưa tải được cảm xúc.</p>
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

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => {
        const member = members.find((m) => m.id === r.userId);
        const name = member?.name ?? "Người kia";
        return (
          <span
            key={r.userId}
            role="img"
            aria-label={`${name} đã thả ${EMOJI_LABEL[r.emoji as ReactionEmoji] ?? r.emoji}`}
            title={`${name} đã thả ${r.emoji}`}
            className="bg-accent-soft flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm leading-none"
            // avatarColor is couple-chosen data, not a themed token; fall back
            // to the accent token so a missing colour still matches the theme.
            style={{ borderColor: member?.avatarColor ?? "var(--accent)" }}
          >
            {r.emoji}
          </span>
        );
      })}

      <button
        type="button"
        aria-label={
          mine
            ? mine.emoji === DEFAULT_EMOJI
              ? "Bỏ thả tim"
              : "Đổi thành thả tim"
            : "Thả tim"
        }
        aria-pressed={mine?.emoji === DEFAULT_EMOJI}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={() => {
          longPressed.current = false;
          pressTimer.current = setTimeout(() => {
            longPressed.current = true;
            setPickerOpen(true);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onPointerLeave={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onPointerCancel={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          toggle(DEFAULT_EMOJI);
        }}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full text-base transition-colors select-none",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
          "touch-manipulation active:scale-95",
          mine?.emoji === DEFAULT_EMOJI
            ? "bg-accent-soft text-accent"
            : "hover:bg-muted text-muted-foreground opacity-70",
        )}
      >
        <span aria-hidden>{DEFAULT_EMOJI}</span>
      </button>

      {/* Long-press is not reachable by keyboard, so the picker always has this
          plain button as an equivalent affordance. */}
      <button
        type="button"
        aria-label="Chọn cảm xúc khác"
        onClick={() => setPickerOpen(true)}
        className={cn(
          "text-muted-foreground hover:bg-muted inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 touch-manipulation active:scale-95",
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <p className="text-muted-foreground mb-3 text-center text-sm">
            Gửi một cảm xúc cho khoảnh khắc này
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={EMOJI_LABEL[emoji]}
                aria-pressed={mine?.emoji === emoji}
                onClick={() => {
                  toggle(emoji);
                  setPickerOpen(false);
                }}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 touch-manipulation active:scale-95",
                  mine?.emoji === emoji
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {emoji}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {EMOJI_LABEL[emoji]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
