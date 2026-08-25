"use client";

// Loading and error surfaces for the "Hôm nay" screen.
// A failed fetch must never be mistaken for "chưa có gì": the error branch says
// plainly that loading failed, in Vietnamese, and offers a retry.

import { CloudOff, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Card-shaped bones so the layout doesn't jump when real data lands. */
export function HomeSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Đang tải hôm nay">
      <span className="sr-only">Đang tải…</span>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      ))}
    </div>
  );
}

export function HomeError({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <span
        className="bg-accent-soft flex h-14 w-14 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <CloudOff className="text-accent h-6 w-6" strokeWidth={1.6} />
      </span>
      <div className="space-y-1">
        <p className="text-h2 font-semibold">Chưa tải được hôm nay</p>
        <p className="text-muted-foreground mx-auto max-w-xs text-sm">
          Mạng có vẻ hơi chậm. Không mất gì đâu — thử lại một lần nữa nhé.
        </p>
      </div>
      <Button onClick={onRetry} disabled={retrying}>
        <RefreshCw
          className={retrying ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}
          aria-hidden="true"
        />
        {retrying ? "Đang thử lại…" : "Thử lại"}
      </Button>
    </Card>
  );
}
