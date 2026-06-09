import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "bg-card border-border w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
        "focus-visible:border-accent focus-visible:ring-ring/40 placeholder:text-muted-foreground focus-visible:ring-2",
        className,
      )}
      {...props}
    />
  );
}
