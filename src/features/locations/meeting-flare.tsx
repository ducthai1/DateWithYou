"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { calculateDistance, type LatLng } from "@/lib/maps";

/**
 * The "you two arrived at the same place" moment.
 *
 * Two things were wrong with what this replaces.
 *
 * It fired twice. The detection lived inside LocationMapView, and that
 * component is mounted twice on the map page — once in the fullscreen
 * navigation overlay and once in the normal layout, which is not unmounted
 * behind it. Each copy ran its own proximity effect, so two overlays appeared,
 * confetti fired twice and the device buzzed twice. Meeting someone is a fact
 * about the page, not about a map widget, so the detection now lives at the
 * page level and there is exactly one of it.
 *
 * And it was a giant beating heart in rose pink, with pink confetti and a
 * heartbeat vibration pattern. This app is not only for couples — the same
 * screen is used by friends, siblings and flatmates, and being congratulated
 * with a throbbing heart for meeting your friend for coffee is embarrassing.
 *
 * What replaces it comes from the shape of the event rather than a romance
 * cliché: two paths converge into one. Two rings in each person's own colour
 * sweep inward and settle into a single ring, the avatars slide together, one
 * ripple goes out. No confetti spray, no hearts, no pink. Current guidance on
 * celebratory micro-interactions is to keep them brief and reserve them for
 * moments that genuinely deserve one — over-celebrating dulls the effect — so
 * this runs about two seconds and then gets out of the way.
 */

/** Metres between the two people that counts as "met". */
const MEET_RADIUS_M = 30;
/** Metres apart before another meeting can be announced — hysteresis, so
 *  standing near each other with a jittery GPS fix cannot retrigger it. */
const RESET_RADIUS_M = 80;
const VISIBLE_MS = 2600;

type PartnerFix = LatLng & { userId?: string };

export function MeetingFlare({
  userGeo,
  partnerLocation,
  userAvatar,
  partnerAvatar,
}: {
  userGeo: LatLng | null;
  partnerLocation: PartnerFix | null;
  userAvatar?: string | null;
  partnerAvatar?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const armed = useRef(true);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!userGeo || !partnerLocation) return;
    const distance = calculateDistance(userGeo, partnerLocation);

    if (distance < MEET_RADIUS_M && armed.current) {
      armed.current = false;
      setVisible(true);
      // One short tap. The previous pattern was a five-pulse "heartbeat",
      // which is a lot of buzzing to receive for walking up to a friend.
      if (typeof navigator !== "undefined" && navigator.vibrate && !reduceMotion) {
        navigator.vibrate(18);
      }
      hideTimer.current = setTimeout(() => setVisible(false), VISIBLE_MS);
    } else if (distance >= RESET_RADIUS_M) {
      armed.current = true;
    }
  }, [userGeo, partnerLocation, reduceMotion]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          {/* Ground wash — keeps the badge legible over a busy map without
              blacking the map out. */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,22,23,0.55),rgba(2,22,23,0.15)_45%,transparent_70%)]" />

          <div className="relative flex flex-col items-center">
            <div className="relative h-40 w-40">
              {/* One ripple outward. A single expanding ring reads as "this
                  happened here" far more clearly than particles thrown at the
                  screen edges. */}
              {!reduceMotion ? (
                <motion.span
                  initial={{ scale: 0.35, opacity: 0.7 }}
                  animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border border-[var(--accent,#3f8aa3)]"
                />
              ) : null}

              {/* The two arcs, each in one person's colour, closing into one
                  ring. This is the whole idea: two routes becoming one place. */}
              <motion.span
                initial={reduceMotion ? false : { rotate: -120, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--accent,#3f8aa3)] border-r-[var(--accent,#3f8aa3)]"
              />
              <motion.span
                initial={reduceMotion ? false : { rotate: 120, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-b-[#c2693f] border-l-[#c2693f]"
              />

              {/* Avatars travelling in from each side and settling together. */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={reduceMotion ? false : { x: -34, opacity: 0 }}
                  animate={{ x: -13, opacity: 1 }}
                  transition={{ duration: 0.65, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute"
                >
                  <Avatar src={userAvatar} />
                </motion.div>
                <motion.div
                  initial={reduceMotion ? false : { x: 34, opacity: 0 }}
                  animate={{ x: 13, opacity: 1 }}
                  transition={{ duration: 0.65, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute"
                >
                  <Avatar src={partnerAvatar} />
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={reduceMotion ? false : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="mt-6 rounded-full border border-white/15 bg-[#021617]/85 px-5 py-2 backdrop-blur-md"
            >
              <span className="text-[15px] font-medium tracking-wide text-white">
                Đã gặp nhau
              </span>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Avatar({ src }: { src?: string | null }) {
  return src ? (
    <img
      src={src}
      alt=""
      className="h-11 w-11 rounded-full border-2 border-white/90 object-cover shadow-lg"
    />
  ) : (
    <span className="block h-11 w-11 rounded-full border-2 border-white/90 bg-[#0d3b42] shadow-lg" />
  );
}
