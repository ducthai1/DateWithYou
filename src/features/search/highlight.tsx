"use client";

export type MatchRange = { start: number; end: number } | null;

/**
 * Renders `text` with the server-supplied match range wrapped in <mark>.
 *
 * The range comes from the search procedure rather than being re-derived here:
 * matching is accent-folded ("ca phe" hits "cà phê"), so the highlighted slice
 * rarely equals what the user typed and the client has no way to find it again
 * without duplicating the whole folding table.
 */
export function Highlight({ text, range }: { text: string; range?: MatchRange }) {
  if (
    !range ||
    range.start < 0 ||
    range.end > text.length ||
    range.start >= range.end
  ) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, range.start)}
      <mark className="rounded-[3px] bg-accent-soft px-0.5 font-semibold text-accent">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}
