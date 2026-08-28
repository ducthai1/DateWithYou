"use client";

import { Moon, Sunrise, Wand2 } from "lucide-react";
import { useTone } from "./tone-provider";
import { AFTERNOON_FROM_HOUR, type TonePreference } from "@/lib/tone";
import { cn } from "@/lib/utils";

/**
 * Picks the artwork tone: morning, afternoon, or let the clock decide.
 *
 * A radiogroup rather than three buttons, so arrow keys move between the
 * options the way a keyboard user expects of a single choice.
 */
const OPTIONS: { value: TonePreference; label: string; Icon: typeof Sunrise }[] = [
  { value: "morning", label: "Sáng", Icon: Sunrise },
  { value: "afternoon", label: "Chiều", Icon: Moon },
  { value: "auto", label: "Tự động", Icon: Wand2 },
];

export function TonePicker() {
  const { preference, tone, setPreference } = useTone();

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Tông ảnh" className="flex flex-wrap gap-2">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(value)}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs leading-snug">
        {preference === "auto"
          ? `Theo giờ trong máy bạn: trước ${AFTERNOON_FROM_HOUR}h là tông sáng, sau đó là tông chiều. Đang dùng tông ${tone === "morning" ? "sáng" : "chiều"}.`
          : "Luôn dùng tông bạn chọn, không đổi theo giờ."}
      </p>
    </div>
  );
}
