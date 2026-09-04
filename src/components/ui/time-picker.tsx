"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";

type TimePickerProps = {
  value: string; // HH:mm
  onChange: (time: string) => void;
  /** Offer "no time at all" — for fields where the hour is optional. */
  clearable?: boolean;
};

const HOURS = Array.from({ length: 24 }).map((_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }).map((_, i) => (i * 5).toString().padStart(2, "0"));

export function TimePicker({ value, onChange, clearable = false }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const [hr, min] = value ? value.split(":") : ["", ""];
  
  // Close on outside click / scroll / resize / Escape. The dropdown is fixed at a
  // one-time rect, so without scroll+resize handling it detaches from the trigger
  // when the surrounding form scrolls or the device rotates / keyboard opens.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-time-popup]")) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onScroll(e: Event) {
      const target = e.target as HTMLElement;
      if (target.closest && target.closest("[data-time-popup]")) return;
      setOpen(false);
    }
    const onResize = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };

    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectHour = (h: string) => {
    onChange(`${h}:${min || "00"}`);
  };
  
  const selectMinute = (m: string) => {
    onChange(`${hr || "00"}:${m}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        /* Clock on the left in the accent, exactly where the date field puts
           its calendar. The two sit side by side and answer one question, so
           they should not be mirror images of each other — and nothing hangs
           off the right edge to compete with the value. */
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm transition-colors hover:border-accent focus:border-accent outline-none"
        onClick={() => setOpen(!open)}
      >
        <Clock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className={value ? "text-foreground font-medium" : "text-muted-foreground"}>
          {value || "--:--"}
        </span>
      </button>

      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          data-time-popup
          className="fixed z-[100] mt-2 flex w-48 flex-col rounded-xl border border-border bg-card p-2 shadow-xl"
          style={{
            top: (() => {
              const estimatedHeight = 240;
              return rect.bottom + estimatedHeight > window.innerHeight
                ? Math.max(0, rect.top - estimatedHeight - 8)
                : rect.bottom + 8;
            })(),
            left: Math.min(rect.left, window.innerWidth - 192 - 8),
          }}
        >
          <div className="flex">
          <div className="flex-1 h-56 overflow-y-auto px-1 border-r border-border/50 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="text-xs font-semibold text-muted-foreground text-center mb-2 sticky top-0 bg-card/90 backdrop-blur py-1">Giờ</div>
            <div className="space-y-0.5">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => selectHour(h)}
                  className={`w-full min-h-11 rounded-lg py-2.5 text-center text-sm transition-colors touch-manipulation ${h === hr ? "bg-accent text-accent-foreground font-semibold active:opacity-80" : "hover:bg-muted active:bg-muted text-foreground"}`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 h-56 overflow-y-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="text-xs font-semibold text-muted-foreground text-center mb-2 sticky top-0 bg-card/90 backdrop-blur py-1">Phút</div>
            <div className="space-y-0.5">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMinute(m)}
                  className={`w-full min-h-11 rounded-lg py-2.5 text-center text-sm transition-colors touch-manipulation ${m === min ? "bg-accent text-accent-foreground font-semibold active:opacity-80" : "hover:bg-muted active:bg-muted text-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          </div>
          {/* Clearing lives in here rather than as a badge on the field: "some
              time that day" is a real answer, and the way back to it should not
              be an extra control sitting on the trigger. */}
          {clearable && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted mt-1.5 w-full rounded-lg border-t pt-2 text-xs"
            >
              Bỏ giờ
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
