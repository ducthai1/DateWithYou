import { cn } from "@/lib/utils";

/**
 * The box itself, as a string.
 *
 * MentionField paints a second layer that has to line up with this one to the
 * pixel — same font, same padding, same border width — so both read the box
 * from here rather than from two copies that could drift apart.
 */
export const TEXTAREA_CLASS = cn(
  "bg-card border-border w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
  "focus-visible:border-accent focus-visible:ring-ring/40 placeholder:text-muted-foreground focus-visible:ring-2",
);

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(TEXTAREA_CLASS, className)} {...props} />;
}
