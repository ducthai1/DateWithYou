"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";

type TimePickerProps = {
  value: string; // HH:mm
  onChange: (time: string) => void;
};

const HOURS = Array.from({ length: 24 }).map((_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }).map((_, i) => (i * 5).toString().padStart(2, "0"));

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const [hr, min] = value ? value.split(":") : ["", ""];
  
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-time-popup]")) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
      document.addEventListener("mousedown", handle);
    }
    return () => document.removeEventListener("mousedown", handle);
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
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-card px-3 text-sm transition-colors hover:border-accent focus:border-accent outline-none"
        onClick={() => setOpen(!open)}
      >
        <span className={value ? "text-foreground font-medium" : "text-muted-foreground"}>
          {value || "--:--"}
        </span>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          data-time-popup
          className="fixed z-[100] mt-2 flex w-48 rounded-xl border border-border bg-card p-2 shadow-xl"
          style={{ top: rect.bottom, left: rect.left }}
        >
          <div className="flex-1 h-56 overflow-y-auto px-1 border-r border-border/50 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="text-xs font-semibold text-muted-foreground text-center mb-2 sticky top-0 bg-card/90 backdrop-blur py-1">Giờ</div>
            <div className="space-y-1">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => selectHour(h)}
                  className={`w-full rounded-lg py-1.5 text-center text-sm transition-colors ${h === hr ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted text-foreground"}`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 h-56 overflow-y-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="text-xs font-semibold text-muted-foreground text-center mb-2 sticky top-0 bg-card/90 backdrop-blur py-1">Phút</div>
            <div className="space-y-1">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMinute(m)}
                  className={`w-full rounded-lg py-1.5 text-center text-sm transition-colors ${m === min ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted text-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
