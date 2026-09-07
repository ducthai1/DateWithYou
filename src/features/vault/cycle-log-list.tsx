"use client";

import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { daysBetweenKeys } from "@/lib/date-keys";

/**
 * The dates already logged, newest first.
 *
 * What this list is FOR is narrow: spot a mistyped date, and see the rhythm the
 * estimate rests on. So the day leads in a tile you can scan down, and the gap
 * to the previous entry sits right under it — a year typed wrong shows up as a
 * gap of 300-odd days without anyone having to do arithmetic.
 *
 * Two things the first version got wrong, both obvious the moment it was
 * screenshotted on a 320px phone rather than reasoned about: every row printed
 * the machine form of the date ("2026-08-12") beside the human one ("12/8"),
 * which is noise; and the card had a border but no background, so five rows of
 * grey text sat directly on the page's illustration while every other block on
 * the page was a solid card.
 */

const MONTH_SHORT = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function CycleLogList({
  starts,
  onRemove,
  removing,
}: {
  /** `YYYY-MM-DD` keys in any order — sorted here, newest first. */
  starts: readonly string[];
  onRemove: (date: string) => void;
  removing: boolean;
}) {
  const recent = [...starts].sort().reverse();
  const thisYear = new Date().getUTCFullYear();

  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
      <p className="text-muted-foreground border-border border-b px-4 py-2.5 text-xs font-semibold">
        Các mốc đã nhập ({recent.length})
      </p>
      <ul className="divide-border divide-y">
        {recent.map((date, i) => {
          const [y, m, d] = date.split("-").map(Number);
          const older = recent[i + 1];
          const gap = older ? daysBetweenKeys(older, date) : null;
          return (
            <li key={date} className="flex items-center gap-3 px-3 py-2.5">
              {/* Day over month, so the column reads as a date list even
                  before you read any of the words. */}
              <span
                className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 leading-none text-rose-700"
                aria-hidden="true"
              >
                <span className="text-[15px] font-bold tabular-nums">{d}</span>
                <span className="text-[9px] font-semibold">Th{MONTH_SHORT[m - 1]}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="text-foreground truncate text-sm font-semibold">
                    {d} tháng {m}
                    {/* The year only when it is not the obvious one — it is the
                        part that matters for a typo and nowhere else. */}
                    {y !== thisYear && <span className="text-muted-foreground"> · {y}</span>}
                  </span>
                  {/* Beside the date, not under it: on a 320px phone the text
                      column is about 160px, and "gần nhất · cách 28 ngày" on
                      one line truncated to "gần nhất · cách 28…". */}
                  {i === 0 && (
                    <span className="bg-accent-soft text-accent shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                      gần nhất
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground truncate text-xs tabular-nums">
                  {gap != null ? `cách ${gap} ngày` : "mốc đầu tiên"}
                </p>
              </div>
              <ConfirmButton
                idle=""
                icon={<Trash2 className="h-4 w-4" />}
                aria-label={`Xoá mốc ${date}`}
                title="Xoá mốc này?"
                description={`Mốc ${d} tháng ${m}, ${y} sẽ bị xoá và nhịp sẽ được tính lại.`}
                disabled={removing}
                className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                onConfirm={() => onRemove(date)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
