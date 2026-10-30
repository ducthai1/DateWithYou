"use client";

import { useCallback, useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/root";
import { trpc } from "@/lib/trpc";
import { OWNTRACKS_APP_STORE, OWNTRACKS_PLAY_STORE } from "@/lib/owntracks";
import {
  platformOf,
  trackingProblems,
  type CheckAction,
  type CheckItem,
  type Platform,
  type WebLocation,
} from "@/lib/tracking-checklist";

/** Asked once and then followed: a permission can change in another tab or in Settings. */
function useWebLocationPermission(): [WebLocation, () => Promise<void>] {
  const [state, setState] = useState<WebLocation>("unknown");

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const read = () => status && setState(status.state as WebLocation);
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((s) => {
        status = s;
        read();
        s.addEventListener("change", read);
      })
      .catch(() => setState("unknown"));
    return () => status?.removeEventListener("change", read);
  }, []);

  /*
   * The quick button. Asking for a position IS asking for the permission —
   * the browser shows its own dialog, from inside this tap, right here. After
   * a refusal it may not show anything; the answer then says "denied" and the
   * steps appear.
   */
  const ask = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (!navigator.geolocation) return resolve();
        navigator.geolocation.getCurrentPosition(
          () => {
            setState("granted");
            resolve();
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) setState("denied");
            resolve();
          },
          { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
        );
      }),
    [],
  );
  return [state, ask];
}

/**
 * The checklist and its buttons, wired to the real calls. Used by the settings
 * row (everything) and by the map's notice (only what is broken).
 */
export function useTrackingChecklist({ poll = false }: { poll?: boolean } = {}): {
  items: CheckItem[];
  platform: Platform;
  run: (action: CheckAction) => Promise<void>;
  busy: CheckAction | null;
  tracker: inferRouterOutputs<AppRouter>["tracker"]["status"] | undefined;
  disconnect: () => Promise<void>;
} {
  const [platform, setPlatform] = useState<Platform>("other");
  useEffect(() => setPlatform(platformOf(navigator.userAgent, navigator.maxTouchPoints)), []);
  const [web, askLocation] = useWebLocationPermission();
  // Polled on the setup screen, so "chưa nhận được" turns into "đang nhận"
  // while the person is still looking at it; elsewhere, on focus only.
  const status = trpc.tracker.status.useQuery(undefined, { refetchInterval: poll ? 20_000 : false });
  const utils = trpc.useUtils();
  const connect = trpc.tracker.connect.useMutation();
  const disconnectM = trpc.tracker.disconnect.useMutation();
  const [busy, setBusy] = useState<CheckAction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const items = trackingProblems({ web, tracker: status.data ?? null, platform, now });

  const run = useCallback(
    async (action: CheckAction) => {
      setBusy(action);
      try {
        if (action === "ask-location") await askLocation();
        else if (action === "install-tracker")
          window.open(platform === "ios" ? OWNTRACKS_APP_STORE : OWNTRACKS_PLAY_STORE, "_blank", "noopener");
        else {
          // Linking is idempotent, so "connect" and "open" are the same call:
          // both end in OwnTracks importing Vivu's settings and asking for what
          // it is missing, on its own screen.
          const view = status.data?.linked ? status.data : await connect.mutateAsync();
          void utils.tracker.status.invalidate();
          if (view.linked) window.location.href = view.configLink;
        }
      } finally {
        setBusy(null);
      }
    },
    [askLocation, platform, status.data, connect, utils],
  );

  const disconnect = useCallback(async () => {
    await disconnectM.mutateAsync();
    await utils.tracker.status.invalidate();
  }, [disconnectM, utils]);

  return { items, platform, run, busy, tracker: status.data, disconnect };
}

export const ACTION_LABEL: Record<CheckAction, string> = {
  "ask-location": "Cho phép vị trí",
  "install-tracker": "Cài OwnTracks",
  "connect-tracker": "Kết nối",
  "open-tracker": "Mở OwnTracks",
};
