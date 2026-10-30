"use client";

import { AlertTriangle, CheckCircle2, Loader2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckAction, CheckItem } from "@/lib/tracking-checklist";
import { ACTION_LABEL, useTrackingChecklist } from "./use-tracking-checklist";
import { TrackerHomeRow } from "./tracker-home-row";

/** One problem and the buttons that fix it, shared by the settings row and the map notice. */
export function TrackingCheckRow({
  item,
  run,
  busy,
}: {
  item: CheckItem;
  run: (a: CheckAction) => Promise<void>;
  busy: CheckAction | null;
}) {
  return (
    <div
      data-check={item.key}
      className={cn(
        "rounded-xl border p-3",
        item.severity === "block" ? "border-destructive/40 bg-destructive/5" : item.severity === "warn" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-border",
      )}
    >
      <p className="flex items-start gap-2 text-sm font-semibold">
        <AlertTriangle
          className={cn("mt-0.5 h-4 w-4 shrink-0", item.severity === "block" ? "text-destructive" : item.severity === "warn" ? "text-amber-600" : "text-accent-ink")}
          aria-hidden
        />
        {item.title}
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{item.detail}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.actions.map((a, i) => (
          <button
            key={a}
            type="button"
            disabled={busy !== null}
            onClick={() => void run(a)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors disabled:opacity-60",
              // The first button is the fix; any second one is the way to get there.
              i === 0 ? "bg-accent text-accent-foreground hover:bg-accent/90" : "border-border hover:bg-muted border",
            )}
          >
            {busy === a && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>
      {item.steps && <p className="text-muted-foreground mt-2 text-xs leading-relaxed">Nếu chưa được: {item.steps}</p>}
    </div>
  );
}

const ago = (d: Date | string | null) => {
  if (!d) return "chưa có";
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  return s < 60 ? `${s} giây trước` : s < 3600 ? `${Math.round(s / 60)} phút trước` : `${Math.round(s / 3600)} giờ trước`;
};

/**
 * "Để người kia thấy bạn đang đi" — the settings side: what is missing, a
 * button for each, and once it works, proof that it does.
 */
export function TrackingSetup() {
  const { items, platform, run, busy, tracker, disconnect } = useTrackingChecklist({ poll: true });
  const linked = tracker?.linked === true;

  return (
    <div className="flex items-start gap-2.5" data-tracking-setup>
      <Radio className="text-accent-ink mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold">Để người kia thấy bạn đang đi</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Trang web không lấy được vị trí khi màn hình tắt — đó là giới hạn của trình duyệt.
            Ứng dụng OwnTracks (miễn phí) chạy nền thay cho Vivu: gửi vị trí của bạn về đây mỗi 25 giây,
            kể cả khi máy nằm trong túi.
            {platform === "other" && " Làm bước này trên điện thoại."}
          </p>
        </div>

        {linked && (
          <p className="text-muted-foreground text-xs" data-tracker-status>
            OwnTracks: vị trí gần nhất {ago(tracker.lastFixAt)}
            {tracker.battery != null && ` · pin ${tracker.battery}%`}
          </p>
        )}

        {items.map((item) => (
          <TrackingCheckRow key={item.key} item={item} run={run} busy={busy} />
        ))}

        {items.length === 0 && linked && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Đã sẵn sàng — tắt màn hình vẫn gửi vị trí.
          </p>
        )}

        {linked && <TrackerHomeRow home={tracker.home} />}

        {linked && (
          <button
            type="button"
            onClick={() => void disconnect()}
            className="text-muted-foreground hover:text-destructive text-xs underline underline-offset-2"
          >
            Ngắt kết nối OwnTracks
          </button>
        )}
      </div>
    </div>
  );
}
