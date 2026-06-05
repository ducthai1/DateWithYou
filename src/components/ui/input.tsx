import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "border-border bg-background h-11 w-full rounded-xl border px-3 text-sm outline-none transition-colors",
        "focus:border-accent placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
