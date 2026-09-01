"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/maps";
import {
  IMMINENT_M,
  isRealTurn,
  maneuverSentence,
  type Maneuver,
} from "@/lib/maneuver-vi";
import { speak } from "@/lib/speak";

/**
 * Which turn is next, how far it is, and saying so out loud once per stage.
 *
 * The distance is straight-line from the live fix to the turn's own coordinate,
 * not measured along the route. For city riding on a route that was drawn to
 * the road anyway, the two agree closely enough to announce on, and the
 * along-route version needs the whole polyline walked on every GPS tick to earn
 * a difference nobody hears.
 *
 * Turns are announced at four ranges, the way a satnav does: far enough to
 * choose a lane, then a reminder, then a warning, then the turn itself. Each
 * range fires once per turn — crossing back and forth at a light must not make
 * it repeat, which is what the `said` set is for.
 */

/** Metres at which each announcement is made, far to near. */
const STAGES = [500, 200, 80, IMMINENT_M] as const;

/** Close enough to count the turn as taken and move to the next one. */
const PASSED_M = 25;

function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type TurnByTurn = {
  /** The turn being approached, or null when there is nothing left to say. */
  next: Maneuver | null;
  /** Straight-line metres to it, or null. */
  metres: number | null;
  /** The sentence currently on the banner — the same one that was spoken. */
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
  /*
   * Only the turns worth interrupting for.
   *
   * Valhalla emits a maneuver for every shape change, including "continue" and
   * the "start" at the door. Announcing those means talking constantly and
   * saying nothing, so the list is reduced to real turns plus the arrival, and
   * everything downstream — the index, the banner, the voice — works on that.
   */
  const turns = useMemo(
    () => (maneuvers ?? []).filter((m) => isRealTurn(m.type) || (m.type >= 4 && m.type <= 6)),
    [maneuvers],
  );

  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<TurnByTurn>({ next: null, metres: null, sentence: null });
  const said = useRef<Set<string>>(new Set());

  // A new route is a new set of turns; nothing already said applies to it.
  useEffect(() => {
    setIdx(0);
    said.current = new Set();
    setState({ next: null, metres: null, sentence: null });
  }, [turns]);

  useEffect(() => {
    if (!active || !userGeo || turns.length === 0) {
      setState({ next: null, metres: null, sentence: null });
      return;
    }
    const i = Math.min(idx, turns.length - 1);
    const turn = turns[i];
    const metres = metresBetween(userGeo, { lat: turn.lat, lng: turn.lng });

    // Taken: step to the next one. The final maneuver is the destination, so
    // there is nothing to step to and the banner simply stays on it.
    if (metres <= PASSED_M && i < turns.length - 1) {
      setIdx(i + 1);
      return;
    }

    const stage = STAGES.find((s) => metres <= s);
    let sentence = state.sentence;
    if (stage != null) {
      const key = `${i}:${stage}`;
      if (!said.current.has(key)) {
        said.current.add(key);
        sentence = maneuverSentence(turn, metres);
        speak(sentence);
      }
    }
    setState({ next: turn, metres, sentence: sentence ?? maneuverSentence(turn, metres) });
  // `state.sentence` is read but must not drive this: it is written here, and
  // listing it would re-run the effect on its own output.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userGeo, turns, idx]);

  return state;
}
