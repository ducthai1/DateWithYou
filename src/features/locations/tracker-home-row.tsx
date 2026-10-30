"use client";

import { useState } from "react";
import { Home, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

/** Where they stand, if the browser will say within a few seconds. */
function hereNow(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/**
 * "Nhà" for the tracker: once set, the other person is told "đã về nhà" and
 * "vừa rời nhà" — with this phone in a pocket — and a ride ending there is
 * named "Nhà" in the ride list.
 */
export function TrackerHomeRow({ home }: { home: { lat: number; lng: number } | null }) {
  const utils = trpc.useUtils();
  const setHome = trpc.tracker.setHome.useMutation({ onSuccess: () => void utils.tracker.status.invalidate() });
  const [error, setError] = useState<string | null>(null);

  const setHere = async () => {
    setError(null);
    const here = await hereNow();
    try {
      // No fix from the browser: the tracker's own latest one is just as good.
      await setHome.mutateAsync(here ?? "tracker");
    } catch {
      setError("Chưa lấy được vị trí. Mở OwnTracks một lần cho nó gửi vị trí rồi thử lại.");
    }
  };

  return (
    <div className="border-border rounded-xl border p-3" data-tracker-home={home ? "set" : "unset"}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Home className="text-accent-ink h-4 w-4" aria-hidden />
        {home ? "Đã đặt nhà" : "Báo khi về nhà / rời nhà"}
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {home
          ? "Người kia nhận thông báo khi bạn về tới nhà hoặc vừa rời nhà, kể cả khi máy bạn trong túi."
          : "Đứng ở nhà rồi bấm nút dưới. Người kia sẽ nhận thông báo khi bạn về tới hoặc rời đi."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={setHome.isPending}
          onClick={() => void setHere()}
          className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold disabled:opacity-60"
        >
          {setHome.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {home ? "Đặt lại: chỗ đang đứng" : "Chỗ đang đứng là nhà"}
        </button>
        {home && (
          <button
            type="button"
            disabled={setHome.isPending}
            onClick={() => setHome.mutate(null)}
            className="border-border hover:bg-muted inline-flex h-10 items-center rounded-xl border px-3 text-xs font-semibold disabled:opacity-60"
          >
            Bỏ
          </button>
        )}
      </div>
      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
    </div>
  );
}
