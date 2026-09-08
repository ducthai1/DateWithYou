import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { READING_PATH, type ReadingStep } from "./reading-path";
import { LinkPending } from "./link-pending";

/**
 * "Mới dùng? Đọc theo thứ tự này" — the guided path through the blog.
 *
 * Numbered on purpose: this is the one list on the site where the order carries
 * information (each step assumes the one before it). Rendered as a Server
 * Component so it costs no JavaScript on either the landing page or the index.
 *
 * `titles` lets the blog index show the live title of each post; the landing
 * page passes nothing and uses the written one. Steps whose post is known to
 * be gone are dropped by the caller (`steps`), never linked to a 404.
 */
export function ReadingPathStrip({
  steps = READING_PATH,
  titles,
  compact = false,
  className,
}: {
  steps?: ReadingStep[];
  titles?: Record<string, string>;
  /** Tighter spacing for a sidebar/aside placement. */
  compact?: boolean;
  className?: string;
}) {
  if (steps.length === 0) return null;
  return (
    <section
      aria-labelledby="reading-path-heading"
      className={cn(
        "border-accent/20 bg-accent-soft/40 rounded-3xl border p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
          <Compass className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-accent text-xs font-semibold uppercase tracking-wide">Mới dùng Vivu?</p>
          <h2 id="reading-path-heading" className="text-foreground mt-0.5 text-lg font-bold leading-snug">
            Bắt đầu từ đây — đọc theo thứ tự này là đủ dùng
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Sáu bài, theo đúng thứ tự bạn sẽ dùng app: mở không gian, ghim chỗ, đi tới đó, rồi giữ lại.
          </p>
        </div>
      </div>
      <ol className={cn("mt-5 grid gap-3", compact ? "" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {steps.map((s, i) => (
          <li key={s.slug}>
            <Link
              href={`/blog/${s.slug}`}
              className="group border-border bg-card hover:border-accent/40 relative flex h-full gap-3 rounded-2xl border p-3.5 transition-colors"
            >
              <LinkPending className="rounded-2xl" />
              <span className="text-accent/70 w-6 shrink-0 text-xl font-bold leading-none tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="text-accent block text-[11px] font-semibold uppercase tracking-wide">{s.step}</span>
                <span className="text-foreground group-hover:text-accent mt-0.5 block text-sm font-semibold leading-snug">
                  {titles?.[s.slug] ?? s.title}
                </span>
                {!compact && <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{s.blurb}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground mt-4 flex items-center gap-1 text-xs">
        Đọc xong sáu bài, mở app là biết bấm vào đâu.
        <Link href={`/blog/${steps[0].slug}`} className="text-accent inline-flex items-center gap-1 font-semibold hover:underline">
          Đọc bài đầu tiên <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </p>
    </section>
  );
}
