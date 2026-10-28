"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { daysBetweenKeys } from "@/lib/date-keys";
import { chartRange, dayMonth, formatReading } from "@/lib/notebook";

type Point = { date: string; value: number };
const H = 200;
const PAD = { top: 16, right: 52, bottom: 28, left: 40 };

/**
 * A value beside its mark, on whichever side has room.
 *
 * A milestone on the plan's last day sits on the right edge, and its label to
 * the right of it was cut to "mốc 5" at 390px. Never clip a label: when the
 * right side is short, it goes on the left instead. Measured, not guessed — a
 * 7px-a-character estimate said "fits" and the real text was a few px wider.
 * The layout effect runs before paint, so a flipped label never flashes.
 */
function EndLabel({
  at, y, width, text, strong = false, flip = "beside",
}: {
  at: number; y: number; width: number; text: string; strong?: boolean;
  /**
   * Where it goes when the right side is short. Beside, on the left, it sat on
   * the mark before it: the milestones of a weight-loss plan step down to the
   * right, and "mốc 55" landed on the 55,5 ring (28/10). Below or above clears it.
   */
  flip?: "beside" | "below" | "above";
}) {
  const ref = useRef<SVGTextElement>(null);
  const [fitsRight, setFitsRight] = useState(true);
  useLayoutEffect(() => {
    const w = ref.current?.getBBox().width ?? 0;
    setFitsRight(at + 10 + w <= width - 2);
  }, [at, width, text]);
  const vertical = !fitsRight && flip !== "beside";
  return (
    <text
      ref={ref}
      x={fitsRight ? at + 10 : vertical ? at + 6 : at - 10}
      y={vertical ? y + (flip === "below" ? 16 : -16) : y}
      dy="0.32em"
      textAnchor={fitsRight ? "start" : "end"}
      // A halo in the card colour, painted under the glyphs, keeps the label
      // readable where it crosses a gridline.
      stroke="var(--card)"
      strokeWidth={3}
      paintOrder="stroke"
      className={strong ? "fill-foreground text-xs font-semibold tabular-nums" : "fill-muted-foreground text-xs tabular-nums"}
    >
      {text}
    </text>
  );
}

/** A clean tick step for a span of kilos: 0.5, 1, 2, 5… */
function tickStep(span: number): number {
  for (const s of [0.5, 1, 2, 5, 10, 20, 50]) if (span / s <= 4) return s;
  return 100;
}

/**
 * The morning weigh-ins against the milestones.
 *
 * Two kinds of mark that must never be told apart by colour alone: measured on
 * the theme presets, the accent beside the gray ink sits at ΔE 3.7 for a
 * protan reader on "rose" and 9.4 for anyone on "ocean". So readings are a
 * filled line with dots, milestones are hollow rings with no line, the legend
 * keys copy those shapes, and the table under the chart holds every number.
 */
export function NotebookWeightChart({
  readings,
  targets,
  start,
  end,
  unit,
}: {
  readings: Point[];
  targets: Point[];
  start: string;
  end: string;
  unit: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = [...readings, ...targets];
  const range = chartRange(all.map((p) => p.value));
  // The axis spans the plan, stretched to any reading outside it.
  const first = [start, ...all.map((p) => p.date)].sort()[0];
  const last = [end, ...all.map((p) => p.date)].sort().at(-1)!;
  const spanDays = Math.max(1, daysBetweenKeys(first, last));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (date: string) => PAD.left + (daysBetweenKeys(first, date) / spanDays) * innerW;
  const y = (v: number) => (range ? PAD.top + ((range.max - v) / (range.max - range.min)) * innerH : 0);

  const step = range ? tickStep(range.max - range.min) : 1;
  const ticks: number[] = [];
  if (range) for (let t = Math.ceil(range.min / step) * step; t <= range.max; t += step) ticks.push(t);

  const line = readings.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const lastReading = readings.at(-1);
  const lastTarget = targets.at(-1);
  const dates = [...new Set(all.map((p) => p.date))].sort();

  // Crosshair: snap to the nearest date that has a number on it.
  const nearest = (clientX: number) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || dates.length === 0) return null;
    const px = clientX - box.left;
    return dates.reduce((best, d) => (Math.abs(x(d) - px) < Math.abs(x(best) - px) ? d : best), dates[0]);
  };
  const hoverReading = hover ? readings.find((p) => p.date === hover) : undefined;
  const hoverTarget = hover ? targets.find((p) => p.date === hover) : undefined;

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height: H }}>
      {range && width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Biểu đồ ${readings.length} lần cân và ${targets.length} mốc; số liệu đầy đủ ở bảng bên dưới`}
          className="touch-pan-y"
          onPointerMove={(e) => setHover(nearest(e.clientX))}
          onPointerDown={(e) => setHover(nearest(e.clientX))}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {formatReading(t)}
              </text>
            </g>
          ))}
          {[first, last].map((d, i) => (
            <text key={d + i} x={x(d)} y={H - 8} textAnchor={i ? "end" : "start"} className="fill-muted-foreground text-[11px]">
              {dayMonth(d)}
            </text>
          ))}

          {hover && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted-foreground" strokeWidth={1} />}

          {line && <path d={line} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {readings.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={4} className="fill-accent stroke-card" strokeWidth={2} />
          ))}
          {targets.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={5} className="fill-card stroke-foreground" strokeWidth={2} />
          ))}

          {lastReading && (
            <EndLabel at={x(lastReading.date)} y={y(lastReading.value)} width={width} text={formatReading(lastReading.value)} strong />
          )}
          {lastTarget && lastTarget.date !== lastReading?.date && (
            <EndLabel
              at={x(lastTarget.date)}
              y={y(lastTarget.value)}
              width={width}
              text={`mốc ${formatReading(lastTarget.value)}`}
              // Away from the mark before it: below when the plan steps down, above when it climbs.
              flip={(targets.at(-2)?.value ?? lastTarget.value) >= lastTarget.value ? "below" : "above"}
            />
          )}
        </svg>
      )}

      {hover && (hoverReading || hoverTarget) && (
        <div
          role="status"
          className="border-border bg-card pointer-events-none absolute top-1 z-10 rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(Math.max(x(hover) - 60, 0), Math.max(0, width - 120)), width: 120 }}
        >
          <div className="text-muted-foreground">{dayMonth(hover)}</div>
          {hoverReading && (
            <div className="flex items-center gap-1.5">
              <span className="bg-accent h-0.5 w-3 rounded" aria-hidden />
              <strong className="tabular-nums">{formatReading(hoverReading.value)} {unit}</strong>
              <span className="text-muted-foreground">đã cân</span>
            </div>
          )}
          {hoverTarget && (
            <div className="flex items-center gap-1.5">
              <span className="border-foreground h-2.5 w-2.5 rounded-full border-2" aria-hidden />
              <strong className="tabular-nums">{formatReading(hoverTarget.value)} {unit}</strong>
              <span className="text-muted-foreground">mốc</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
