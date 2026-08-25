"use client";

// "Ngày này năm ấy" — memories that fall on today's month+day in an earlier
// year. The one card on this screen that can genuinely surprise the couple.

import Link from "next/link";
import { Images, ChevronRight } from "lucide-react";
import { HomeSection, SectionPrompt } from "./home-section";

export type OnThisDayMemory = {
  id: string;
  title: string;
  caption: string | null;
  date: Date;
  year: number;
  yearsAgo: number;
  thumbnailUrl: string | null;
};

function agoLabel(yearsAgo: number, year: number): string {
  if (yearsAgo <= 0) return `Năm ${year}`;
  if (yearsAgo === 1) return "Đúng một năm trước";
  return `${yearsAgo} năm trước`;
}

export function OnThisDayCard({
  memories,
  hasAnyMemory,
}: {
  memories: OnThisDayMemory[];
  hasAnyMemory: boolean;
}) {
  // An established couple doesn't need a card telling them nothing happened on
  // this date — that's daily noise. Only the brand-new couple gets a prompt.
  if (memories.length === 0 && hasAnyMemory) return null;

  return (
    <HomeSection
      Icon={Images}
      title="Ngày này năm ấy"
      link={memories.length > 0 ? { href: "/timeline", label: "Kỷ niệm" } : undefined}
    >
      {memories.length === 0 ? (
        <SectionPrompt
          text="Chưa có kỷ niệm nào để nhớ lại. Lưu tấm đầu tiên đi, sang năm chỗ này sẽ có gì đó cho tụi mình."
          action={{ href: "/timeline", label: "Thêm kỷ niệm đầu tiên" }}
        />
      ) : (
        <ul className="space-y-2">
          {memories.map((m) => (
            <li key={m.id}>
              <Link
                href="/timeline"
                className="hover:bg-muted focus-visible:ring-ring/50 -mx-1.5 flex min-h-12 items-center gap-3 rounded-xl px-1.5 py-2 outline-none transition-colors focus-visible:ring-2"
              >
                {m.thumbnailUrl ? (
                  <img
                    src={m.thumbnailUrl}
                    alt=""
                    className="bg-muted h-12 w-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="bg-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                    aria-hidden="true"
                  >
                    <Images className="text-accent h-4 w-4" strokeWidth={1.8} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-accent block text-xs font-medium">
                    {agoLabel(m.yearsAgo, m.year)}
                  </span>
                  <span className="block truncate text-sm font-medium">{m.title}</span>
                  {m.caption && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {m.caption}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="text-muted-foreground h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HomeSection>
  );
}
