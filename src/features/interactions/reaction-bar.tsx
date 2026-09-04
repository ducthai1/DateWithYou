"use client";

import { useEffect, useRef, useState } from "react";
import { readableFormError } from "@/lib/form-error";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/root";
import { trpc } from "@/lib/trpc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  DEFAULT_REACTION_BAR,
  REACTION_BAR_SIZE,
  REACTION_EMOJIS,
  REACTION_LABEL,
} from "@/lib/reactions";
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

const DEFAULT_EMOJI: ReactionEmoji = DEFAULT_REACTION_BAR[0];
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

  /*
   * This person's own row of six.
   *
   * Server-normalised, so it is always six known emojis in their order — the
   * bar never renders short or with something retired on it.
   */
  const bar = (members.find((m) => m.isSelf)?.reactionBar as ReactionEmoji[] | undefined)
    ?? DEFAULT_REACTION_BAR;

  const setProfile = trpc.space.setMemberProfile.useMutation({
    onSuccess: () => void utils.space.members.invalidate(),
  });
  /** Reaching for something off the row puts it on the row, in front. */
  const promote = (emoji: ReactionEmoji) => {
    if (bar[0] === emoji) return;
    setProfile.mutate({
      reactionFavourites: [emoji, ...bar.filter((e) => e !== emoji)].slice(0, REACTION_BAR_SIZE),
    });
  };

  // Long-press opens the picker; the click that follows the press must not also
  // fire the default toggle, so it is suppressed once.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  /*
   * Hover opens the row on a mouse. Gated on the pointer, not the width: a
   * touch screen has no hover to give, and long-press is its way in.
   */
  const [hoverCapable, setHoverCapable] = useState(false);
  useEffect(() => {
    setHoverCapable(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false);
  }, []);

  /*
   * Both delays earn their keep. Opening waits, so crossing the button on the
   * way somewhere else does not flash the row open. Closing waits, because the
   * pointer has to cross a gap between the button and the row above it, and
   * leaving for those few pixels must not count as leaving.
   */
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpen = () => {
    if (!hoverCapable) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setPickerOpen(true), 140);
  };
  const hoverClose = () => {
    if (!hoverCapable) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setPickerOpen(false), 260);
  };

  useEffect(
    () => () => {
      for (const t of [pressTimer, openTimer, closeTimer]) if (t.current) clearTimeout(t.current);
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

  const others = selfId ? reactions.filter((r) => r.userId !== selfId) : reactions;
  const myName = members.find((m) => m.isSelf)?.name ?? "Bạn";
  const mineLabel = mine ? (REACTION_LABEL[mine.emoji as ReactionEmoji] ?? mine.emoji) : null;

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {/*
        Whose reaction it is, on the reaction. Two emoji ringed in two colours
        told you a pair had reacted but not which was which — the name is the
        part that made it readable at a glance.
      */}
      {others.map((r) => {
        const member = members.find((m) => m.id === r.userId);
        const name = member?.name ?? "Người kia";
        const label = REACTION_LABEL[r.emoji as ReactionEmoji] ?? r.emoji;
        return (
          <span
            key={r.userId}
            role="img"
            aria-label={`${name} đã thả ${label}`}
            title={`${name} đã thả ${label}`}
            className="bg-accent-soft flex h-8 items-center gap-1 rounded-full border-2 pr-2 pl-1.5"
            // avatarColor is couple-chosen data, not a themed token; fall back
            // to the accent token so a missing colour still matches the theme.
            style={{ borderColor: member?.avatarColor ?? "var(--accent)" }}
          >
            <span className="text-sm leading-none" aria-hidden>
              {r.emoji}
            </span>
            <span className="text-foreground/80 max-w-[5rem] truncate text-[10px] font-medium">
              {name}
            </span>
          </span>
        );
      })}

      {/*
        One control, three ways in: tap sends a heart, hover opens the row on a
        mouse, long-press opens it on a thumb. The row lives inside this
        wrapper so moving the pointer up into it counts as still hovering.

        There is no "+" out here any more. That button offered the same picker
        twice and read as a second, separate action; the "+" belongs inside the
        row, where it means "reactions beyond these six".
      */}
      <div className="relative" onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
        <button
          type="button"
          aria-label={mine ? `Bỏ cảm xúc ${mineLabel}` : "Thả tim"}
          aria-pressed={Boolean(mine)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          title={mine ? `${myName}: ${mineLabel} — bấm để gỡ` : "Thả tim · giữ hoặc trỏ vào để chọn cảm xúc khác"}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            // Neither hover nor long-press reaches a keyboard; the arrow keys
            // are how a menu button is opened.
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setPickerOpen(true);
            }
          }}
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
            /*
             * Whatever is on the button is what the button undoes. Pressing it
             * with a reaction already given removes that one rather than
             * swapping it for a heart — the icon shown is the promise made.
             */
            toggle((mine?.emoji as ReactionEmoji | undefined) ?? DEFAULT_EMOJI);
          }}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-1 rounded-full text-base transition-colors select-none",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
            "touch-manipulation active:scale-95",
            mine ? "bg-accent-soft text-accent pr-2.5 pl-2" : "hover:bg-muted text-muted-foreground w-10 opacity-70",
          )}
        >
          <span aria-hidden>{mine ? mine.emoji : DEFAULT_EMOJI}</span>
          {mine && (
            <span className="text-foreground/80 max-w-[5rem] truncate text-[10px] font-medium">
              {myName}
            </span>
          )}
        </button>

        <ReactionPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          bar={bar}
          chosen={mine?.emoji as ReactionEmoji | undefined}
          onPick={(emoji) => {
            toggle(emoji);
            setPickerOpen(false);
          }}
          onPromote={promote}
          anchorRight={others.length > 0}
        />
      </div>
    </div>
  );
}

/**
 * Choosing a reaction.
 *
 * Two shapes for two kinds of hand. A bottom sheet is a touch idiom — it comes
 * from the edge a thumb can reach — and on a desktop it was a full-width panel
 * sliding up from the bottom of a 1400px window to offer six emoji. With a
 * mouse the right shape is the one Facebook settled on: a small row that
 * appears next to the thing being reacted to, close to the cursor that opened
 * it.
 *
 * The split is on pointer type, not width, which is what the app already uses
 * to choose between native and custom selects: a bottom sheet is for a thumb,
 * not for a narrow window.
 */
function ReactionPicker({
  open,
  onClose,
  bar,
  chosen,
  onPick,
  onPromote,
  anchorRight,
}: {
  open: boolean;
  onClose: () => void;
  bar: ReactionEmoji[];
  chosen?: ReactionEmoji;
  onPick: (emoji: ReactionEmoji) => void;
  onPromote: (emoji: ReactionEmoji) => void;
  /** Hang it off the trigger's right edge once reactions have pushed the
   *  trigger rightwards, or the row runs off the side of the card. */
  anchorRight: boolean;
}) {
  const [more, setMore] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCoarse(window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false);
  }, []);

  // Every open starts on the row; the extended grid is somewhere you go, not a
  // state the picker remembers you were in.
  useEffect(() => {
    if (!open) setMore(false);
  }, [open]);

  // Only the popover needs dismissing — the sheet brings its own scrim.
  useEffect(() => {
    if (!open || coarse) return;
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, coarse, onClose]);

  if (!open) return null;

  const rest = REACTION_EMOJIS.filter((e) => !bar.includes(e));
  const take = (emoji: ReactionEmoji, fromRest: boolean) => {
    if (fromRest) onPromote(emoji);
    onPick(emoji);
  };

  if (coarse) {
    return (
      <BottomSheet open={open} onClose={onClose}>
        <div className="px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <p className="text-muted-foreground mb-3 text-center text-sm">
            {more ? "Chọn để thêm vào hàng của bạn" : "Gửi một cảm xúc cho khoảnh khắc này"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(more ? rest : bar).map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={REACTION_LABEL[emoji]}
                aria-pressed={chosen === emoji}
                onClick={() => take(emoji, more)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors",
                  "focus-visible:ring-ring/50 touch-manipulation outline-none focus-visible:ring-2 active:scale-95",
                  chosen === emoji
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {emoji}
                </span>
                <span className="text-muted-foreground text-[10px]">{REACTION_LABEL[emoji]}</span>
              </button>
            ))}
            {!more && (
              <button
                type="button"
                aria-label="Xem thêm cảm xúc"
                onClick={() => setMore(true)}
                className="border-border bg-card hover:bg-muted text-muted-foreground flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors active:scale-95"
              >
                <Plus className="h-5 w-5" aria-hidden />
                <span className="text-[10px]">Thêm</span>
              </button>
            )}
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Chọn cảm xúc"
      className={cn(
        "border-border bg-card absolute bottom-full z-50 mb-1 rounded-2xl border p-1.5 shadow-xl",
        "animate-in fade-in slide-in-from-bottom-1 duration-150",
        anchorRight ? "right-0" : "left-0",
        more && "max-w-[19rem]",
      )}
    >
      <div className={cn("flex items-center gap-0.5", more && "flex-wrap")}>
        {(more ? rest : bar).map((emoji) => (
          <button
            key={emoji}
            type="button"
            title={REACTION_LABEL[emoji]}
            aria-label={REACTION_LABEL[emoji]}
            aria-pressed={chosen === emoji}
            onClick={() => take(emoji, more)}
            className={cn(
              // Grows under the cursor, the way the row it is modelled on does.
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none transition-transform",
              "hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-2 hover:scale-125",
              chosen === emoji && "bg-accent-soft",
            )}
          >
            <span aria-hidden>{emoji}</span>
          </button>
        ))}
        {!more && (
          <button
            type="button"
            title="Xem thêm cảm xúc"
            aria-label="Xem thêm cảm xúc"
            onClick={() => setMore(true)}
            className="text-muted-foreground hover:bg-muted focus-visible:ring-ring/50 ml-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
