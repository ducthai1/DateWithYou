"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TrackingCheckRow } from "./tracking-setup";
import { useTrackingChecklist } from "./use-tracking-checklist";

/** "Không dùng" on the OwnTracks suggestion is remembered on this device. */
const DECLINED_KEY = "vivu.tracker.declined";

/**
 * What is missing for this phone to be seen, the moment the map opens — each
 * with the button that fixes it right here.
 *
 * Only what is wrong, and only on the map: that is where someone is about to
 * set off, and a notice anywhere else would be noise. "Để sau" hides it until
 * the next visit; the OwnTracks suggestion can be turned down for good, since
 * not everyone will want a second app.
 */
export function TrackingNotice() {
  const { items, run, busy } = useTrackingChecklist();
  const [later, setLater] = useState(false);
  const [declined, setDeclined] = useState(true);
  useEffect(() => {
    try {
      setDeclined(localStorage.getItem(DECLINED_KEY) === "1");
    } catch {
      setDeclined(false);
    }
  }, []);

  const shown = items.filter((i) =>
    i.severity === "suggest"
      ? !declined
      : // Silence is only a warning: it could be a phone with no signal, and
        // the settings screen already says so. Here it would nag.
        !(i.key === "tracker-silent" && i.severity === "warn"),
  );
  if (later || shown.length === 0) return null;

  const onlySuggestion = shown.every((i) => i.severity === "suggest");
  return (
    <div
      role="status"
      aria-live="polite"
      data-tracking-notice
      className="pointer-events-auto fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[45] max-h-[70dvh] space-y-2 overflow-y-auto rounded-2xl border border-border bg-card/95 p-3 shadow-elev-float backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2"
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">Để người kia thấy bạn</p>
        {onlySuggestion && (
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(DECLINED_KEY, "1");
              } catch {
                /* private mode: it will just ask again next time */
              }
              setDeclined(true);
            }}
            className="text-muted-foreground hover:bg-muted h-10 rounded-xl px-2 text-xs"
          >
            Không dùng
          </button>
        )}
        <button
          type="button"
          onClick={() => setLater(true)}
          aria-label="Để sau"
          title="Để sau"
          className="text-muted-foreground hover:bg-muted inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {shown.map((item) => (
        <TrackingCheckRow key={item.key} item={item} run={run} busy={busy} />
      ))}
    </div>
  );
}
