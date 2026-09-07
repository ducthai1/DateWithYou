"use client";

import { useEffect, useRef, useState } from "react";
import { readableFormError } from "@/lib/form-error";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/root";
import { trpc } from "@/lib/trpc";
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

  /*
   * Long-press, the way Facebook and Instagram do it on a phone.
   *
   * The first version armed a timer on pointerdown and cleared it on
   * pointerleave/pointercancel. On a touch screen that never fired: the button
   * allowed panning (touch-manipulation), so the browser claimed the gesture
   * within a few hundred milliseconds, sent pointercancel, the timer died, and
   * the tap that followed dropped a heart. Holding longer selected the text
   * around it instead. What makes it work:
   *  - touch-action: none on the button, so the browser never takes the
   *    gesture away;
   *  - the timer survives small movement (a thumb is never still) and is
   *    cancelled only past a 10px slop;
   *  - user-select and the iOS callout are off for the whole row;
   *  - once the row is open the finger keeps moving with pointer capture, the
   *    emoji under it lights up, and lifting off picks it — one gesture.
   * The click that follows a long-press must not also fire the default
   * toggle, so it is suppressed once.
   */
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const [slideTarget, setSlideTarget] = useState<ReactionEmoji | null>(null);
  const SLOP_PX = 10;
  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

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
    <div
      className="relative flex flex-wrap items-end gap-1.5 select-none [-webkit-touch-callout:none]"
      onPointerLeave={hoverClose}
    >
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
            className="flex flex-col items-center"
          >
            <span
              className="bg-accent-soft grid h-9 w-9 place-items-center rounded-full border-2 text-base leading-none"
              // avatarColor is couple-chosen data, not a themed token; fall back
              // to the accent token so a missing colour still matches the theme.
              style={{ borderColor: member?.avatarColor ?? "var(--accent)" }}
              aria-hidden
            >
              {r.emoji}
            </span>
            <span
              className="border-border bg-card text-foreground/75 -mt-1.5 max-w-[4.5rem] truncate rounded-full border px-1.5 text-[9px] leading-[1.4] font-medium"
              aria-hidden
            >
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
      <div className="relative">
        <button
          type="button"
          aria-label={mine ? `Bỏ cảm xúc ${mineLabel}` : "Thả tim"}
          aria-pressed={Boolean(mine)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          title={mine ? `${myName}: ${mineLabel} — bấm để gỡ` : "Thả tim · giữ hoặc trỏ vào để chọn cảm xúc khác"}
          onPointerEnter={hoverOpen}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            // Neither hover nor long-press reaches a keyboard; the arrow keys
            // are how a menu button is opened.
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setPickerOpen(true);
            }
          }}
          onPointerDown={(e) => {
            longPressed.current = false;
            pressStart.current = { x: e.clientX, y: e.clientY };
            const target = e.currentTarget;
            const pointerId = e.pointerId;
            clearPress();
            pressTimer.current = setTimeout(() => {
              longPressed.current = true;
              setPickerOpen(true);
              // A short buzz says "the row is open" before the eye finds it.
              try {
                navigator.vibrate?.(12);
              } catch {
                /* not every browser lets a page buzz */
              }
              // Keep receiving the finger's moves while it slides over the row.
              try {
                target.setPointerCapture(pointerId);
              } catch {
                /* capture is best-effort */
              }
            }, LONG_PRESS_MS);
          }}
          onPointerMove={(e) => {
            if (pressTimer.current && pressStart.current) {
              const d = Math.hypot(e.clientX - pressStart.current.x, e.clientY - pressStart.current.y);
              if (d > SLOP_PX) clearPress();
            }
            if (longPressed.current && pickerOpen) {
              const under = document
                .elementFromPoint(e.clientX, e.clientY)
                ?.closest<HTMLElement>("[data-emoji]");
              setSlideTarget((under?.dataset.emoji as ReactionEmoji | undefined) ?? null);
            }
          }}
          onPointerUp={(e) => {
            clearPress();
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* nothing captured */
            }
            // Lifting off over an emoji is the pick. Lifting off elsewhere
            // leaves the row open for a tap.
            if (longPressed.current && slideTarget) {
              toggle(slideTarget);
              setPickerOpen(false);
              setSlideTarget(null);
            }
          }}
          onPointerCancel={clearPress}
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
          className="flex flex-col items-center rounded-2xl outline-none select-none [touch-action:none] [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full text-base transition-colors",
              "active:scale-95",
              mine ? "bg-accent-soft ring-accent/60 ring-2" : "hover:bg-muted text-muted-foreground opacity-70",
            )}
            aria-hidden
          >
            {mine ? mine.emoji : DEFAULT_EMOJI}
          </span>
          {mine && (
            <span
              className="border-border bg-card text-foreground/75 -mt-1.5 max-w-[4.5rem] truncate rounded-full border px-1.5 text-[9px] leading-[1.4] font-medium"
              aria-hidden
            >
              {myName}
            </span>
          )}
        </button>

      </div>

      {/*
        Anchored to the row, not to the button. Hung off the button it slid
        left as reactions pushed the button rightwards, and ran out past the
        card's edge — where the card clipped it and ate a reaction whole. The
        row starts at the card's content edge, so from here it can only ever
        grow inwards.
      */}
      <ReactionPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setSlideTarget(null);
        }}
        bar={bar}
        highlight={slideTarget}
        chosen={mine?.emoji as ReactionEmoji | undefined}
        onPick={(emoji) => {
          toggle(emoji);
          setPickerOpen(false);
        }}
        onPromote={promote}
      />
    </div>
  );
}

/**
 * Choosing a reaction.
 *
 * One shape for every hand: the row that appears right above the button, the
 * one Facebook settled on. The phone used to get a bottom sheet — a second
 * screen, a second tap, and a gesture that had to end before it could begin.
 * With slide-to-pick the row IS the touch idiom: hold, slide, let go.
 *
 * Buttons are a little larger for a thumb, and the one under the finger grows,
 * so you can see what you are about to pick before you commit to it.
 */
function ReactionPicker({
  open,
  onClose,
  bar,
  chosen,
  highlight,
  onPick,
  onPromote,
}: {
  open: boolean;
  onClose: () => void;
  bar: ReactionEmoji[];
  chosen?: ReactionEmoji;
  /** The emoji currently under a sliding finger, if any. */
  highlight: ReactionEmoji | null;
  onPick: (emoji: ReactionEmoji) => void;
  onPromote: (emoji: ReactionEmoji) => void;
}) {
  const [more, setMore] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Every open starts on the row; the extended grid is somewhere you go, not a
  // state the picker remembers you were in.
  useEffect(() => {
    if (!open) setMore(false);
  }, [open]);

  // Dismiss on a press anywhere else. pointerdown, not mousedown, so a finger
  // counts as well as a mouse.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // The trigger button is the row's sibling; a press on it is handled there.
      if (popRef.current?.contains(t) || popRef.current?.parentElement?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const rest = REACTION_EMOJIS.filter((e) => !bar.includes(e));
  const take = (emoji: ReactionEmoji, fromRest: boolean) => {
    if (fromRest) onPromote(emoji);
    onPick(emoji);
  };

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Chọn cảm xúc"
      className={cn(
        "border-border bg-card absolute bottom-full left-0 z-50 mb-1.5 rounded-full border p-1 shadow-xl",
        "animate-in fade-in slide-in-from-bottom-1 duration-150 select-none [-webkit-touch-callout:none]",
        more && "max-w-[19rem] rounded-2xl",
      )}
    >
      <div className={cn("flex items-center gap-0.5", more && "flex-wrap")}>
        {(more ? rest : bar).map((emoji) => {
          const lit = highlight === emoji;
          return (
            <button
              key={emoji}
              type="button"
              data-emoji={emoji}
              title={REACTION_LABEL[emoji]}
              aria-label={REACTION_LABEL[emoji]}
              aria-pressed={chosen === emoji}
              onClick={() => take(emoji, more)}
              className={cn(
                // Grows under the cursor or the finger, the way the row it is
                // modelled on does.
                "inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none transition-transform",
                "hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-2 hover:scale-125",
                chosen === emoji && "bg-accent-soft",
                lit && "bg-muted scale-125",
              )}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
        {!more && (
          <button
            type="button"
            title="Xem thêm cảm xúc"
            aria-label="Xem thêm cảm xúc"
            onClick={() => setMore(true)}
            className="text-muted-foreground hover:bg-muted focus-visible:ring-ring/50 ml-0.5 inline-flex h-11 w-11 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
