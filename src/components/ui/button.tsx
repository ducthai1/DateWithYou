import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "destructive";
  size?: "default" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xl text-sm font-medium transition-all active:scale-[.98] touch-manipulation",
        size === "default" && "h-11 px-4",
        size === "icon" && "h-11 w-11 p-0 shrink-0",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm",
        variant === "outline" &&
          "border-border bg-card hover:bg-muted border shadow-sm",
        variant === "ghost" && "hover:bg-muted",
        variant === "destructive" &&
          "bg-destructive text-white hover:bg-destructive/90 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
