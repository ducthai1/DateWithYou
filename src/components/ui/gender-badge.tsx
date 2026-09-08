import { Mars, Venus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small ♂ / ♀ dot for the corner of a round avatar.
 *
 * Blue for nam, pink for nữ — the two colours everyone already reads without
 * a legend — so a glance at the two avatars in Cài đặt says who is who. Renders
 * nothing when the gender is not set; the parent must be `relative`.
 */
export function GenderBadge({
  gender,
  className,
  size = "md",
}: {
  gender: string | null | undefined;
  className?: string;
  size?: "sm" | "md";
}) {
  if (gender !== "male" && gender !== "female") return null;
  const male = gender === "male";
  const Icon = male ? Mars : Venus;
  return (
    <span
      aria-label={male ? "Nam" : "Nữ"}
      title={male ? "Nam" : "Nữ"}
      className={cn(
        "ring-card absolute flex items-center justify-center rounded-full text-white shadow-sm ring-2",
        male ? "bg-sky-500" : "bg-pink-500",
        size === "sm" ? "-right-0.5 -top-0.5 h-4 w-4" : "-right-1 -top-1 h-5 w-5",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}
