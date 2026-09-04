import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { findMentionRanges, type MentionMember } from "@/lib/mentions";

/**
 * A saved caption, with the names in it reading as names.
 *
 * Reading is where the mention can be at its clearest: there is no input
 * underneath to line up with, so the letters themselves take the accent rather
 * than only sitting on a tinted pill the way they must while being typed.
 *
 * Same ranges as the editor uses, so a name that highlights while being written
 * cannot come back plain when it is read.
 */
export function MentionText({
  text,
  members,
  className,
}: {
  text: string;
  members: MentionMember[];
  className?: string;
}) {
  const ranges = findMentionRanges(text, members);
  if (!ranges.length) return <span className={className}>{text}</span>;

  const out: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    if (r.start > at) out.push(<Fragment key={`t${i}`}>{text.slice(at, r.start)}</Fragment>);
    out.push(
      <span
        key={`m${i}`}
        data-mention=""
        className="text-accent bg-accent-soft/60 rounded-[5px] px-1 font-semibold [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
      >
        {text.slice(r.start, r.end)}
      </span>,
    );
    at = r.end;
  });
  if (at < text.length) out.push(<Fragment key="tail">{text.slice(at)}</Fragment>);

  return <span className={cn(className)}>{out}</span>;
}
