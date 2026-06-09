import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "destructive";

/** Square 32px tappable icon button — meets min touch target, has focus ring. */
export function IconButton({
  className,
  tone = "neutral",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tone === "neutral" && "text-muted-foreground hover:bg-muted",
        tone === "accent" && "text-accent hover:bg-accent-soft",
        tone === "destructive" && "text-destructive hover:bg-destructive-soft",
        className,
      )}
      {...props}
    />
  );
}
