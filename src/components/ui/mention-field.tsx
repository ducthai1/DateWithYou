"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  applyMention,
  filterMentionCandidates,
  findMentionRanges,
  mentionQueryAt,
  type MentionMember,
  type MentionQuery,
} from "@/lib/mentions";

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
 * Typing "@" opens the list of people, which is the half that was missing:
 * the chips under the field only ever appended to the END, so naming somebody
 * mid-sentence meant typing their name letter-perfect, tone marks and all.
 *
 * Two things shape how the list is built.
 *
 * It is a combobox in the W3C sense — the field keeps DOM focus and points at
 * the active row with `aria-activedescendant`, rather than focus moving into
 * the list. Moving focus would close the phone keyboard mid-word, which is
 * exactly when the list is most needed.
 *
 * And every key that ACTS is gated on `isComposing`. Vietnamese Telex commits
 * a syllable with a key event that arrives as Enter with `isComposing: true` —
 * so binding Enter to "pick the highlighted name" without that guard inserts a
 * mention every time somebody finishes a word. The Backspace handler below
 * already guards for the same reason.
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

  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);
  /*
   * Dismissing is remembered by OFFSET, not by a boolean.
   *
   * Escape has to close this "@" without closing the next one, and a plain
   * flag cleared on the next keystroke reopens the list on the very next
   * letter — which is the same list they just dismissed.
   */
  const [dismissed, setDismissed] = useState<number | null>(null);
  const caretRef = useRef(0);
  const listId = useId();

  const candidates = useMemo(
    () => (query ? filterMentionCandidates(members, query.query) : []),
    [query, members],
  );
  const open = query !== null && query.start !== dismissed && candidates.length > 0;

  /** Re-read where the caret is and whether it sits inside an "@…". */
  const refreshQuery = useCallback(() => {
    const el = fieldRef.current;
    if (!el || el.selectionStart === null) return;
    caretRef.current = el.selectionStart;
    const next = mentionQueryAt(el.value, el.selectionStart);
    setQuery(next);
    setActive(0);
  }, []);

  const choose = useCallback(
    (m: MentionMember) => {
      const el = fieldRef.current;
      if (!el || !query) return;
      const out = applyMention(el.value, query, m.name, caretRef.current);
      onChange(out.text);
      setQuery(null);
      /*
       * Mark this "@" done, don't just close.
       *
       * The caret lands right after "@Ngọc Anh ", and scanning back from there
       * still finds that very "@" with the whole name as its query — so the
       * list reopened the instant it was used, offering the person who had
       * just been picked. Measured: choosing left `role=listbox` on screen.
       * Cleared again by onChange as soon as a DIFFERENT "@" is typed.
       */
      setDismissed(query.start);
      // After React has written the new value, or the caret lands in the old one.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(out.caret, out.caret);
        caretRef.current = out.caret;
      });
    },
    [onChange, query],
  );

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
    const composing = (e.nativeEvent as unknown as { isComposing?: boolean }).isComposing === true;

    if (open && !composing) {
      /*
       * Enter is the dangerous one, hence the guard above: under Telex the key
       * that commits a syllable arrives here as Enter with isComposing set, and
       * acting on it would insert a name into the middle of an ordinary word.
       * Tab picks too, because on a phone keyboard it is often the only one of
       * the two that is reachable.
       */
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => {
          const n = candidates.length;
          return (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const pick = candidates[active];
        if (pick) {
          e.preventDefault();
          choose(pick);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // This "@", not mentions in general — see `dismissed`.
        setDismissed(query?.start ?? null);
        return;
      }
    }

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

  /*
   * The caret moves for reasons `onChange` never hears about — an arrow key, a
   * tap further up the sentence, a selection. `selectionchange` is the only
   * event that covers all of them, and it fires on the document rather than on
   * the field, so it is bound here rather than as a prop.
   */
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const onSel = () => {
      if (document.activeElement === el) refreshQuery();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [refreshQuery]);

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
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
          onChange(e.target.value);
          // The value React is about to render is this one, so read the query
          // from the event's own target rather than waiting a frame for state.
          caretRef.current = e.target.selectionStart ?? e.target.value.length;
          const next = mentionQueryAt(e.target.value, caretRef.current);
          setQuery(next);
          setActive(0);
          if (next === null || next.start !== dismissed) setDismissed(null);
        }}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        /* A tap on a row is a mousedown before it is a click, and a mousedown
           elsewhere blurs the field first — which would close the list out from
           under the finger. The row handles that itself; here we only need to
           close when focus genuinely leaves. */
        onBlur={() => setQuery(null)}
        rows={rows}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={cn(shared, "relative bg-transparent")}
        {...rest}
      />
      {open && (
        <MentionList
          id={listId}
          items={candidates}
          active={active}
          onHover={setActive}
          onPick={choose}
        />
      )}
    </div>
  );
}

/**
 * The people the half-typed name could mean.
 *
 * Anchored under the field rather than at the caret. The caret-following popup
 * every large app uses exists because their lists are long and their documents
 * are wide; a space here holds two people, so the list is two rows and the
 * field is never wider than a phone. Following the caret would mean measuring
 * it — a mirror element, a copy of every font and padding rule — to move a box
 * that has nowhere better to be.
 *
 * `onMouseDown` with preventDefault, not `onClick`: a click begins with a
 * mousedown, and a mousedown outside the field blurs it — which closes this
 * list before the click ever lands. Preventing the default keeps focus, and
 * with it the caret, exactly where it was.
 */
function MentionList({
  id,
  items,
  active,
  onHover,
  onPick,
}: {
  id: string;
  items: MentionMember[];
  active: number;
  onHover: (i: number) => void;
  onPick: (m: MentionMember) => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Chọn người để nhắc tên"
      className="border-border bg-card shadow-elev-float absolute top-full right-0 left-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border py-1"
    >
      {items.map((m, i) => (
        <li
          key={m.id}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(m);
          }}
          onMouseEnter={() => onHover(i)}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm",
            i === active && "bg-accent-soft",
          )}
        >
          <span className="text-accent font-medium">@{m.name}</span>
          {m.accountName && m.accountName !== m.name && (
            <span className="text-muted-foreground truncate text-xs">{m.accountName}</span>
          )}
        </li>
      ))}
    </ul>
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
