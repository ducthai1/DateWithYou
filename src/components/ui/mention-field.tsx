"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { findMentionRanges, type MentionMember } from "@/lib/mentions";

/**
 * A caption box where a named person reads as a mention, not as stray text.
 *
 * A textarea cannot colour part of its own contents — no element may live
 * inside one — so the name is painted on a layer BEHIND a see-through field
 * that mirrors it exactly. The real input is still a real input, which is the
 * whole point: the obvious alternative, a contenteditable div holding chip
 * elements, loses Vietnamese typing. Telex and UniKey compose a letter over
 * several keystrokes and handle Backspace themselves mid-word, and every
 * re-render of a contenteditable moves the text node the IME is holding — the
 * documented result is dropped or reordered diacritics and a caret that jumps
 * to the top of the box. Nobody writing "kỷ niệm" would get through a sentence.
 *
 * So: the field keeps its own visible text, and the layer below contributes
 * only the pill. Painting the letters below and hiding the field's own would
 * put the colour in the name itself — measurement says the layer does keep up
 * with a half-typed Vietnamese letter, so that much is not the objection — but
 * hiding the field's text means the caret takes its colour from that text and
 * disappears too. Overriding `caret-color` is exactly what iOS Safari ignores,
 * so on an iPhone the writer would be typing with no cursor to aim. A tinted
 * pill costs the letters their colour; a hidden caret costs the writer the
 * ability to see where they are. Read-side captions carry no field underneath,
 * and there the letters do take the accent — see MentionText.
 *
 * Deleting is the other half of reading as a mention. Backspace anywhere in a
 * name selects the whole thing and lets the browser delete the selection, so
 * one press removes "@Thủy Mai" entire — and because the deletion is the
 * browser's own, undo still works and the change arrives through onChange like
 * any other edit.
 */
export function MentionField({
  value,
  onChange,
  members,
  multiline = false,
  className,
  containerClassName,
  rows,
  ...rest
}: {
  value: string;
  onChange: (next: string) => void;
  members: MentionMember[];
  multiline?: boolean;
  className?: string;
  containerClassName?: string;
  rows?: number;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "rows" | "className"
>) {
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const ranges = useMemo(() => findMentionRanges(value, members), [value, members]);

  /*
   * The two layers scroll as one. Long captions scroll the field but not the
   * painted layer, and a pill left behind while its name scrolls away is worse
   * than no pill at all.
   */
  const syncScroll = useCallback(() => {
    const f = fieldRef.current;
    const b = backdropRef.current;
    if (!f || !b) return;
    b.scrollTop = f.scrollTop;
    b.scrollLeft = f.scrollLeft;
  }, []);

  useLayoutEffect(syncScroll, [value, syncScroll]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    /*
     * Never while composing. Telex sends Backspace as part of writing a letter
     * — "aa" then a correction — and swallowing it there would break typing
     * itself rather than just deleting the wrong thing.
     */
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    const el = e.currentTarget;
    // A selection the writer made themselves is theirs; only a bare caret is ours.
    if (el.selectionStart === null || el.selectionStart !== el.selectionEnd) return;
    const caret = el.selectionStart;
    const hit =
      e.key === "Backspace"
        ? ranges.find((r) => caret > r.start && caret <= r.end)
        : ranges.find((r) => caret >= r.start && caret < r.end);
    if (!hit) return;
    // Select it and let the browser do the deleting: native undo survives.
    el.setSelectionRange(hit.start, hit.end);
  };

  const shared = cn(
    /*
     * `block` is not cosmetic. A textarea is inline-block by default, so the
     * wrapper around it grows by the line-box leading underneath — measured at
     * 6px — and the painted layer, stretched to the wrapper, ends up taller
     * than the field. On a caption long enough to wrap, that difference slides
     * every pill away from the name it belongs to.
     */
    "block w-full whitespace-pre-wrap break-words text-left",
    multiline ? "" : "overflow-x-auto whitespace-pre",
    className,
  );

  const Field = multiline ? "textarea" : "input";

  return (
    <div className={cn("relative", containerClassName)}>
      {/* Painted layer. Its text is invisible — it exists only to place each
          pill under the letters the field itself draws on top. */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        className={cn(
          shared,
          // Keeps whatever background the caller gave (the field on top is see-through,
          // so this layer is the one actually painting it), drops only the border
          // colour and the letters.
          "pointer-events-none absolute inset-0 overflow-hidden border-transparent text-transparent select-none",
        )}
      >
        {segmentsOf(value, ranges).map((seg, i) =>
          seg.mention ? (
            <span
              key={i}
              // A stable hook for anything that needs to find a mention on the
              // page. Styling changes; this does not.
              data-mention=""
              className="bg-accent/[0.18] ring-accent/50 rounded-[5px] ring-1 [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {/* A caption ending in a newline would otherwise let the layer collapse
            a line short of the field, drifting every pill below it. */}
        {"​"}
      </div>

      <Field
        ref={fieldRef}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
          onChange(e.target.value)
        }
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        rows={rows}
        className={cn(shared, "relative bg-transparent")}
        {...rest}
      />
    </div>
  );
}

type Segment = { text: string; mention: boolean };

/** The text split into plain runs and named runs, in order. */
function segmentsOf(text: string, ranges: { start: number; end: number }[]): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: text.slice(at, r.start), mention: false });
    out.push({ text: text.slice(r.start, r.end), mention: true });
    at = r.end;
  }
  out.push({ text: text.slice(at), mention: false });
  return out;
}
