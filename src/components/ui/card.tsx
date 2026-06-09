import { cn } from "@/lib/utils";

/** Shared surface — replaces the repeated `border rounded-xl p-4` markup. */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-card rounded-xl border p-4 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
