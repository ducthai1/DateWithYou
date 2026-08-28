"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  TONE_COOKIE_NAME,
  TONE_FALLBACK,
  msUntilNextToneChange,
  resolvePreference,
  toneForHour,
  type Tone,
  type TonePreference,
} from "@/lib/tone";

/**
 * Which artwork tone is showing, and how it was decided.
 *
 * Initial state is read from the `data-tone` attribute the inline script in
 * the document head already stamped — not computed here. Computing it during
 * render would disagree with the server-rendered HTML and React would replace
 * the tree; reading what is already on the element cannot disagree with it.
 */
type ToneContextValue = {
  tone: Tone;
  preference: TonePreference;
  setPreference: (p: TonePreference) => void;
};

const ToneContext = createContext<ToneContextValue | null>(null);

function readCookiePreference(): TonePreference {
  if (typeof document === "undefined") return "auto";
  const m = document.cookie.match(new RegExp(`(?:^|; )${TONE_COOKIE_NAME}=([^;]*)`));
  return resolvePreference(m ? decodeURIComponent(m[1]) : undefined);
}

export function ToneProvider({
  children,
  initialTone,
}: {
  children: React.ReactNode;
  /**
   * What the server rendered. Correct already when the cookie held an explicit
   * choice; the fallback when it held "auto", which only the reader's clock
   * can settle. Starting from the same value the server used is what keeps
   * hydration quiet.
   */
  initialTone: Tone;
}) {
  const [preference, setPreferenceState] = useState<TonePreference>("auto");
  const [tone, setTone] = useState<Tone>(initialTone);
  /*
   * Whether the cookie has been read yet.
   *
   * Without it the clock effect below ran on the very first commit, while
   * `preference` was still its initial "auto", and stamped the tone for the
   * current hour — overwriting a saved choice of the other tone before the
   * cookie had even been looked at. Reading the cookie in useState's
   * initialiser instead would disagree with the server, which renders without
   * access to document.cookie.
   */
  const [ready, setReady] = useState(false);

  // After mount, adopt what the head script decided and what the cookie says.
  useEffect(() => {
    const pref = readCookiePreference();
    setPreferenceState(pref);
    // From the cookie, not from data-tone: React restores its own value for
    // that attribute during hydration, so anything written before then is gone
    // by the time this runs.
    setTone(pref === "auto" ? toneForHour(new Date().getHours()) : pref);
    setReady(true);
  }, []);

  const apply = useCallback((next: Tone) => {
    setTone(next);
    document.documentElement.dataset.tone = next;
  }, []);

  const setPreference = useCallback(
    (p: TonePreference) => {
      setPreferenceState(p);
      // A year, and lax: it is a display choice, not a credential.
      document.cookie = `${TONE_COOKIE_NAME}=${p}; path=/; max-age=31536000; samesite=lax`;
      apply(p === "auto" ? toneForHour(new Date().getHours()) : p);
    },
    [apply],
  );

  /*
   * On "auto", the tone has to change while the app is open — someone with
   * the map up at 11:58 should not still be looking at morning artwork at
   * 12:30. One timer aimed at the next boundary rather than polling.
   */
  useEffect(() => {
    if (!ready || preference !== "auto") return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      apply(toneForHour(now.getHours()));
      timer = setTimeout(schedule, msUntilNextToneChange(now));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [ready, preference, apply]);

  const value = useMemo(
    () => ({ tone, preference, setPreference }),
    [tone, preference, setPreference],
  );
  return <ToneContext.Provider value={value}>{children}</ToneContext.Provider>;
}

export function useTone(): ToneContextValue {
  const ctx = useContext(ToneContext);
  // A component outside the provider still renders, with the fallback tone,
  // rather than crashing a page over a picture.
  return ctx ?? { tone: TONE_FALLBACK, preference: "auto", setPreference: () => {} };
}
