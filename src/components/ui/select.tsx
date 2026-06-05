import { cn } from "@/lib/utils";

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "border-border bg-background h-11 w-full rounded-xl border px-3 text-sm outline-none",
        "focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
