"use client";

/**
 * Tiny module-level store for the accepted companion trip.
 *
 * When a navigation invite is accepted (by either partner), the accepted trip
 * { locationId, waypoints } must reach the map so it can pass waypoints to
 * getRoute. We cannot use the URL because the waypoints array is too large for
 * query params and would break URL-based caching.
 *
 * This is intentionally minimal: a single mutable cell + a set of React
 * setState subscribers. No external library needed.
 */

import type { Waypoint } from "./use-navigation-invites";

export type AcceptedTrip = {
  locationId: string;
  waypoints: Waypoint[];
  /** Who is starting this trip — drives the right "let's go" copy per side. */
  role: "sender" | "receiver";
};

type Listener = (trip: AcceptedTrip | null) => void;

let _trip: AcceptedTrip | null = null;
const _listeners = new Set<Listener>();

export const acceptedTripStore = {
  get(): AcceptedTrip | null {
    return _trip;
  },

  set(trip: AcceptedTrip | null): void {
    _trip = trip;
    for (const fn of _listeners) fn(trip);
  },

  subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
