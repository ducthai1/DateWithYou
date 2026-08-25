"use client";

import Link from "next/link";
import type { Ref } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/root";
import { CalendarHeart, Images, Library, MapPin, Plane, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Highlight } from "./highlight";

type SearchOutput = inferRouterOutputs<AppRouter>["search"]["query"];
export type SearchGroup = SearchOutput["groups"][number];
export type SearchHit = SearchGroup["items"][number];
export type SearchKind = SearchHit["kind"];

/** Vietnamese section headers + a glyph, so each group is scannable at a tap. */
export const KIND_META: Record<SearchKind, { label: string; Icon: LucideIcon }> = {
  memory: { label: "Kỷ niệm", Icon: Images },
  location: { label: "Địa điểm", Icon: MapPin },
  media: { label: "Bộ sưu tập", Icon: Library },
  plan: { label: "Lịch trình", Icon: CalendarHeart },
  trip: { label: "Chuyến đi", Icon: Plane },
};

/**
 * One result. A real <Link> (so middle-click / long-press still work) that the
 * screen can also focus programmatically for arrow-key navigation — Enter then
 * opens it natively, no synthetic activation needed.
 */
export function SearchResultRow({
  hit,
  active,
  linkRef,
  onFocus,
  onKeyDown,
}: {
  hit: SearchHit;
  active: boolean;
  linkRef: Ref<HTMLAnchorElement>;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <Link
      ref={linkRef}
      href={hit.href}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={cn(
        "border-border bg-card flex min-h-[52px] flex-col justify-center rounded-xl border px-3 py-2.5 transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active ? "border-accent/40 bg-accent-soft/50" : "hover:bg-muted",
      )}
    >
      <p className="text-foreground truncate text-sm font-medium">
        <Highlight text={hit.title} range={hit.titleMatch} />
      </p>
      {hit.snippet && (
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
          <Highlight text={hit.snippet} range={hit.snippetMatch} />
        </p>
      )}
    </Link>
  );
}
