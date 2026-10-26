"use client";

import { useEffect, useRef, useState } from "react";
import type { ListenPresence } from "@/features/locations/use-navigation-invites";

/**
 * Whether each person is still looking at the player.
 *
 * Chủ repo (26/10): when the other person switches to another tab, another
 * app on the phone, or another window, the screen should say so — otherwise
 * the one still watching cannot tell "they left" from "it is broken".
 *
 * Two signals, both from the browser itself:
 * - `visibilityState === "hidden"`: another tab, a minimised window, another
 *   app, a locked screen. A phone cannot tell those apart, so neither can we.
 * - `document.hasFocus() === false` with the page still on screen: another
 *   window on a computer (not on a touch screen — see `touchFirst`). It is
 *   true while the video's own frame has focus, so clicking the player is not
 *   mistaken for leaving.
 */

/** How long the other person has to be gone before it is said — a glance at another tab is not news. */
const AWAY_AFTER_MS = 2500;
/** How often focus is re-checked here; there is no event for "another window took focus" while the frame held it. */
const FOCUS_CHECK_MS = 1500;

type Mine = { away: false } | { away: true; kind: "hidden" | "blur" };

/*
 * "Another window" is a computer's idea. On a touch screen focus wanders for
 * reasons that are not leaving — the system's own fullscreen video player, a
 * notification pulled down — and a phone that has really gone elsewhere says
 * so with `hidden`, which is the reliable signal there.
 */
const touchFirst = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

function myPresence(): Mine {
  if (document.visibilityState === "hidden") return { away: true, kind: "hidden" };
  if (!document.hasFocus() && !touchFirst()) return { away: true, kind: "blur" };
  return { away: false };
}

/*
 * A plain fetch with `keepalive`, not the tRPC client: a phone may freeze the
 * page the moment it is hidden, and only a keepalive request is guaranteed to
 * be sent after that. `sendBeacon` would be the usual tool, but it cannot send
 * `application/json`, which is the only body tRPC accepts.
 */
let lastSeq = 0;
function sendPresence(state: Mine) {
  // Ordered on the server by this — two reports can land in either order (see `seq` there).
  const seq = (lastSeq = Math.max(lastSeq + 1, Date.now()));
  void fetch("/api/trpc/listen.presence", {
    method: "POST",
    keepalive: true,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { ...state, seq } }),
  }).catch(() => {
    /* The next change, or the return to the page, says it again. */
  });
}

export type PartnerAway = "hidden" | "blur" | null;

export function useListenPresence({
  sessionId,
  partner,
  partnerName,
  announce,
}: {
  /** The live session, or null. */
  sessionId: string | null;
  partner: ListenPresence | null;
  partnerName: string;
  announce: (text: string) => void;
}): PartnerAway {
  // ── This side: tell the other person when this page is left and come back to ──
  useEffect(() => {
    if (!sessionId) return;
    let last: string | null = null;
    const report = () => {
      const s = myPresence();
      const key = s.away ? s.kind : "here";
      if (key === last) return;
      last = key;
      sendPresence(s);
    };
    // Once on joining — and on a reload, which clears the "away" the old page left behind.
    report();
    // `blur` fires before focus has settled; read it a beat later.
    const soon = () => setTimeout(report, 0);
    const onPageHide = () => {
      // The page may still read "visible" while it is being torn down.
      if (last === "hidden") return;
      last = "hidden";
      sendPresence({ away: true, kind: "hidden" });
    };
    document.addEventListener("visibilitychange", report);
    window.addEventListener("blur", soon);
    window.addEventListener("focus", soon);
    window.addEventListener("pagehide", onPageHide);
    const t = setInterval(report, FOCUS_CHECK_MS);
    return () => {
      document.removeEventListener("visibilitychange", report);
      window.removeEventListener("blur", soon);
      window.removeEventListener("focus", soon);
      window.removeEventListener("pagehide", onPageHide);
      clearInterval(t);
    };
  }, [sessionId]);

  // ── The other side: say it once they have really gone, and when they are back ──
  const awayKind: PartnerAway =
    sessionId && partner && partner.id === sessionId && partner.away ? (partner.kind ?? "hidden") : null;
  const [shown, setShown] = useState<PartnerAway>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const say = useRef({ announce, partnerName });
  say.current = { announce, partnerName };
  useEffect(() => {
    if (!awayKind) {
      // Only a return from an absence that was actually announced is worth a word.
      if (shownRef.current && sessionId) say.current.announce(`${say.current.partnerName} đã quay lại xem`);
      setShown(null);
      return;
    }
    if (shownRef.current) {
      setShown(awayKind);
      return;
    }
    const t = setTimeout(() => setShown(awayKind), AWAY_AFTER_MS);
    return () => clearTimeout(t);
  }, [awayKind, sessionId]);

  return sessionId ? shown : null;
}
