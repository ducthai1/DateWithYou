import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "accent";

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "success" && "bg-emerald-100 text-emerald-700",
        tone === "accent" && "bg-accent-soft text-accent",
        className,
      )}
      {...props}
    />
  );
}
