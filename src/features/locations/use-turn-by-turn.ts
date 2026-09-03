"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/maps";
import type { Maneuver } from "@/lib/maneuver-vi";
import {
  announceableTurns,
  initialAnnouncerState,
  stepAnnouncer,
  type AnnouncerState,
} from "@/lib/turn-announcer";
import { speak } from "@/lib/speak";

/**
 * Which turn is next, how far it is, and saying so out loud once per stage.
 *
 * The deciding is in `turn-announcer.ts`, not here, so a whole ride can be run
 * against it without a browser — which is how the two faults that made this
 * feature useless were found: every stage after the first resolved to the same
 * key and went unspoken, and a corner passed slightly wide left the countdown
 * stuck on it for the rest of the trip. This hook is now only the bridge from
 * a stream of positions to that function, and from its answer to the speaker.
 */

export type TurnByTurn = {
  /** The turn being approached, or null when there is nothing left to say. */
  next: Maneuver | null;
  /** Straight-line metres to it, or null. */
  metres: number | null;
  /** The sentence last spoken — the banner shows the same words. */
  sentence: string | null;
};

export function useTurnByTurn({
  maneuvers,
  userGeo,
  active,
}: {
  maneuvers: Maneuver[] | null;
  userGeo: LatLng | null;
  active: boolean;
}): TurnByTurn {
  const turns = useMemo(() => announceableTurns(maneuvers), [maneuvers]);
  const stateRef = useRef<AnnouncerState>(initialAnnouncerState);
  const [view, setView] = useState<TurnByTurn>({ next: null, metres: null, sentence: null });

  // A new route is a new set of turns; nothing already said applies to it.
  useEffect(() => {
    stateRef.current = initialAnnouncerState;
    setView({ next: null, metres: null, sentence: null });
  }, [turns]);

  useEffect(() => {
    if (!active || !userGeo || turns.length === 0) {
      setView({ next: null, metres: null, sentence: null });
      return;
    }
    const step = stepAnnouncer(turns, stateRef.current, userGeo);
    stateRef.current = step.state;
    // Chime on every instruction: this is the one that has to land while the
    // rider is moving, with the road making its own noise.
    if (step.speak) speak(step.speak, { chime: true });
    setView((prev) => ({
      next: step.next,
      metres: step.metres,
      // Keep the last spoken line on the banner between announcements: the
      // distance beside it is live, so a stale sentence would be the only
      // stale thing on screen.
      sentence: step.speak ?? prev.sentence,
    }));
  }, [active, userGeo, turns]);

  return view;
}
