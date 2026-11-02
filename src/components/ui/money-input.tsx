"use client";

import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { editMoney, formatMoney, shortMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * A money field that reads like money: "500.000 đ" as it is typed, the number
 * keypad on a phone, and a row of round amounts to tap instead of counting
 * zeros. `value` is the amount, or null for "not given" — never a string.
 */
export function MoneyInput({
  value,
  onChange,
  presets = [],
  ariaLabel,
  placeholder = "0",
  className,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  presets?: number[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Input
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value == null ? "" : formatMoney(value)}
        onChange={(e) =>
          onChange(editMoney(value, e.target.value, e.target.selectionStart, (e.nativeEvent as InputEvent).inputType))
        }
        className="tabular-nums"
        suffixIcon={<span className="text-muted-foreground text-sm" aria-hidden="true">đ</span>}
      />
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`${ariaLabel}: chọn nhanh`}>
          {presets.map((p) => (
            <Chip key={p} label={shortMoney(p)} selected={value === p} onClick={() => onChange(value === p ? null : p)} className="px-3" />
          ))}
        </div>
      )}
    </div>
  );
}
